/* Browser flow checks (Playwright). Run:
 *   NODE_PATH=<folder with playwright>/node_modules node tests/flow.test.cjs [shots-dir]
 * Booking, availability and sending are simulated; these checks prove the interface and flow, not a backend. */
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
const nextDow = (dow, from = new Date()) => { const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); return d; };
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

(async () => {
  const b = await chromium.launch();
  for (const [w, h, scheme] of [[1280, 900, 'light'], [390, 844, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(pathToFileURL(file).href);
    const tag = `${w}-${scheme}`;
    const shot = (sel, name) => p.locator(sel).screenshot({ path: `${out}/${tag}-${name}.png` });

    await step(`${tag} "Check availability" on Aegis Cliff opens Stay with that hotel`, async () => {
      await p.click('a[data-hotel="cliff"]');
      assert.equal(await p.getAttribute('#tab-stay', 'aria-selected'), 'true');
      assert.equal(await p.inputValue('#s-hotel'), 'cliff');
      assert.match(await p.textContent('#card-main'), /Aegis Cliff/);
    });
    await step(`${tag} stay: check-out before check-in is blocked with a reason`, async () => {
      const a = nextDow(2); // a Tuesday
      await p.fill('#s-in', iso(a));
      await p.fill('#s-out', iso(add(a, -1)));
      await p.click('#stay-search button[type=submit]');
      assert.equal(await p.isVisible('#s-out-err'), true);
      assert.match(await p.textContent('#s-out-err'), /after check-in/);
    });
    await step(`${tag} stay: weekday stay lists all rooms with totals including taxes`, async () => {
      const a = nextDow(1); // Monday to Wednesday, no Saturday
      await p.fill('#s-in', iso(a)); await p.fill('#s-out', iso(add(a, 2)));
      await p.click('#stay-search button[type=submit]');
      await p.waitForSelector('#stay-rooms:not([hidden])');
      assert.equal(await p.locator('#stay-room-list .room').count(), 3);
      assert.equal(await p.locator('#stay-room-list .room.is-out').count(), 0);
      // Garden Villa 7,800,000 x 2 nights x 1.13
      assert.match(await p.textContent('#stay-room-list .room:first-child .room__total'), /17,628,000/);
    });
    await step(`${tag} stay: a Saturday night sells out the middle room with the reason`, async () => {
      await p.click('[data-stay-back="search"]');
      const sat = nextDow(6);
      await p.fill('#s-in', iso(sat)); await p.fill('#s-out', iso(add(sat, 2)));
      await p.click('#stay-search button[type=submit]');
      const mid = p.locator('#stay-room-list .room').nth(1);
      assert.match(await mid.getAttribute('class'), /is-out/);
      assert.match(await mid.textContent(), /Sold out on Saturday/);
      assert.equal(await mid.locator('button').count(), 0);
      await shot('#book', 'rooms');
    });
    await step(`${tag} stay: 4 adults hides rooms that sleep fewer, with reason`, async () => {
      await p.click('[data-stay-back="search"]');
      const plus = p.locator('#stay-search [data-step-dir="1"]');
      await plus.click(); await plus.click();
      assert.equal(await p.textContent('#s-guests'), '4');
      assert.equal(await plus.isDisabled(), true);
      assert.equal(await p.isVisible('#s-guests-max'), true);
      await p.click('#stay-search button[type=submit]');
      assert.match(await p.locator('#stay-room-list .room').first().textContent(), /Sleeps up to 2/);
      await p.click('[data-stay-back="search"]');
      const minus = p.locator('#stay-search [data-step-dir="-1"]');
      await minus.click(); await minus.click();
    });
    await step(`${tag} stay: fully booked 24 Dec offers alternative dates that work`, async () => {
      const y = new Date().getFullYear();
      await p.selectOption('#s-hotel', 'riverside');
      await p.fill('#s-in', `${y}-12-23`); await p.fill('#s-out', `${y}-12-25`);
      await p.click('#stay-search button[type=submit]');
      assert.equal(await p.isVisible('#stay-soldout'), true);
      assert.equal(await p.locator('#stay-room-list .room.is-out').count(), 3);
      await shot('#book', 'soldout');
      await p.click('#stay-alt');
      assert.equal(await p.isVisible('#stay-soldout'), false);
      assert.equal(await p.inputValue('#s-in'), `${y}-12-25`);
      assert.ok(await p.locator('#stay-room-list .room:not(.is-out)').count() >= 1);
    });
    await step(`${tag} stay: select room shows the price breakdown in the side card`, async () => {
      await p.locator('#stay-room-list .room:not(.is-out) button').first().click();
      assert.equal(await p.isVisible('#stay-details'), true);
      assert.equal(await p.isVisible('#card-sum'), true);
      assert.match(await p.textContent('#card-sum'), /VAT 8%/);
    });
    await step(`${tag} stay: details validate, Cancel in the confirm sheet keeps everything`, async () => {
      await p.click('#stay-details button[type=submit]');
      assert.equal(await p.isVisible('#g-name-err'), true);
      await p.fill('#g-name', 'Nguyễn Thị Hường');
      await p.fill('#g-email', 'huong@gmail.com');
      await p.fill('#g-phone', '0905 123 456');
      await p.click('#stay-details button[type=submit]');
      assert.equal(await p.isVisible('#confirm'), true);
      assert.match(await p.textContent('#confirm-body'), /Total with taxes/);
      await p.screenshot({ path: `${out}/${tag}-confirm.png` });
      await p.click('[data-confirm="cancel"]');
      assert.equal(await p.isVisible('#confirm'), false);
      assert.equal(await p.inputValue('#g-email'), 'huong@gmail.com');
    });
    await step(`${tag} stay: offline request fails with a banner, retry succeeds with a reference`, async () => {
      await ctx.setOffline(true);
      await p.click('#stay-details button[type=submit]');
      await p.click('[data-confirm="ok"]');
      await p.waitForSelector('#panel-stay [data-net-error]:not([hidden])', { timeout: 3000 });
      assert.equal(await p.inputValue('#g-name'), 'Nguyễn Thị Hường');
      await ctx.setOffline(false);
      await p.click('#stay-details button[type=submit]');
      await p.click('[data-confirm="ok"]');
      await p.waitForSelector('#stay-done:not([hidden])', { timeout: 3000 });
      assert.match(await p.textContent('#stay-done-summary'), /AEG-\d{5}/);
      await shot('#book', 'stay-done');
    });
    await step(`${tag} dine: "Reserve a table" at Hearth opens Dine; Monday is closed with next open day`, async () => {
      await p.click('a[data-restaurant="hearth"]');
      assert.equal(await p.getAttribute('#tab-dine', 'aria-selected'), 'true');
      assert.equal(await p.inputValue('#d-rest'), 'hearth');
      await p.fill('#d-date', iso(nextDow(1)));
      await p.dispatchEvent('#d-date', 'change');
      assert.equal(await p.isVisible('#d-closed'), true);
      assert.match(await p.textContent('#d-closed-text'), /closed on Mondays/);
      await p.click('#d-next-open');
      assert.equal(await p.isVisible('#d-closed'), false);
      assert.ok(await p.locator('#d-slots input:not(:disabled)').count() >= 1);
    });
    await step(`${tag} dine: continuing without a time is blocked; party stops at 8 with a reason`, async () => {
      await p.click('#dine-search button[type=submit]');
      assert.equal(await p.isVisible('#d-slot-err'), true);
      const plus = p.locator('#dine-search [data-step-dir="1"]');
      for (let i = 0; i < 6; i += 1) await plus.click();
      assert.equal(await p.textContent('#d-party'), '8');
      assert.equal(await plus.isDisabled(), true);
      assert.equal(await p.isVisible('#d-party-max'), true);
      const minus = p.locator('#dine-search [data-step-dir="-1"]');
      for (let i = 0; i < 4; i += 1) await minus.click();
      await shot('#book', 'dine');
    });
    await step(`${tag} dine: pick a time, details, reserve, summary matches`, async () => {
      const slot = p.locator('#d-slots .slot:has(input:not(:disabled))').first();
      const time = (await slot.textContent()).trim();
      await slot.click();
      assert.match(await p.textContent('#card-ctx'), new RegExp(time));
      await p.click('#dine-search button[type=submit]');
      assert.equal(await p.isVisible('#dine-details'), true);
      await p.fill('#r-name', 'Phạm Quốc Bảo');
      await p.fill('#r-phone', '12');
      await p.click('#dine-details button[type=submit]');
      assert.equal(await p.isVisible('#r-phone-err'), true);
      await p.fill('#r-phone', '0912345678');
      await p.click('#dine-details button[type=submit]');
      await p.waitForSelector('#dine-done:not([hidden])', { timeout: 3000 });
      const sum = await p.textContent('#dine-done-summary');
      assert.match(sum, new RegExp(time)); assert.match(sum, /4 people/); assert.match(sum, /TBL-\d{5}/);
    });
    await step(`${tag} newsletter: consent required, then success`, async () => {
      await p.fill('#n-email', 'bao@yahoo.com');
      await p.click('#news-form button[type=submit]');
      assert.equal(await p.isVisible('#n-consent-err'), true);
      await p.check('#n-consent', { force: true });
      await p.click('#news-form button[type=submit]');
      await p.waitForSelector('#news-done:not([hidden])', { timeout: 3000 });
    });
    if (w < 1024) {
      await step(`${tag} mobile menu: open, Esc closes, a link closes it`, async () => {
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.click('.menu-btn');
        assert.equal(await p.isVisible('#mmenu'), true);
        await p.keyboard.press('Escape');
        assert.equal(await p.isVisible('#mmenu'), false);
        await p.click('.menu-btn');
        await p.click('#mmenu nav a[href="#hotels"]');
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
