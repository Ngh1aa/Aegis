/* Aegis home: "a day at the hotel" journey. Scroll-driven stages, time rail and the stay planner.
 * The planner checks dates and capacity, then hands off to book.html with its values.
 * Prices and availability come from js/data.js through js/site.js (window.Aegis).
 *   - 24 and 31 December and a few seeded nights are fully booked; alternative dates are offered */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, $$, reduceMotion } = A;
  const root = document.documentElement;
  if (!reduceMotion) root.classList.add('is-scrub');

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    // A fully clipped box has zero area for IntersectionObserver, so image reveals watch their parent.
    const byTrigger = new Map();
    revealEls.forEach((el) => {
      const t = el.matches('[data-reveal="img"]') ? el.parentElement : el;
      if (!byTrigger.has(t)) byTrigger.set(t, []);
      byTrigger.get(t).push(el);
    });
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      byTrigger.get(e.target).forEach((el) => el.classList.add('is-in'));
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    byTrigger.forEach((_, t) => io.observe(t));
  }

  /* ---------- Scroll-driven stages ---------- */
  const scrubs = $$('[data-scrub]');
  const pan = $('#hall');
  const panTrack = $('#hall-track');
  const heroImg = $('.hero__img');
  const measurePan = () => {
    if (!pan || reduceMotion) return;
    const dist = Math.max(0, panTrack.scrollWidth - window.innerWidth);
    pan.style.setProperty('--pan-dist', `${dist}px`);
  };
  const progressBar = $('#progress');
  const update = () => {
    const vh = window.innerHeight;
    if (!reduceMotion) {
      scrubs.forEach((s) => {
        const r = s.getBoundingClientRect();
        const travel = r.height - vh;
        const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
        s.style.setProperty('--p', p.toFixed(4));
      });
      if (heroImg) {
        const r = heroImg.parentElement.getBoundingClientRect();
        if (r.bottom > 0) heroImg.style.translate = `0 ${(-r.top * 0.25).toFixed(1)}px`;
      }
    }
    const max = document.documentElement.scrollHeight - vh;
    progressBar.parentElement.style.setProperty('--progress', max > 0 ? (window.scrollY / max).toFixed(4) : '0');
  };
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measurePan(); update(); });
  window.addEventListener('load', () => { measurePan(); update(); });
  measurePan(); update();

  /* ---------- Where in the day: rail and header "now" ---------- */
  const now = $('#now');
  const railLinks = $$('[data-rail]');
  const chapters = $$('[data-chapter]');
  const setChapter = (ch) => {
    railLinks.forEach((a) => {
      if (ch && a.dataset.rail === ch.dataset.chapter) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    if (ch) {
      $('.hdr__now-t', now).textContent = ch.dataset.time;
      $('.hdr__now-l', now).textContent = ch.dataset.label;
    }
    now.classList.toggle('is-on', Boolean(ch));
  };
  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      setChapter(chapters.find((c) => visible.has(c)) || null);
    }, { rootMargin: '-50% 0px -49% 0px' });
    chapters.forEach((c) => spy.observe(c));
  }

  /* ---------- Stay planner: checks dates and capacity, then hands off to book.html ---------- */
  const { today, addDays, toISO, fromISO, shortDate, longDate, eur, plural } = A;
  const form = $('#stay-form');
  const sIn = $('#s-in'), sOut = $('#s-out');
  const guestsOut = $('#s-guests');
  const [minus, plus] = $$('.stepper__btn', form);
  const submitBtn = $('button[type="submit"]', form);
  const room = () => $('input[name="room"]:checked', form).value;
  sIn.min = toISO(today()); sOut.min = toISO(addDays(today(), 1));
  sIn.value = toISO(addDays(today(), 7)); sOut.value = toISO(addDays(today(), 9));

  const guests = () => Number(guestsOut.textContent);
  const setError = (input, msg) => {
    const err = document.getElementById(input.getAttribute('aria-describedby'));
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    if (err) { err.hidden = !msg; if (typeof msg === 'string') $('span', err).textContent = msg; }
    return !msg;
  };
  $$('.ds-field__control[aria-describedby]', form).forEach((i) => i.addEventListener('input', () => {
    if (i.getAttribute('aria-invalid') === 'true') setError(i, false);
  }));

  const stay = () => {
    const inD = fromISO(sIn.value), outD = fromISO(sOut.value);
    const q = A.quote({ roomId: room(), inD, outD, guests: guests() });
    return { inD, outD, n: q.n, r: q.r, sub: q.roomSum, tax: q.tax, total: q.total };
  };

  function updateCard() {
    const s = stay();
    $('#card-main').textContent = s.r.name;
    const sum = $('#card-sum');
    if (!s.n) { $('#card-ctx').textContent = 'Choose dates to see the total'; sum.hidden = true; return; }
    $('#card-ctx').textContent = `${shortDate(s.inD)} to ${shortDate(s.outD)}, ${plural(guests(), 'adult', 'adults')}`;
    A.fill(sum, [[`${plural(s.n, 'night', 'nights')} × ${eur(s.r.price)}`, eur(s.sub)], ['Tourist tax', eur(s.tax)], ['Total', eur(s.total), 'total']]);
    sum.hidden = false;
  }
  const setGuests = (v) => {
    guestsOut.textContent = String(v); guestsOut.value = String(v);
    minus.disabled = v <= 1; plus.disabled = v >= 3;
    $('#s-guests-max').hidden = v < 3;
    updateCard();
  };
  minus.addEventListener('click', () => setGuests(Math.max(1, guests() - 1)));
  plus.addEventListener('click', () => setGuests(Math.min(3, guests() + 1)));
  [sIn, sOut].forEach((i) => i.addEventListener('change', () => {
    const d = fromISO(sIn.value);
    if (i === sIn && d) { sOut.min = toISO(addDays(d, 1)); const o = fromISO(sOut.value); if (!o || o <= d) sOut.value = toISO(addDays(d, 2)); }
    $('#soldout').hidden = true;
    updateCard();
  }));
  $$('input[name="room"]', form).forEach((r) => r.addEventListener('change', updateCard));
  setGuests(2);

  // "Choose this room" links preselect the room
  $$('a[data-room]').forEach((a) => a.addEventListener('click', () => {
    const r = $(`input[name="room"][value="${a.dataset.room}"]`, form);
    if (r) { r.checked = true; updateCard(); }
    setTimeout(() => sIn.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
  }));

  const validate = () => {
    const s = stay();
    let first = null;
    const bad = (el, msg) => { setError(el, msg); if (!first) first = el; };
    if (!s.inD) bad(sIn, 'Choose a check-in date.');
    else if (s.inD < today()) bad(sIn, 'Check-in can’t be in the past.');
    else setError(sIn, false);
    if (!s.outD) bad(sOut, 'Choose a check-out date.');
    else if (s.inD && s.outD <= s.inD) bad(sOut, 'Check-out must be after check-in.');
    else if (s.inD && s.n > A.D.maxNights) bad(sOut, `Book up to ${A.D.maxNights} nights online; email us for longer stays.`);
    else setError(sOut, false);
    if (!first && guests() > s.r.sleeps) bad(sOut, `The ${s.r.name} sleeps ${s.r.sleeps}. Choose another room or fewer guests.`);
    const box = $('#soldout');
    box.hidden = true;
    if (!first) {
      const full = A.nightsOf(s.inD, s.outD).filter(A.soldOut);
      if (full.length) {
        // first free run of the same length after the last sold-out night
        let altIn = addDays(full[full.length - 1], 1);
        while (A.blockedNight(altIn, addDays(altIn, s.n))) altIn = addDays(altIn, 1);
        const altOut = addDays(altIn, s.n);
        $('#soldout-text').textContent = `Aegis is fully booked on ${longDate(full[0])}.`;
        const alt = $('#soldout-alt');
        alt.textContent = `Try ${shortDate(altIn)} to ${shortDate(altOut)}`;
        alt.onclick = () => { sIn.value = toISO(altIn); sOut.value = toISO(altOut); box.hidden = true; updateCard(); submitBtn.focus(); };
        box.hidden = false;
        first = alt;
      }
    }
    return first;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const first = validate();
    if (first) { first.focus(); return; }
    const q = new URLSearchParams({ room: room(), in: sIn.value, out: sOut.value, guests: String(guests()) });
    location.href = `book.html?${q}`;
  });
})();
