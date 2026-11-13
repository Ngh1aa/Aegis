/* Dining: menu tabs and table reservation (date, time, party size, then a saved confirmation). */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, $$, D, toISO, fromISO, longDate, esc, plural } = A;

  /* ---------- Menus as tabs ---------- */
  const tabs = $('#menu-tabs');
  const panels = $('#menu-panels');
  tabs.innerHTML = D.menus.map((m, i) => `<button class="ds-tabs__tab" role="tab" id="tab-${m.id}" aria-controls="panel-${m.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" type="button">${esc(m.name)}</button>`).join('');
  panels.innerHTML = D.menus.map((m, i) => `<div class="ds-tabs__panel menu" role="tabpanel" id="panel-${m.id}" aria-labelledby="tab-${m.id}"${i ? ' hidden' : ''} tabindex="0">
    <p class="menu__hours">${esc(m.hours)}</p>
    ${m.sections.map((s) => `<h3 class="h3">${esc(s.name)}</h3><ul class="dishes">${s.items.map(([n, p]) => `<li><span>${esc(n)}</span><b>${esc(p)}</b></li>`).join('')}</ul>`).join('')}
  </div>`).join('');
  const select = (btn, focus) => {
    $$('[role="tab"]', tabs).forEach((t) => { const on = t === btn; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $(`#${t.getAttribute('aria-controls')}`).hidden = !on; });
    if (focus) btn.focus();
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) select(b); });
  tabs.addEventListener('keydown', (e) => {
    const all = $$('[role="tab"]', tabs); const i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowRight') select(all[(i + 1) % all.length], true);
    if (e.key === 'ArrowLeft') select(all[(i - 1 + all.length) % all.length], true);
  });

  /* ---------- Reservation ---------- */
  const form = $('#table-form');
  const done = $('#t-done');
  const slotsBox = $('#t-slots');
  const fName = $('#t-name'), fEmail = $('#t-email'), fNotes = $('#t-notes');
  let date = A.today();
  let time = '';
  // Some slots are already full, deterministically by date
  const full = (d, i) => (d.getDate() + i * 3) % 5 === 0;
  const renderSlots = () => {
    slotsBox.innerHTML = '<legend class="ds-field__label">Time</legend>' + D.tableSlots.map((t, i) => {
      const isFull = full(date, i);
      if (isFull && time === t) time = '';
      return `<label class="chip${isFull ? ' is-off' : ''}"><input type="radio" name="slot" value="${t}"${time === t ? ' checked' : ''}${isFull ? ' disabled' : ''}><span>${t}${isFull ? ' full' : ''}</span></label>`;
    }).join('');
    $$('input', slotsBox).forEach((i) => i.addEventListener('change', () => { time = i.value; A.setError(slotsBox, false); }));
  };
  slotsBox.dataset.err = 't-slot-err';
  A.calendar($('#t-cal'), { mode: 'single', maxAhead: 60, start: date, onChange: ({ start }) => { date = start; renderSlots(); } });
  const party = A.stepper($('#t-party'), { min: 1, max: D.maxParty, value: 2 });
  renderSlots();
  A.clearOnInput(form);

  // Prefill from the booking open in My stay
  const prefill = () => {
    const b = A.store.activeBooking();
    if (b && b.status === 'confirmed') { fName.value = `${b.first} ${b.surname}`; fEmail.value = b.email; }
  };
  prefill();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let first = null;
    const bad = (el, msg) => { A.setError(el, msg); if (!first) first = el.matches('fieldset') ? $('input:not([disabled])', el) : el; };
    if (!time) bad(slotsBox, 'Choose a time.'); else A.setError(slotsBox, false);
    if (fName.value.trim().split(/\s+/).length < 2) bad(fName, 'Enter a first name and surname.'); else A.setError(fName, false);
    if (!A.emailOk(fEmail.value)) bad(fEmail, 'Enter a valid email, for example name@gmail.com.'); else A.setError(fEmail, false);
    if (first) { first.focus(); return; }
    const btn = $('#t-submit');
    $('#t-net').hidden = true;
    A.busy(btn, true);
    try {
      await A.send();
      const names = fName.value.trim().split(/\s+/);
      const active = A.store.activeBooking();
      const t = {
        ref: A.makeRef('TBL'), date: toISO(date), time, party: party.get(), name: fName.value.trim(), surname: names[names.length - 1],
        email: fEmail.value.trim(), notes: fNotes.value.trim(), bookingRef: active && active.status === 'confirmed' ? active.ref : null, created: new Date().toISOString(),
      };
      A.store.update((st) => { st.tables.push(t); });
      A.fill($('#t-summary'), [['Reference', t.ref], ['Date', longDate(fromISO(t.date))], ['Time', t.time], ['Party', plural(t.party, 'person', 'people')], ['Name', t.name]]);
      $('#t-note').textContent = `We’ve emailed the details to ${t.email}.${t.bookingRef ? ` The table is added to your stay, ${t.bookingRef}.` : ''}`;
      form.hidden = true; done.hidden = false;
      if (!A.reduceMotion) done.classList.add('step-enter');
      done.focus();
    } catch {
      $('#t-net').hidden = false; btn.focus();
    } finally {
      A.busy(btn, false);
    }
  });
  $('#t-again').addEventListener('click', () => {
    done.hidden = true; form.hidden = false; time = ''; fNotes.value = ''; renderSlots();
    $('input:not([disabled])', slotsBox).focus();
  });
})();
