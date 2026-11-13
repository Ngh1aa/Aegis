/* Browser checks for the Aegis site (Playwright). Run:
 *   NODE_PATH=<folder with playwright>/node_modules node tests/flow.test.cjs [shots-dir]
 * The script serves the repo itself over http://127.0.0.1 (sessionStorage needs a real origin to carry data
 * between pages). There is no server behind the site: bookings, tables and spa slots live in sessionStorage. */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

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
/* Click a day in a calendar host, paging forward until the month that holds it is shown */
const pickDay = async (p, host, d) => {
  const sel = `${host} [data-day="${iso(d)}"]`;
  for (let i = 0; i < 14 && !(await p.$(sel)); i++) await p.click(`${host} [data-cal="next"]`);
  await p.click(sel);
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const b = await chromium.launch();

  /* ===== Home: the scroll story and the planner, in three set-ups ===== */
  for (const [w, h, scheme, motion] of [[1440, 900, 'light', 'no-preference'], [390, 844, 'dark', 'no-preference'], [1280, 900, 'light', 'reduce']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: motion });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(base + 'index.html');
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
    await step(`${tag} planner: capacity check and the family-room hint`, async () => {
      await p.check('input[name="room"][value="valley"]', { force: true });
      await p.click('.stepper__btn[data-step-dir="1"]');
      assert.equal(await p.textContent('#s-guests'), '3');
      assert.equal(await p.isVisible('#s-guests-max'), true);
      await p.click('#stay-form button[type=submit]');
      assert.match(await p.textContent('#s-out-err'), /sleeps 2/);
      await p.click('.stepper__btn[data-step-dir="-1"]');
    });
    await step(`${tag} planner: fully booked 24 Dec offers working alternative dates`, async () => {
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
    await step(`${tag} planner: totals add the tourist tax`, async () => {
      await p.fill('#s-in', iso(add(10))); await p.dispatchEvent('#s-in', 'change');
      await p.fill('#s-out', iso(add(13))); await p.dispatchEvent('#s-out', 'change');
      // Valley Room €280 x 3 nights + €4 x 2 adults x 3 nights = €864
      assert.match(await p.textContent('#card-sum'), /€864/);
    });
    await step(`${tag} planner hands off to the booking flow with its values`, async () => {
      await p.click('#stay-form button[type=submit]');
      await p.waitForURL(/book\.html/);
      await p.waitForSelector('[data-step="room"]:not([hidden])');
      assert.equal(await p.isChecked('input[name="room"][value="valley"]'), true);
      assert.match(await p.textContent('#card-ctx'), /2 adults/);
      assert.match(await p.textContent('#card-sum'), /€864/);
      await p.goBack(); await p.waitForURL(/index\.html/);
    });
    if (w < 1024) {
      await step(`${tag} mobile menu lists the pages and the day by time, and closes on a link`, async () => {
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.click('.menu-btn');
        assert.equal(await p.isVisible('#mmenu'), true);
        assert.match(await p.textContent('#mmenu .mmenu__main'), /My stay/);
        assert.match(await p.textContent('#mmenu .mmenu__day'), /06:40/);
        await p.click('#mmenu nav a[href="#library"]');
        assert.equal(await p.isVisible('#mmenu'), false);
      });
    }
    await step(`${tag} no JS errors`, async () => assert.deepEqual(errs, []));
    await ctx.close();
  }

  /* ===== Inner pages: the flows end to end, at desktop and phone width ===== */
  for (const [w, h, scheme] of [[1440, 900, 'light'], [390, 844, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const tag = `${w}-${scheme}`;
    const go = (u) => p.goto(base + u, { waitUntil: 'load' });
    let ref = '';

    await step(`${tag} rooms: filters narrow the list, keep state in the URL, and empty state clears`, async () => {
      await go('rooms.html');
      assert.equal(await p.locator('#room-list .rcard').count(), 6);
      await p.click('#f-guests button[aria-label="More guests"]');
      await p.click('#f-guests button[aria-label="More guests"]');
      assert.equal(await p.locator('#room-list .rcard').count(), 3); // sleeps >= 3
      await p.check('input[name="view"][value="valley"]', { force: true });
      assert.equal(await p.locator('#room-list .rcard').count(), 2); // Balcony, Tower
      await p.selectOption('#f-max', '400');
      assert.equal(await p.locator('#room-list .rcard').count(), 1);
      assert.match(await p.textContent('#f-count'), /1 room/);
      assert.match(p.url(), /guests=3/);
      await p.check('input[name="view"][value="cliffs"]', { force: true });
      assert.equal(await p.isVisible('#room-empty'), true);
      await p.click('#room-empty [data-clear]');
      assert.equal(await p.locator('#room-list .rcard').count(), 6);
      await p.check('input[name="view"][value="valley"]', { force: true });
      await p.selectOption('#f-max', '400');
    });
    await step(`${tag} rooms: detail page opens the right room, gallery switches, Back keeps filters`, async () => {
      await p.click('#room-list .rcard__name a[href="room.html?id=balcony"]');
      await p.waitForURL(/room\.html\?id=balcony/);
      assert.equal(await p.textContent('#room-name'), 'Balcony Room');
      assert.match(await p.textContent('#room-price'), /€360/);
      await p.click('#room-thumbs .thumb:nth-child(2)');
      assert.match(await p.getAttribute('#room-photo', 'src'), /valley\.jpg/);
      assert.match(await p.getAttribute('#back-rooms', 'href'), /view=valley/);
      if (w === 390) await p.screenshot({ path: `${out}/${tag}-room.png`, fullPage: true });
    });
    await step(`${tag} rooms: unknown id shows the not-found state`, async () => {
      await go('room.html?id=penthouse');
      assert.equal(await p.isVisible('#room-missing'), true);
      assert.equal(await p.isVisible('#room-view'), false);
      await go('room.html?id=balcony');
    });
    await step(`${tag} book: "Book this room" opens the flow with the room preselected; past days are disabled`, async () => {
      await p.click('#room-book');
      await p.waitForURL(/book\.html/);
      assert.equal(await p.isVisible('[data-step="dates"]'), true);
      assert.match(await p.textContent('#card-main'), /Balcony Room/);
      assert.equal(await p.isDisabled('#to-room'), true);
      assert.match(await p.textContent('#dates-reason'), /check-in/);
      const past = add(-1);
      if (past.getMonth() === new Date().getMonth()) assert.equal(await p.isDisabled(`#cal [data-day="${iso(past)}"]`), true);
    });
    await step(`${tag} book: sold-out nights are disabled and a stay cannot cross them`, async () => {
      assert.equal(await p.isDisabled(`#cal [data-day="${iso(add(4))}"]`), true);
      assert.match(await p.getAttribute(`#cal [data-day="${iso(add(4))}"]`, 'aria-label'), /sold out/);
      await pickDay(p, '#cal', add(2));
      assert.equal(await p.isDisabled(`#cal [data-day="${iso(add(6))}"]`), true); // would cross nights 4 and 5
      await pickDay(p, '#cal', add(4 - 1)); // check-out on the 3rd: fine
      assert.equal(await p.isDisabled('#to-room'), false);
    });
    await step(`${tag} book: room prices react to the nights chosen; capacity blocks small rooms`, async () => {
      await pickDay(p, '#cal', add(20));
      await pickDay(p, '#cal', add(23));
      assert.match(await p.textContent('#p-n'), /^3$/);
      await p.click('#b-guests button[aria-label="More guests"]'); // 3 adults
      await p.click('#to-room');
      assert.match(await p.textContent('#ropts'), /€1,080/); // Balcony 3 x 360
      assert.equal(await p.isDisabled('input[name="room"][value="valley"]'), true);
      assert.match(await p.textContent('.ropt:has(input[value="tower"])'), /Not available/); // tower taken on night +21
      assert.equal(await p.isChecked('input[name="room"][value="balcony"]'), true);
    });
    await step(`${tag} book: Back steps return to dates, then forward again`, async () => {
      await p.click('[data-step="room"] [data-back]');
      assert.equal(await p.isVisible('[data-step="dates"]'), true);
      await p.click('#to-room');
      assert.equal(await p.isVisible('[data-step="room"]'), true);
      await p.goBack();
      assert.equal(await p.isVisible('[data-step="dates"]'), true);
      await p.goForward();
      await p.waitForSelector('[data-step="room"]:not([hidden])');
    });
    await step(`${tag} book: extras add to the total`, async () => {
      await p.click('#to-extras');
      await p.check('#xopts input[value="dinner"]', { force: true });
      await p.check('#xopts input[value="transfer"]', { force: true });
      // 1080 + dinner 58x3x3=522 + transfer 60 + tax 4x3x3=36 = 1698
      assert.match(await p.textContent('#card-sum'), /€1,698/);
    });
    await step(`${tag} book: guest details validate inline`, async () => {
      await p.click('#to-details');
      await p.click('#details button[type=submit]');
      assert.equal(await p.isVisible('#d-first-err'), true);
      assert.equal(await p.isVisible('#d-email-err'), true);
      await p.fill('#d-first', 'Lena');
      await p.fill('#d-last', 'Hoffmann');
      await p.fill('#d-email', 'lena@example');
      await p.locator('#d-email').blur();
      assert.match(await p.textContent('#d-email-err'), /valid email/);
      await p.fill('#d-email', 'lena.hoffmann@hoffmann-studio.ch');
      assert.equal(await p.isVisible('#d-email-err'), false);
      await p.fill('#d-phone', '12');
      await p.click('#details button[type=submit]');
      assert.equal(await p.isVisible('#d-phone-err'), true);
      await p.fill('#d-phone', '+41 79 555 01 23');
      await p.click('#details button[type=submit]');
      assert.equal(await p.isVisible('[data-step="review"]'), true);
    });
    await step(`${tag} book: review needs the terms; Cancel keeps it; offline fails; retry saves a reference`, async () => {
      assert.match(await p.textContent('#review'), /Lena Hoffmann/);
      assert.match(await p.textContent('#review'), /€1,698/);
      if (w === 390) await p.screenshot({ path: `${out}/${tag}-review.png`, fullPage: true });
      await p.click('#confirm-booking');
      assert.equal(await p.isVisible('#terms-err'), true);
      await p.check('#terms', { force: true });
      await p.click('#confirm-booking');
      assert.equal(await p.isVisible('.dialog'), true);
      assert.match(await p.textContent('.dialog'), /€1,698/);
      await p.click('[data-dlg="cancel"]');
      assert.equal(await p.isVisible('.dialog'), false);
      assert.equal(await p.isVisible('[data-step="review"]'), true);
      await ctx.setOffline(true);
      await p.click('#confirm-booking'); await p.click('[data-dlg="ok"]');
      await p.waitForSelector('#net-error:not([hidden])', { timeout: 3000 });
      await ctx.setOffline(false);
      await p.click('#confirm-booking'); await p.click('[data-dlg="ok"]');
      await p.waitForSelector('[data-step="done"]:not([hidden])', { timeout: 3000 });
      const sum = await p.textContent('#done-summary');
      ref = sum.match(/AEG-\d{5}/)[0];
      assert.match(await p.textContent('#t-done'), /Your stay is confirmed/);
      assert.match(await p.textContent('#done-note'), new RegExp(`Reference ${ref}\\. We’ve emailed the details to lena\\.hoffmann@hoffmann-studio\\.ch`));
      assert.match(await p.textContent('#done-note'), /pay at the hotel/);
      await p.screenshot({ path: `${out}/${tag}-booking-done.png`, fullPage: w === 390 });
    });
    await step(`${tag} my stay: lookup rejects a wrong surname, then finds the booking`, async () => {
      await p.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('aegis-demo-v1')); s.active = null; sessionStorage.setItem('aegis-demo-v1', JSON.stringify(s)); });
      await go('stay.html');
      assert.equal(await p.isVisible('#lookup'), true);
      await p.click('#lookup-form button[type=submit]');
      assert.equal(await p.isVisible('#l-ref-err'), true);
      await p.fill('#l-ref', ref);
      await p.fill('#l-last', 'Schmidt');
      await p.click('#lookup-form button[type=submit]');
      assert.equal(await p.isVisible('#l-none'), true);
      await p.fill('#l-last', 'hoffmann');
      await p.click('#lookup-form button[type=submit]');
      assert.equal(await p.isVisible('#booking'), true);
      assert.match(await p.textContent('#b-summary'), new RegExp(ref));
      assert.match(await p.textContent('#b-badge'), /Confirmed/);
    });
    await step(`${tag} my stay: change dates shows the new total, confirms and saves`, async () => {
      await p.click('#b-change');
      assert.equal(await p.isDisabled('#change-save'), true);
      await pickDay(p, '#change-cal', add(33));
      assert.equal(await p.isDisabled('#change-save'), true); // check-out still missing
      assert.match(await p.textContent('#change-reason'), /check-out/);
      await pickDay(p, '#change-cal', add(35));
      // 2 nights: 720 + dinner 58x3x2=348 + transfer 60 + tax 24 = 1152
      assert.match(await p.textContent('#change-sum'), /€1,152/);
      await p.click('#change-save');
      assert.match(await p.textContent('.dialog'), /€1,152/);
      await p.click('[data-dlg="ok"]');
      await p.waitForSelector('#b-status:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#b-status'), /Dates changed/);
      assert.match(await p.textContent('#b-summary'), /€1,152/);
      assert.equal(await p.isVisible('#change'), false);
    });
    await step(`${tag} dining: menus switch; table reservation needs a time, then saves`, async () => {
      await go('dining.html');
      await p.click('#tab-dinner');
      assert.equal(await p.isVisible('#panel-dinner'), true);
      assert.match(await p.textContent('#panel-dinner'), /Venison/);
      await pickDay(p, '#t-cal', add(33));
      assert.equal(await p.inputValue('#t-name'), 'Lena Hoffmann'); // prefilled from the open booking
      await p.click('#t-submit');
      assert.equal(await p.isVisible('#t-slot-err'), true);
      await p.locator('#t-slots label:not(.is-off)').first().click();
      await p.click('#t-party button[aria-label="More people"]');
      await p.click('#t-submit');
      await p.waitForSelector('#t-done:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#t-summary'), /TBL-\d{5}/);
      assert.match(await p.textContent('#t-summary'), /3 people/);
      assert.match(await p.textContent('#t-done'), /Your table is reserved/);
      assert.match(await p.textContent('#t-note'), /emailed the details to lena\.hoffmann@hoffmann-studio\.ch/);
    });
    await step(`${tag} spa: choose a treatment, a day and a slot; it is added to My stay`, async () => {
      await go('spa.html');
      assert.equal(await p.isDisabled('#s-submit'), true);
      await p.click('[data-item="sauna"]');
      assert.equal(await p.getAttribute('[data-item="sauna"]', 'aria-pressed'), 'true');
      await pickDay(p, '#s-cal', add(34));
      await p.locator('#s-slots label:not(.is-off)').first().click();
      await p.click('#s-people button[aria-label="More people"]');
      assert.match(await p.textContent('#s-total'), /€160/);
      await p.click('#s-submit');
      await p.waitForSelector('#s-done:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#s-summary'), new RegExp(ref));
      await go('stay.html');
      const plans = await p.textContent('#plans');
      assert.match(plans, /Private sauna for two/);
      assert.match(plans, /Table for 3/);
      if (w === 390) await p.screenshot({ path: `${out}/${tag}-mystay.png`, fullPage: true });
    });
    await step(`${tag} my stay: cancel asks first (Keep booking leaves it), then cancels honestly`, async () => {
      await p.click('#b-cancel');
      assert.match(await p.textContent('.dialog'), /Cancellation fee/);
      await p.click('[data-dlg="cancel"]');
      assert.match(await p.textContent('#b-badge'), /Confirmed/);
      await p.click('#b-cancel');
      await p.click('[data-dlg="ok"]');
      await p.waitForSelector('#b-again:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#b-badge'), /Cancelled/);
      assert.match(await p.textContent('#b-status'), /cancelled free of charge\. We’ve emailed a confirmation/);
      assert.equal(await p.isVisible('#b-actions'), false);
    });
    await step(`${tag} data survives page changes in the tab`, async () => {
      await go('contact.html');
      await go('stay.html');
      assert.match(await p.textContent('#b-badge'), /Cancelled/);
    });
    await step(`${tag} contact: message form validates and is honest about sending`, async () => {
      await go('contact.html');
      await p.fill('#m-text', '');
      await p.click('#m-submit');
      assert.equal(await p.isVisible('#m-text-err'), true);
      await p.fill('#m-text', 'Can you hold a cot for us?');
      await p.click('#m-submit');
      await p.waitForSelector('#m-done:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#m-done'), /Reception will reply to lena\.hoffmann@hoffmann-studio\.ch/);
    });
    await step(`${tag} demo tools: hidden by default, ?demo=1 shows them, a failed request keeps the form`, async () => {
      assert.equal(await p.locator('#demo-tools').count(), 0);
      await go('contact.html?demo=1');
      assert.equal(await p.isVisible('#demo-tools'), true);
      await go('contact.html'); // the flag stays on for the tab
      assert.equal(await p.isVisible('#demo-tools'), true);
      await p.click('#demo-tools summary');
      await p.check('#demo-fail');
      await p.fill('#m-text', 'Is the sauna open on Sunday?');
      await p.click('#m-submit');
      await p.waitForSelector('#m-net:not([hidden])', { timeout: 3000 });
      assert.equal(await p.inputValue('#m-text'), 'Is the sauna open on Sunday?');
      assert.equal(await p.isChecked('#demo-fail'), false); // fails once only
      await p.click('#m-submit');
      await p.waitForSelector('#m-done:not([hidden])', { timeout: 3000 });
    });
    await step(`${tag} reset: demo tools control asks, then clears everything back to the starting booking`, async () => {
      await p.click('[data-reset]');
      assert.match(await p.textContent('.dialog'), /Bookings\s*2/);
      await p.click('[data-dlg="cancel"]');
      assert.notEqual(await p.evaluate(() => sessionStorage.getItem('aegis-demo-v1')), null);
      await p.click('[data-reset]');
      await Promise.all([p.waitForEvent('load'), p.click('[data-dlg="ok"]')]);
      assert.equal(await p.evaluate(() => sessionStorage.getItem('aegis-demo-v1')), null);
      await p.waitForSelector('#toast:not([hidden])');
      await go('stay.html');
      assert.equal(await p.isVisible('#lookup'), true);
      await p.fill('#l-ref', ref); await p.fill('#l-last', 'Hoffmann');
      await p.click('#lookup-form button[type=submit]');
      assert.equal(await p.isVisible('#l-none'), true);
      assert.match(await p.textContent('#l-hint'), /Your recent booking: AEG-48213 · Hoffmann/);
      await go('stay.html?demo=0');
      assert.equal(await p.locator('#demo-tools').count(), 0);
    });
    await step(`${tag} first visit: no prototype wording on any page, no demo tools; My stay offers the recent booking`, async () => {
      const fresh = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' });
      const q = await fresh.newPage();
      const bad = /prototype|demo|sandbox|simulat|fictional|state lab|portfolio review|mock|example/i;
      for (const u of ['index.html', 'rooms.html', 'room.html?id=tower', 'book.html', 'stay.html', 'dining.html', 'spa.html', 'contact.html', 'legal.html']) {
        await q.goto(base + u, { waitUntil: 'load' });
        const text = await q.evaluate(() => document.body.innerText + ' ' + document.title + ' ' + [...document.querySelectorAll('[aria-label],[title],[placeholder]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('placeholder')].join(' ')).join(' '));
        const m = text.match(bad);
        assert.equal(m, null, `${u}: "${m && text.slice(Math.max(0, m.index - 40), m.index + 40)}"`);
        assert.equal(await q.locator('#demo-tools').count(), 0, u);
        assert.equal(await q.locator('.ftr__concept').count(), 1, u);
        assert.match(await q.textContent('.ftr__concept'), /Concept product designed by Đỗ Anh Nghĩa\./);
        assert.equal(await q.locator('footer a[href="legal.html#credits"]').count(), 1, u);
      }
      await q.goto(base + 'stay.html', { waitUntil: 'load' });
      assert.match(await q.textContent('#l-hint'), /Your recent booking: AEG-48213 · Hoffmann/);
      await q.click('#l-hint-btn');
      assert.equal(await q.inputValue('#l-ref'), 'AEG-48213');
      await q.click('#lookup-form button[type=submit]');
      assert.equal(await q.isVisible('#booking'), true);
      assert.match(await q.textContent('#b-summary'), /Lena Hoffmann/);
      assert.match(await q.textContent('#a-ctx'), /In \d+ days/);
      await q.goto(base + 'index.html?demo=1', { waitUntil: 'load' });
      assert.equal(await q.isVisible('#demo-tools'), true);
      await fresh.close();
    });
    await step(`${tag} every link and button on every page goes somewhere`, async () => {
      for (const u of ['index.html', 'rooms.html', 'room.html?id=tower', 'book.html', 'stay.html', 'dining.html', 'spa.html', 'contact.html', 'legal.html']) {
        await go(u);
        const bad = await p.evaluate(() => [...document.querySelectorAll('a')].filter((a) => {
          const h = a.getAttribute('href');
          return !h || h === '#' || h.startsWith('javascript') || (h.startsWith('#') && !document.getElementById(h.slice(1)));
        }).map((a) => a.outerHTML.slice(0, 80)));
        assert.deepEqual(bad, [], u);
        const files = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /^[a-z]+\.html/.test(h)).map((h) => h.split(/[?#]/)[0]))]);
        files.forEach((f) => assert.ok(fs.existsSync(path.join(root, f)), `${u} links to missing ${f}`));
      }
    });
    await step(`${tag} no JS errors`, async () => assert.deepEqual(errs, []));
    await ctx.close();
  }

  await b.close();
  server.close();
  console.log(res.join('\n'));
  console.log(`\n${res.filter((r) => r.startsWith('PASS')).length}/${res.length} passed`);
  process.exit(res.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
