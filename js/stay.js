/* My stay: look up a booking by reference and surname, then view it, change its dates or cancel it.
 * Bookings come from this tab's sessionStorage, which starts with one seeded booking (see js/data.js). */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, D, fromISO, toISO, shortDate, longDate, eur, plural, esc } = A;
  const lookup = $('#lookup'), help = $('#lookup-help'), booking = $('#booking'), side = $('#booking-side');
  const form = $('#lookup-form');
  const fRef = $('#l-ref'), fLast = $('#l-last');
  let current = null;
  let cal = null;
  A.clearOnInput(form);

  /* ---------- Views ---------- */
  const hint = () => {
    const r = A.store.recentBooking();
    $('#l-hint').hidden = !r;
    if (r) $('#l-hint-btn').textContent = `${r.ref} · ${r.surname}`;
  };
  $('#l-hint-btn').addEventListener('click', () => {
    const r = A.store.recentBooking();
    if (!r) return;
    fRef.value = r.ref; fLast.value = r.surname;
    A.setError(fRef, false); A.setError(fLast, false); $('#l-none').hidden = true;
    form.querySelector('button[type=submit]').focus();
  });
  const showLookup = () => {
    hint();
    lookup.hidden = false; help.hidden = false; booking.hidden = true; side.hidden = true;
    history.replaceState(null, '', location.pathname);
  };
  const status = (kind, msg) => {
    const box = $('#b-status');
    box.className = `ds-banner ds-banner--${kind}`;
    $('use', box).setAttribute('href', kind === 'danger' ? '#i-alert' : '#i-check-circle');
    $('#b-status-text').textContent = msg;
    box.hidden = !msg;
  };
  const quoteOf = (b, inD = fromISO(b.in), outD = fromISO(b.out)) => A.quote({ roomId: b.room, inD, outD, guests: b.guests, extras: b.extras });
  const hoursToArrival = (b) => (fromISO(b.in).getTime() + 15 * 3600000 - Date.now()) / 3600000;

  const render = (b) => {
    current = b;
    const r = A.room(b.room);
    const qq = quoteOf(b);
    const cancelled = b.status === 'cancelled';
    $('#b-room').textContent = r.name;
    const badge = $('#b-badge');
    badge.className = `ds-badge ${cancelled ? 'ds-badge--neutral' : 'ds-badge--success'}`;
    badge.innerHTML = `${A.icon(cancelled ? 'x' : 'check')}${cancelled ? 'Cancelled' : 'Confirmed'}`;
    A.fill($('#b-summary'), [
      ['Reference', b.ref], ['Name', `${b.first} ${b.surname}`],
      ['Dates', `${shortDate(fromISO(b.in))} to ${shortDate(fromISO(b.out))}`], ['Nights', String(qq.n)],
      ['Guests', plural(b.guests, 'adult', 'adults')],
      ['Extras', qq.lines.length ? qq.lines.map((l) => l.name).join(', ') : 'None'],
      ['Total', eur(b.total), 'total'], ['Payment', 'At the hotel'],
    ]);
    $('#b-actions').hidden = cancelled;
    $('#b-again').hidden = !cancelled;
    $('#change').hidden = true;
    const inD = fromISO(b.in);
    const days = A.nightsBetween(A.today(), inD);
    if (cancelled) {
      $('#a-label').textContent = 'Status';
      $('#a-main').textContent = 'Cancelled';
      const when = b.history.filter((h) => h.what === 'Cancelled').pop();
      $('#a-ctx').textContent = when ? `Cancelled on ${shortDate(new Date(when.at))}` : 'Cancelled';
    } else {
      $('#a-label').textContent = 'Arrival';
      $('#a-main').textContent = longDate(inD);
      $('#a-ctx').textContent = `${days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}, check-in from ${D.hotel.checkIn}`;
    }
    const plans = A.store.plansFor(b);
    const items = [
      ...plans.tables.map((t) => ({ when: `${t.date}T${t.time}`, html: `<li><b>Table for ${t.party}</b><span>${shortDate(fromISO(t.date))} at ${t.time}</span><span>${esc(t.ref)}</span></li>` })),
      ...plans.spa.map((x) => ({ when: `${x.date}T${x.time}`, html: `<li><b>${esc(x.name)}</b><span>${shortDate(fromISO(x.date))} at ${x.time}, ${plural(x.people, 'person', 'people')}</span><span>${esc(x.ref)}</span></li>` })),
    ].sort((a, c) => a.when.localeCompare(c.when));
    $('#plans').innerHTML = items.length ? items.map((i) => i.html).join('') : '<li class="plans__empty"><span>Nothing planned yet</span></li>';
  };
  const open = (b, focus = true) => {
    A.store.setActive(b.ref);
    lookup.hidden = true; help.hidden = true; booking.hidden = false; side.hidden = false;
    status('success', '');
    render(b);
    history.replaceState(null, '', `?ref=${encodeURIComponent(b.ref)}`);
    if (focus) booking.focus();
  };

  /* ---------- Look up ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    $('#l-none').hidden = true;
    let first = null;
    if (!fRef.value.trim()) { A.setError(fRef, 'Enter your booking reference.'); first = fRef; } else A.setError(fRef, false);
    if (!fLast.value.trim()) { A.setError(fLast, 'Enter the surname on the booking.'); first = first || fLast; } else A.setError(fLast, false);
    if (first) { first.focus(); return; }
    const b = A.store.findBooking(fRef.value, fLast.value);
    if (!b) { $('#l-none').hidden = false; fRef.focus(); return; }
    open(b);
  });
  $('#b-other').addEventListener('click', () => {
    A.store.setActive(null); current = null;
    fRef.value = ''; fLast.value = '';
    showLookup(); fRef.focus();
  });

  /* ---------- Change dates ---------- */
  let next = { start: null, end: null };
  const changeSum = () => {
    const b = current;
    const ok = next.start && next.end;
    const same = ok && toISO(next.start) === b.in && toISO(next.end) === b.out;
    const rows = [['Current dates', `${shortDate(fromISO(b.in))} to ${shortDate(fromISO(b.out))}`]];
    if (ok) {
      const qq = quoteOf(b, next.start, next.end);
      const diff = qq.total - b.total;
      rows.push(['New dates', `${shortDate(next.start)} to ${shortDate(next.end)}`], ['New total', eur(qq.total), 'total'], ['Difference', diff === 0 ? 'None' : `${diff > 0 ? '+' : '−'}${eur(Math.abs(diff))}`]);
    }
    A.fill($('#change-sum'), rows);
    $('#change-save').disabled = !ok || same;
    $('#change-reason').textContent = !next.start ? 'Choose a new check-in date' : !next.end ? 'Choose a new check-out date' : same ? 'These are your current dates' : '';
  };
  $('#b-change').addEventListener('click', () => {
    const b = current;
    $('#change').hidden = false;
    next = { start: fromISO(b.in), end: fromISO(b.out) };
    const blocked = (d) => A.soldOut(d) || A.roomTaken(b.room, d);
    if (!cal) cal = A.calendar($('#change-cal'), { mode: 'range', start: next.start, end: next.end, blocked, onChange: (v) => { next = v; changeSum(); } });
    else cal.set(next.start, next.end);
    changeSum();
    $('#t-change').scrollIntoView({ behavior: A.reduceMotion ? 'auto' : 'smooth', block: 'start' });
    const f = $('.cal__day[tabindex="0"]', $('#change-cal'));
    if (f) f.focus({ preventScroll: true });
  });
  $('#change-close').addEventListener('click', () => { $('#change').hidden = true; $('#b-change').focus(); });
  $('#change-save').addEventListener('click', async () => {
    const b = current;
    const qq = quoteOf(b, next.start, next.end);
    const diff = qq.total - b.total;
    const ok = await A.confirmDialog({
      title: 'Save new dates?',
      rows: [['Reference', b.ref], ['New dates', `${shortDate(next.start)} to ${shortDate(next.end)}`], ['New total', eur(qq.total), 'total'], ['Difference', diff === 0 ? 'None' : `${diff > 0 ? '+' : '−'}${eur(Math.abs(diff))}`]],
      ok: 'Save new dates',
    });
    if (!ok) return;
    const btn = $('#change-save');
    A.busy(btn, true, 'Saving…');
    try {
      await A.send();
      const inIso = toISO(next.start), outIso = toISO(next.end);
      A.store.update((st) => {
        const x = st.bookings.find((y) => y.ref === b.ref);
        x.in = inIso; x.out = outIso; x.total = qq.total;
        x.history.push({ at: new Date().toISOString(), what: `Dates changed to ${inIso} – ${outIso}` });
      });
      render(A.store.findBooking(b.ref));
      status('success', `Dates changed to ${shortDate(next.start)} to ${shortDate(next.end)}. New total ${eur(qq.total)}, paid at the hotel. We’ve emailed the updated details to ${b.email}.`);
      booking.focus();
    } catch {
      status('danger', 'Couldn’t save the new dates. Your booking still has its old dates; check your connection and try again.');
    } finally {
      A.busy(btn, false);
    }
  });

  /* ---------- Cancel ---------- */
  $('#b-cancel').addEventListener('click', async () => {
    const b = current;
    const r = A.room(b.room);
    const late = hoursToArrival(b) < 72;
    const ok = await A.confirmDialog({
      title: 'Cancel booking?',
      rows: [['Reference', b.ref], ['Room', r.name], ['Dates', `${shortDate(fromISO(b.in))} to ${shortDate(fromISO(b.out))}`], ['Cancellation fee', late ? `${eur(r.price)}, one night` : 'None']],
      ok: 'Cancel booking', cancel: 'Keep booking', danger: true,
    });
    if (!ok) return;
    const btn = $('#b-cancel');
    A.busy(btn, true, 'Cancelling…');
    try {
      await A.send();
      A.store.update((st) => {
        const x = st.bookings.find((y) => y.ref === b.ref);
        x.status = 'cancelled';
        x.history.push({ at: new Date().toISOString(), what: 'Cancelled' });
      });
      render(A.store.findBooking(b.ref));
      status('success', `Booking ${b.ref} is cancelled${late ? `. A cancellation fee of ${eur(r.price)} applies, settled with reception` : ' free of charge'}. We’ve emailed a confirmation to ${b.email}.`);
      booking.focus();
    } catch {
      status('danger', 'Couldn’t cancel. Your booking is still confirmed; check your connection and try again.');
    } finally {
      A.busy(btn, false);
    }
  });

  /* ---------- Start ---------- */
  const qRef = A.params().get('ref');
  const active = A.store.activeBooking();
  if (qRef && active && active.ref.toLowerCase() === qRef.toLowerCase()) open(active, false);
  else if (!qRef && active) open(active, false);
  else { if (qRef) fRef.value = qRef; showLookup(); }
})();
