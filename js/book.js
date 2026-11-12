/* Booking flow: dates and guests, room, extras, guest details, review, confirmation.
 * Values arrive from the home planner or a room page as ?room=&in=&out=&guests=.
 * The draft is kept in sessionStorage so leaving the page and coming back keeps it.
 * Each step is a history entry (?step=), so the browser Back button moves one step back. */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, $$, D, toISO, fromISO, shortDate, longDate, eur, plural, esc } = A;
  const ORDER = ['dates', 'room', 'extras', 'details', 'review'];
  const blank = () => ({ in: null, out: null, guests: 2, room: null, extras: [], first: '', last: '', email: '', phone: '', arrival: '', notes: '' });

  /* ---------- State: draft from the store, then handoff values from the URL ---------- */
  const q = A.params();
  let s = { ...blank(), ...(A.store.get().draft || {}) };
  let handoff = false;
  let notice = '';
  if (q.has('room') || q.has('in') || q.has('guests')) {
    handoff = true;
    if (A.room(q.get('room'))) s.room = q.get('room');
    const g = Number(q.get('guests'));
    if (g >= 1 && g <= D.maxGuests) s.guests = g;
    const inD = fromISO(q.get('in')), outD = fromISO(q.get('out'));
    if (inD && outD) {
      const n = A.nightsBetween(inD, outD);
      const bad = inD < A.today() || n < 1 || n > D.maxNights;
      const full = !bad && A.blockedNight(inD, outD);
      if (full) notice = `Aegis is fully booked on ${longDate(full)}. Choose other dates.`;
      if (!bad && !full) { s.in = q.get('in'); s.out = q.get('out'); }
      else { s.in = null; s.out = null; }
    }
  }
  const save = () => A.store.update((st) => { st.draft = s; });
  const dates = () => ({ inD: fromISO(s.in), outD: fromISO(s.out) });
  const quote = () => { const { inD, outD } = dates(); return A.quote({ roomId: s.room, inD, outD, guests: s.guests, extras: s.extras }); };

  /* Draft dates may have gone stale (in the past, or now sold out) */
  (() => { const { inD, outD } = dates(); if (inD && (inD < A.today() || !outD || A.blockedNight(inD, outD))) { s.in = null; s.out = null; } })();

  /* ---------- Rules for moving forward ---------- */
  const roomProblem = (r) => {
    const { inD, outD } = dates();
    if (r.sleeps < s.guests) return `Sleeps ${r.sleeps}`;
    if (inD && outD && A.blockedNight(inD, outD, r.id)) return 'Not available on these dates';
    return '';
  };
  const datesOk = () => { const { inD, outD } = dates(); return Boolean(inD && outD && outD > inD); };
  const roomOk = () => datesOk() && A.room(s.room) && !roomProblem(A.room(s.room));
  const detailsOk = () => roomOk() && s.first.trim() && s.last.trim() && A.emailOk(s.email) && phoneOk(s.phone);
  const phoneOk = (v) => !v.trim() || v.replace(/\D/g, '').length >= 7;
  const reachable = (step) => ({ dates: true, room: datesOk(), extras: roomOk(), details: roomOk(), review: detailsOk() }[step]);

  /* ---------- Sidebar ---------- */
  const card = () => {
    const qq = quote();
    const { inD, outD } = dates();
    $('#card-main').textContent = qq.r ? qq.r.name : 'Choose a room';
    const sum = $('#card-sum');
    if (!qq.n) { $('#card-ctx').textContent = 'Choose dates to see the total'; sum.hidden = true; return; }
    $('#card-ctx').textContent = `${shortDate(inD)} to ${shortDate(outD)}, ${plural(s.guests, 'adult', 'adults')}`;
    if (!qq.r) { sum.hidden = true; return; }
    A.fill(sum, [
      [`${plural(qq.n, 'night', 'nights')} × ${eur(qq.r.price)}`, eur(qq.roomSum)],
      ...qq.lines.map((l) => [l.name, eur(l.sum)]),
      ['Tourist tax', eur(qq.tax)],
      ['Total', eur(qq.total), 'total'],
    ]);
    sum.hidden = false;
  };

  /* ---------- Step 1: dates and guests ---------- */
  const toRoom = $('#to-room');
  const datesStep = () => {
    const { inD, outD } = dates();
    $('#p-in').textContent = inD ? shortDate(inD) : 'Choose a date';
    $('#p-out').textContent = outD ? shortDate(outD) : 'Choose a date';
    $('#p-n').textContent = inD && outD ? String(A.nightsBetween(inD, outD)) : '0';
    toRoom.disabled = !datesOk();
    $('#dates-reason').textContent = !inD ? 'Choose a check-in date' : !outD ? 'Choose a check-out date' : '';
    card();
  };
  const cal = A.calendar($('#cal'), {
    mode: 'range', start: fromISO(s.in), end: fromISO(s.out),
    onChange: ({ start, end }) => {
      s.in = start ? toISO(start) : null; s.out = end ? toISO(end) : null;
      $('#dates-note').hidden = true;
      save(); datesStep();
    },
  });
  A.stepper($('#b-guests'), { min: 1, max: D.maxGuests, value: s.guests, onChange: (v) => { s.guests = v; save(); card(); } });
  if (notice) { $('#dates-note-text').textContent = notice; $('#dates-note').hidden = false; }
  toRoom.addEventListener('click', () => go('room'));

  /* ---------- Step 2: room ---------- */
  const roomStep = () => {
    const { inD, outD } = dates();
    const n = A.nightsBetween(inD, outD);
    $('#ropts').innerHTML = '<legend class="ds-visually-hidden">Room</legend>' + D.rooms.map((r) => {
      const why = roomProblem(r);
      const g = r.gallery[0];
      return `<label class="ropt${why ? ' is-off' : ''}">
        <input type="radio" name="room" value="${r.id}"${s.room === r.id && !why ? ' checked' : ''}${why ? ' disabled' : ''}>
        <span class="ropt__body">
          <img src="${g.src}" width="${g.w}" height="${g.h}" alt="" loading="lazy">
          <span class="ropt__text"><b>${esc(r.name)}</b><small>${r.size} m², ${esc(r.beds.toLowerCase())}, sleeps ${r.sleeps}</small></span>
          <span class="ropt__price">${why ? `<small class="ropt__why">${why}</small>` : `<b>${eur(r.price * n)}</b><small>${plural(n, 'night', 'nights')} × ${eur(r.price)}</small>`}</span>
        </span></label>`;
    }).join('');
    if (s.room && roomProblem(A.room(s.room))) s.room = null;
    $$('input[name="room"]', $('#ropts')).forEach((i) => i.addEventListener('change', () => { s.room = i.value; save(); roomGate(); card(); }));
    roomGate();
  };
  const roomGate = () => {
    $('#to-extras').disabled = !roomOk();
    $('#room-reason').textContent = roomOk() ? '' : 'Choose a room to continue';
  };
  $('#to-extras').addEventListener('click', () => go('extras'));

  /* ---------- Step 3: extras ---------- */
  const extrasStep = () => {
    const qq = quote();
    $('#xopts').innerHTML = '<legend class="ds-visually-hidden">Extras</legend>' + D.extras.map((x) => `<label class="xopt">
      <input type="checkbox" value="${x.id}"${s.extras.includes(x.id) ? ' checked' : ''}>
      <span class="ds-check__box">${A.icon('check')}</span>
      <span class="xopt__text"><b>${esc(x.name)}</b><small>${eur(x.price)} ${A.extraUnit(x)}</small></span>
      <span class="xopt__sum">${eur(A.extraCost(x, s.guests, qq.n))}</span></label>`).join('');
    $$('input', $('#xopts')).forEach((i) => i.addEventListener('change', () => {
      s.extras = $$('input:checked', $('#xopts')).map((c) => c.value); save(); card();
    }));
  };
  $('#to-details').addEventListener('click', () => go('details'));

  /* ---------- Step 4: details with inline validation ---------- */
  const form = $('#details');
  const fields = { first: $('#d-first'), last: $('#d-last'), email: $('#d-email'), phone: $('#d-phone'), arrival: $('#d-arrival'), notes: $('#d-notes') };
  const checks = {
    first: (v) => (v.trim() ? '' : 'Enter a first name.'),
    last: (v) => (v.trim() ? '' : 'Enter a surname.'),
    email: (v) => (!v.trim() ? 'Enter an email address.' : A.emailOk(v) ? '' : 'Enter a valid email, for example name@gmail.com.'),
    phone: (v) => (phoneOk(v) ? '' : 'Enter a phone number with at least 7 digits.'),
  };
  Object.entries(fields).forEach(([k, el]) => {
    el.value = s[k] || '';
    el.addEventListener('input', () => {
      s[k] = el.value; save();
      if (checks[k] && el.getAttribute('aria-invalid') === 'true') A.setError(el, checks[k](el.value) || false);
    });
    if (checks[k]) el.addEventListener('blur', () => { if (el.value || el.dataset.touched) A.setError(el, checks[k](el.value) || false); el.dataset.touched = '1'; });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let first = null;
    Object.entries(checks).forEach(([k, fn]) => { const msg = fn(fields[k].value); A.setError(fields[k], msg || false); if (msg && !first) first = fields[k]; });
    if (first) { first.focus(); return; }
    go('review');
  });

  /* ---------- Step 5: review and confirm ---------- */
  const reviewStep = () => {
    const qq = quote();
    const { inD, outD } = dates();
    const block = (title, step, rows) => `<div class="review__group"><div class="review__head"><h3>${title}</h3><button class="ds-button ds-button--tertiary ds-button--sm" type="button" data-edit="${step}">Edit ${title.toLowerCase()}</button></div><dl class="summary">${rows.map(([k, v, c]) => `<dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${esc(v)}</dd>`).join('')}</dl></div>`;
    $('#review').innerHTML = [
      block('Dates', 'dates', [['Check-in', longDate(inD)], ['Check-out', longDate(outD)], ['Guests', plural(s.guests, 'adult', 'adults')]]),
      block('Room', 'room', [['Room', qq.r.name], [`${plural(qq.n, 'night', 'nights')} × ${eur(qq.r.price)}`, eur(qq.roomSum)]]),
      block('Extras', 'extras', qq.lines.length ? qq.lines.map((l) => [l.name, eur(l.sum)]) : [['Extras', 'None']]),
      block('Guest', 'details', [['Name', `${s.first.trim()} ${s.last.trim()}`], ['Email', s.email.trim()], ...(s.phone.trim() ? [['Phone', s.phone.trim()]] : []), ['Arrival', s.arrival || 'Not sure yet'], ...(s.notes.trim() ? [['Requests', s.notes.trim()]] : [])]),
      `<div class="review__group"><h3>Price</h3><dl class="summary"><dt>Tourist tax</dt><dd>${eur(qq.tax)}</dd><dt>Total</dt><dd class="total">${eur(qq.total)}</dd><dt>Payment</dt><dd>At the hotel</dd></dl></div>`,
    ].join('');
    $$('[data-edit]', $('#review')).forEach((b) => b.addEventListener('click', () => go(b.dataset.edit)));
  };
  const terms = $('#terms');
  terms.addEventListener('change', () => { if (terms.checked) A.setError(terms, false); });
  const confirmBtn = $('#confirm-booking');
  confirmBtn.addEventListener('click', async () => {
    if (!terms.checked) { A.setError(terms, 'Accept the booking terms to continue.'); terms.focus(); return; }
    const qq = quote();
    const { inD, outD } = dates();
    const ok = await A.confirmDialog({
      title: 'Confirm booking?',
      rows: [['Room', qq.r.name], ['Dates', `${shortDate(inD)} to ${shortDate(outD)}`], ['Guests', plural(s.guests, 'adult', 'adults')], ['Total', eur(qq.total), 'total'], ['Payment', 'At the hotel']],
      ok: 'Confirm booking',
    });
    if (!ok) return;
    $('#net-error').hidden = true;
    A.busy(confirmBtn, true);
    try {
      await A.send();
      const b = {
        ref: A.makeRef('AEG'), status: 'confirmed', created: new Date().toISOString(),
        room: s.room, in: s.in, out: s.out, guests: s.guests, extras: [...s.extras],
        first: s.first.trim(), surname: s.last.trim(), email: s.email.trim(), phone: s.phone.trim(), arrival: s.arrival, notes: s.notes.trim(),
        total: qq.total, history: [{ at: new Date().toISOString(), what: 'Booked' }],
      };
      A.store.update((st) => { st.bookings.push(b); st.active = b.ref; st.draft = null; });
      showDone(b);
    } catch {
      $('#net-error').hidden = false;
      confirmBtn.focus();
    } finally {
      A.busy(confirmBtn, false);
    }
  });

  const showDone = (b) => {
    const qq = A.quote({ roomId: b.room, inD: fromISO(b.in), outD: fromISO(b.out), guests: b.guests, extras: b.extras });
    A.fill($('#done-summary'), [
      ['Reference', b.ref], ['Name', `${b.first} ${b.surname}`], ['Room', qq.r.name],
      ['Dates', `${shortDate(fromISO(b.in))} to ${shortDate(fromISO(b.out))}`], ['Guests', plural(b.guests, 'adult', 'adults')],
      ['Extras', qq.lines.length ? qq.lines.map((l) => l.name).join(', ') : 'None'], ['Total', eur(b.total), 'total'], ['Payment', 'At the hotel'],
    ]);
    $('#done-manage').href = `stay.html?ref=${encodeURIComponent(b.ref)}`;
    show('done');
    $('#steps').hidden = true;
    history.replaceState({ step: 'done', ref: b.ref }, '', `?step=done&ref=${encodeURIComponent(b.ref)}`);
    const sec = $('[data-step="done"]');
    if (!A.reduceMotion) sec.classList.add('step-enter');
    sec.focus({ preventScroll: true });
    const top = $('.book__main').getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  };

  /* ---------- Navigation between steps ---------- */
  const show = (step) => {
    $$('.step').forEach((el) => { el.hidden = el.dataset.step !== step; });
    $$('#steps [data-goto]').forEach((b) => {
      const st = b.dataset.goto;
      b.disabled = !reachable(st);
      if (st === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.parentElement.classList.toggle('is-done', ORDER.indexOf(st) < ORDER.indexOf(step));
    });
  };
  const enter = { dates: datesStep, room: roomStep, extras: extrasStep, details: () => {}, review: reviewStep };
  function go(step, push = true) {
    let st = ORDER.includes(step) ? step : 'dates';
    while (!reachable(st)) st = ORDER[ORDER.indexOf(st) - 1];
    enter[st]();
    card();
    show(st);
    if (push) history.pushState({ step: st }, '', `?step=${st}`);
    const sec = $(`[data-step="${st}"]`);
    sec.focus({ preventScroll: true });
    const top = $('#steps').getBoundingClientRect().top + window.scrollY - 96;
    if (window.scrollY > top) window.scrollTo({ top, behavior: A.reduceMotion ? 'auto' : 'smooth' });
  }
  $$('#steps [data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => go(ORDER[Math.max(0, ORDER.indexOf(b.closest('.step').dataset.step) - 1)])));
  window.addEventListener('popstate', (e) => {
    const st = (e.state && e.state.step) || A.params().get('step') || 'dates';
    if (st === 'done') return;
    $('#steps').hidden = false;
    go(st, false);
  });

  /* ---------- Start ---------- */
  const doneRef = q.get('step') === 'done' && q.get('ref');
  const doneB = doneRef && A.store.findBooking(doneRef);
  if (doneB) { showDone(doneB); return; }
  save();
  datesStep(); card();
  let start = q.get('step') || 'dates';
  if (handoff) start = datesOk() ? 'room' : 'dates';
  let first = ORDER.includes(start) ? start : 'dates';
  while (!reachable(first)) first = ORDER[ORDER.indexOf(first) - 1];
  enter[first]();
  show(first);
  card();
  // Back from the first visible step should go to the previous page, so the entry replaces the URL.
  history.replaceState({ step: first }, '', `?step=${first}`);
  void cal;
})();
