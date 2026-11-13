/* Spa and experiences: choose an item, a day and a free slot, then add it to the stay (sessionStorage).
 * ?item=<id> preselects an item (the home page links the whisky tasting this way). */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, $$, D, toISO, fromISO, longDate, esc, eur, plural } = A;
  const form = $('#spa-form');
  const done = $('#s-done');
  const slotsBox = $('#s-slots');
  const fName = $('#s-name'), fEmail = $('#s-email');
  const submit = $('#s-submit');
  let item = null;
  let date = A.today();
  let time = '';

  const hours = (m) => (m >= 120 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
  const row = (t) => `<li class="offer">
      <div class="offer__text"><h3>${esc(t.name)}</h3><p>${hours(t.mins)}, ${eur(t.price)} per person</p></div>
      <button class="ds-button ds-button--secondary" type="button" data-item="${t.id}" aria-pressed="false">Choose</button>
    </li>`;
  $('#list-treatment').innerHTML = D.treatments.filter((t) => t.kind === 'Treatment').map(row).join('');
  $('#list-experience').innerHTML = D.treatments.filter((t) => t.kind === 'Experience').map(row).join('');

  /* Taken slots: deterministic by date and item, plus slots already booked in this tab */
  const taken = (d, t, i) => (d.getDate() + i + t.id.length) % 4 === 0
    || A.store.get().spa.some((x) => x.item === t.id && x.date === toISO(d) && x.time === t.slots[i]);
  const renderSlots = () => {
    if (!item) { slotsBox.innerHTML = '<legend class="ds-field__label">Time</legend><p class="muted">Choose a treatment first</p>'; return; }
    slotsBox.innerHTML = '<legend class="ds-field__label">Time</legend>' + item.slots.map((s, i) => {
      const off = taken(date, item, i) || (A.sameDay(date, A.today()) && Number(s.slice(0, 2)) <= new Date().getHours());
      if (off && time === s) time = '';
      return `<label class="chip${off ? ' is-off' : ''}"><input type="radio" name="slot" value="${s}"${time === s ? ' checked' : ''}${off ? ' disabled' : ''}><span>${s}${off ? ' taken' : ''}</span></label>`;
    }).join('');
    $$('input', slotsBox).forEach((i) => i.addEventListener('change', () => { time = i.value; A.setError(slotsBox, false); summary(); }));
  };
  slotsBox.dataset.err = 's-slot-err';
  const people = A.stepper($('#s-people'), { min: 1, max: 1, value: 1, onChange: () => summary() });
  const summary = () => {
    $('#s-pick').textContent = item ? `${item.name}, ${hours(item.mins)}` : 'Choose a treatment or experience';
    $('#s-pick').classList.toggle('is-set', Boolean(item));
    if (item) A.fill($('#s-total'), [['Date', longDate(date)], ['Time', time || 'Choose a time'], ['Total', eur(item.price * people.get()), 'total'], ['Payment', 'At the hotel']]);
    else $('#s-total').replaceChildren();
    submit.disabled = !item;
    $('#s-reason').textContent = item ? '' : 'Choose a treatment or experience first';
  };
  A.calendar($('#s-cal'), { mode: 'single', maxAhead: 45, start: date, onChange: ({ start }) => { date = start; renderSlots(); summary(); } });

  const choose = (id, scroll) => {
    item = D.treatments.find((t) => t.id === id) || null;
    time = '';
    $$('[data-item]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.item === id)));
    $$('[data-item]').forEach((b) => { b.textContent = b.dataset.item === id ? 'Chosen' : 'Choose'; });
    if (item) people.setMax(item.max);
    renderSlots(); summary();
    if (done.hidden === false) { done.hidden = true; form.hidden = false; }
    if (scroll && item) {
      $('#book').scrollIntoView({ behavior: A.reduceMotion ? 'auto' : 'smooth', block: 'start' });
      const first = $('input:not([disabled])', slotsBox);
      if (first) first.focus({ preventScroll: true });
    }
  };
  $$('[data-item]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.item, window.innerWidth < 1024)));
  A.clearOnInput(form);

  const active = A.store.activeBooking();
  if (active && active.status === 'confirmed') { fName.value = `${active.first} ${active.surname}`; fEmail.value = active.email; }
  choose(A.params().get('item'), false);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!item) return;
    let first = null;
    const bad = (el, msg) => { A.setError(el, msg); if (!first) first = el.matches('fieldset') ? $('input:not([disabled])', el) || submit : el; };
    if (!time) bad(slotsBox, 'Choose a time.'); else A.setError(slotsBox, false);
    if (fName.value.trim().split(/\s+/).length < 2) bad(fName, 'Enter a first name and surname.'); else A.setError(fName, false);
    if (!A.emailOk(fEmail.value)) bad(fEmail, 'Enter a valid email, for example name@gmail.com.'); else A.setError(fEmail, false);
    if (first) { first.focus(); return; }
    $('#s-net').hidden = true;
    A.busy(submit, true);
    try {
      await A.send();
      const names = fName.value.trim().split(/\s+/);
      const b = A.store.activeBooking();
      const x = {
        ref: A.makeRef('SPA'), item: item.id, name: item.name, date: toISO(date), time, people: people.get(), total: item.price * people.get(),
        guest: fName.value.trim(), surname: names[names.length - 1], email: fEmail.value.trim(), bookingRef: b && b.status === 'confirmed' ? b.ref : null, created: new Date().toISOString(),
      };
      A.store.update((st) => { st.spa.push(x); });
      A.fill($('#s-summary'), [['Reference', x.ref], ['Booked', x.name], ['Date', longDate(fromISO(x.date))], ['Time', x.time], ['People', plural(x.people, 'person', 'people')], ['Total', eur(x.total), 'total'], ...(x.bookingRef ? [['Stay', x.bookingRef]] : [])]);
      $('#s-note').textContent = `We’ve emailed the details to ${x.email}.${x.bookingRef ? ' It is added to your stay and' : ' It is'} paid at the spa on the day.`;
      form.hidden = true; done.hidden = false;
      if (!A.reduceMotion) done.classList.add('step-enter');
      done.focus();
    } catch {
      $('#s-net').hidden = false; submit.focus();
    } finally {
      A.busy(submit, false);
      summary();
    }
  });
  $('#s-again').addEventListener('click', () => {
    done.hidden = true; form.hidden = false; time = ''; renderSlots(); summary();
    const b = $('[data-item]'); if (b) b.focus();
  });
})();
