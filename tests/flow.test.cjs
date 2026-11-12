/* Browser checks for the "day at Aegis" journey (Playwright). Run:
 *   NODE_PATH=<folder with playwright>/node_modules node tests/flow.test.cjs [shots-dir]
 * Booking and sending are simulated; these checks prove the interface, scroll stages and flow. */
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const file = path.join(__dirname, '..', 'index.html');
const out = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const res = [];
const step = async (name, fn) => {
  try { await fn(); res.push('PASS ' + name); } catch (e) { res.push('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); }
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const add = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const scrollToId = (p, id, extra = 0) => p.evaluate(({ id, extra }) => {
  const el = document.getElementById(id);
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + extra, behavior: 'instant' });
}, { id, extra });

(async () => {
  const b = await chromium.launch();
  for (const [w, h, scheme, motion] of [[1440, 900, 'light', 'no-preference'], [390, 844, 'dark', 'no-preference'], [1280, 900, 'light', 'reduce']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: motion });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(pathToFileURL(file).href);
    await p.waitForTimeout(300);
    const tag = `${w}-${scheme}-${motion === 'reduce' ? 'reduced' : 'motion'}`;
    const scrub = motion !== 'reduce';

    await step(`${tag} scroll stages are ${scrub ? 'on' : 'off'}`, async () => {
      assert.equal(await p.evaluate(() => document.documentElement.classList.contains('is-scrub')), scrub);
      const tall = await p.evaluate(() => document.getElementById('arrival').offsetHeight / window.innerHeight);
      if (scrub) assert.ok(tall > 1.8, `tunnel stage height ${tall}`); else assert.ok(tall < 1.3, `static height ${tall}`);
    });
    if (scrub) {
      await step(`${tag} tunnel: scrolling zooms in, then the door fades in`, async () => {
        await scrollToId(p, 'arrival', 10); await p.waitForTimeout(250);
        const early = await p.evaluate(() => ({ p: +getComputedStyle(document.getElementById('arrival')).getPropertyValue('--p'), door: +getComputedStyle(document.querySelector('.tunnel--b')).opacity }));
        await p.evaluate(() => window.scrollBy({ top: document.getElementById('arrival').offsetHeight - window.innerHeight - 20, behavior: 'instant' }));
        await p.waitForTimeout(250);
        const late = await p.evaluate(() => ({ p: +getComputedStyle(document.getElementById('arrival')).getPropertyValue('--p'), door: +getComputedStyle(document.querySelector('.tunnel--b')).opacity }));
        assert.ok(early.p < 0.1 && late.p > 0.9, JSON.stringify({ early, late }));
        assert.ok(early.door < 0.05 && late.door > 0.9, JSON.stringify({ early, late }));
        await p.screenshot({ path: `${out}/${tag}-tunnel-end.png` });
      });
      await step(`${tag} hall: vertical scroll pans the arcade sideways to its last image`, async () => {
        await scrollToId(p, 'hall', 5); await p.waitForTimeout(200);
        const x0 = await p.evaluate(() => document.getElementById('hall-track').getBoundingClientRect().left);
        await p.evaluate(() => window.scrollBy({ top: document.getElementById('hall').offsetHeight - window.innerHeight - 10, behavior: 'instant' }));
        await p.waitForTimeout(250);
        const last = await p.evaluate(() => { const r = document.querySelector('#hall-track figure:last-child').getBoundingClientRect(); return { left: r.left, right: r.right, vw: window.innerWidth }; });
        assert.ok(last.right <= last.vw + 2 && last.right > last.vw * 0.5, JSON.stringify(last));
        assert.ok(x0 > -40, `start ${x0}`);
      });
      await step(`${tag} morning: the mist lifts as you scroll`, async () => {
        await scrollToId(p, 'morning', 5); await p.waitForTimeout(250);
        const a = await p.evaluate(() => +getComputedStyle(document.querySelector('.mist--a')).opacity);
        await p.evaluate(() => window.scrollBy({ top: document.getElementById('morning').offsetHeight - window.innerHeight - 20, behavior: 'instant' }));
        await p.waitForTimeout(250);
        const b2 = await p.evaluate(() => +getComputedStyle(document.querySelector('.mist--a')).opacity);
        assert.ok(a > 0.9 && b2 < 0.05, `${a} -> ${b2}`);
      });
    } else {
      await step(`${tag} static: no tunnel zoom, mist already lifted, hall scrolls natively`, async () => {
        assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.mist--a')).opacity), '0');
        assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.pan__stage')).overflowX), 'auto');
      });
    }
    await step(`${tag} chapters update the header clock${w >= 1400 ? ' and the time rail' : ''}`, async () => {
      await scrollToId(p, 'bar', 200); await p.waitForTimeout(400);
      assert.equal(await p.textContent('.hdr__now-t'), '19:00');
      if (w >= 1400) assert.equal(await p.getAttribute('[data-rail="bar"]', 'aria-current'), 'step');
      await scrollToId(p, 'library', 200); await p.waitForTimeout(400);
      assert.equal(await p.textContent('.hdr__now-t'), '22:00');
    });
    if (w >= 1400) {
      await step(`${tag} time rail jumps to the chosen time`, async () => {
        await p.click('[data-rail="morning"]');
        await p.waitForTimeout(1500);
        const top = await p.evaluate(() => document.getElementById('morning').getBoundingClientRect().top);
        assert.ok(Math.abs(top) < 120, `morning top ${top}`);
      });
    }
    await step(`${tag} "Choose this room" preselects the Tower Suite`, async () => {
      await scrollToId(p, 'rooms', 200); await p.waitForTimeout(300);
      await p.click('a[data-room="tower"]');
      assert.equal(await p.isChecked('input[name="room"][value="tower"]'), true);
      assert.match(await p.textContent('#card-main'), /Tower Suite/);
      assert.match(await p.textContent('#card-sum'), /€620/);
    });
    await step(`${tag} booking: errors for missing name and email, then capacity check`, async () => {
      await p.click('#stay-form button[type=submit]');
      assert.equal(await p.isVisible('#g-name-err'), true);
      assert.equal(await p.isVisible('#g-email-err'), true);
      await p.fill('#g-name', 'Lena Hoffmann');
      await p.fill('#g-email', 'lena@example.org');
      await p.check('input[name="room"][value="valley"]', { force: true });
      await p.click('.stepper__btn[data-step-dir="1"]');
      assert.equal(await p.textContent('#s-guests'), '3');
      assert.equal(await p.isVisible('#s-guests-max'), true);
      await p.click('#stay-form button[type=submit]');
      assert.match(await p.textContent('#s-out-err'), /sleeps 2/);
      await p.click('.stepper__btn[data-step-dir="-1"]');
    });
    await step(`${tag} booking: fully booked 24 Dec offers working alternative dates`, async () => {
      const y = new Date().getFullYear();
      await p.fill('#s-in', `${y}-12-23`); await p.dispatchEvent('#s-in', 'change');
      await p.fill('#s-out', `${y}-12-25`); await p.dispatchEvent('#s-out', 'change');
      await p.click('#stay-form button[type=submit]');
      assert.equal(await p.isVisible('#soldout'), true);
      assert.match(await p.textContent('#soldout-text'), /24 December/);
      await p.click('#soldout-alt');
      assert.equal(await p.inputValue('#s-in'), `${y}-12-25`);
      assert.equal(await p.isVisible('#soldout'), false);
    });
    await step(`${tag} booking: totals add the tourist tax`, async () => {
      await p.fill('#s-in', iso(add(10))); await p.dispatchEvent('#s-in', 'change');
      await p.fill('#s-out', iso(add(13))); await p.dispatchEvent('#s-out', 'change');
      // Valley Room €280 x 3 nights + €4 x 2 adults x 3 nights = €864
      assert.match(await p.textContent('#card-sum'), /€864/);
    });
    await step(`${tag} booking: Cancel keeps the form; offline fails; retry gives a reference`, async () => {
      await p.click('#stay-form button[type=submit]');
      assert.equal(await p.isVisible('#confirm'), true);
      assert.match(await p.textContent('#confirm-body'), /€864/);
      if (w === 390) await p.screenshot({ path: `${out}/${tag}-confirm.png` });
      await p.click('[data-confirm="cancel"]');
      assert.equal(await p.isVisible('#confirm'), false);
      assert.equal(await p.inputValue('#g-name'), 'Lena Hoffmann');
      await ctx.setOffline(true);
      await p.click('#stay-form button[type=submit]');
      await p.click('[data-confirm="ok"]');
      await p.waitForSelector('[data-net-error]:not([hidden])', { timeout: 3000 });
      await ctx.setOffline(false);
      await p.click('#stay-form button[type=submit]');
      await p.click('[data-confirm="ok"]');
      await p.waitForSelector('#stay-done:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#done-summary'), /AEG-\d{5}/);
      await p.locator('#stay').screenshot({ path: `${out}/${tag}-done.png` });
    });
    if (w < 1024) {
      await step(`${tag} mobile menu lists the day by time and closes on a link`, async () => {
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.click('.menu-btn');
        assert.equal(await p.isVisible('#mmenu'), true);
        assert.match(await p.textContent('#mmenu nav'), /06:40/);
        await p.click('#mmenu nav a[href="#library"]');
        assert.equal(await p.isVisible('#mmenu'), false);
      });
    }
    await step(`${tag} no JS errors`, async () => assert.deepEqual(errs, []));
    await ctx.close();
  }
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
