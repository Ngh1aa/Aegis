/* Aegis: "a day at the hotel" journey. Scroll-driven stages, time rail, booking. No libraries.
 * Prices, availability and sending are SIMULATED (no booking engine); see docs/DESIGN-NOTES.md.
 *   - nights of 24 and 31 December are fully booked (alternative dates are offered)
 *   - sending fails while the browser is offline and keeps everything the guest typed */
(() => {
  'use strict';
  window.__aegis = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* ---------- Where in the day: rail, header "now", hidden header on scroll down ---------- */
  const hdr = $('#hdr');
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
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!hdr.contains(document.activeElement)) hdr.classList.toggle('is-hidden', y > lastY && y > 320);
    lastY = y;
  }, { passive: true });
  hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));

  /* ---------- Mobile menu ---------- */
  const menu = $('#mmenu');
  const menuBtn = $('.menu-btn');
  const closeMenu = (restore = true) => {
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
    if (restore) menuBtn.focus();
  };
  menuBtn.addEventListener('click', () => {
    menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
    $('[data-close-menu]', menu).focus();
  });
  $('[data-close-menu]', menu).addEventListener('click', () => closeMenu());
  $$('a', menu).forEach((a) => a.addEventListener('click', () => closeMenu(false)));
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab') {
      const f = $$('a, button', menu); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Booking ---------- */
  const ROOMS = {
    valley: { name: 'Valley Room', price: 280, sleeps: 2 },
    balcony: { name: 'Balcony Room', price: 360, sleeps: 3 },
    tower: { name: 'Tower Suite', price: 620, sleeps: 3 },
  };
  const TAX = 4; // tourist tax per adult per night
  const DAY = 86400000;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromISO = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const longDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const eur = (n) => `€${Math.round(n).toLocaleString('en-GB')}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const nightsBetween = (a, b) => Math.round((b - a) / DAY);
  const blocked = (d) => d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 31);

  const form = $('#stay-form');
  const panel = form.closest('.panel');
  const done = $('#stay-done');
  const sIn = $('#s-in'), sOut = $('#s-out'), gName = $('#g-name'), gEmail = $('#g-email');
  const guestsOut = $('#s-guests');
  const [minus, plus] = $$('.stepper__btn', form);
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
    const n = inD && outD && outD > inD ? nightsBetween(inD, outD) : 0;
    const r = ROOMS[room()];
    const sub = r.price * n;
    const tax = TAX * guests() * n;
    return { inD, outD, n, r, sub, tax, total: sub + tax };
  };
  const fill = (dl, list) => dl.replaceChildren(...list.flatMap(([k, v, c]) => {
    const dt = Object.assign(document.createElement('dt'), { textContent: k });
    const dd = Object.assign(document.createElement('dd'), { textContent: v });
    if (c) dd.className = c;
    return [dt, dd];
  }));

  function updateCard() {
    const s = stay();
    $('#card-main').textContent = s.r.name;
    const sum = $('#card-sum');
    if (!s.n) { $('#card-ctx').textContent = 'Choose dates to see the total'; sum.hidden = true; return; }
    $('#card-ctx').textContent = `${shortDate(s.inD)} to ${shortDate(s.outD)}, ${plural(guests(), 'adult', 'adults')}`;
    fill(sum, [[`${plural(s.n, 'night', 'nights')} × ${eur(s.r.price)}`, eur(s.sub)], ['Tourist tax', eur(s.tax)], ['Total', eur(s.total), 'total']]);
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
    if (!done.hidden) { done.hidden = true; form.hidden = false; }
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
    else if (s.inD && s.n > 14) bad(sOut, 'Book up to 14 nights online; email us for longer stays.');
    else setError(sOut, false);
    if (!first && guests() > s.r.sleeps) bad(sOut, `The ${s.r.name} sleeps ${s.r.sleeps}. Choose another room or fewer guests.`);
    const box = $('#soldout');
    box.hidden = true;
    if (!first) {
      const full = Array.from({ length: s.n }, (_, i) => addDays(s.inD, i)).filter(blocked);
      if (full.length) {
        const altIn = addDays(full[full.length - 1], 1);
        const altOut = addDays(altIn, s.n);
        $('#soldout-text').textContent = `Aegis is fully booked on ${longDate(full[0])}.`;
        const alt = $('#soldout-alt');
        alt.textContent = `Try ${shortDate(altIn)} to ${shortDate(altOut)}`;
        alt.onclick = () => { sIn.value = toISO(altIn); sOut.value = toISO(altOut); box.hidden = true; updateCard(); gName.focus(); };
        box.hidden = false;
        first = alt;
      }
    }
    if (!gName.value.trim()) bad(gName, 'Enter the name the booking should be under.'); else setError(gName, false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(gEmail.value.trim())) bad(gEmail, 'Enter a valid email, for example name@gmail.com.'); else setError(gEmail, false);
    return first;
  };

  const confirmBox = $('#confirm');
  const rows = () => {
    const s = stay();
    return [['Room', s.r.name], ['Dates', `${shortDate(s.inD)} to ${shortDate(s.outD)}`], ['Guests', plural(guests(), 'adult', 'adults')], ['Total', eur(s.total), 'total']];
  };
  const submitBtn = $('button[type="submit"]', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const first = validate();
    if (first) { first.focus(); return; }
    fill($('#confirm-body'), rows());
    confirmBox.hidden = false;
    document.body.style.overflow = 'hidden';
    $('[data-confirm="ok"]', confirmBox).focus();
  });
  const closeConfirm = () => { confirmBox.hidden = true; document.body.style.overflow = ''; submitBtn.focus(); };
  $('[data-confirm="cancel"]', confirmBox).addEventListener('click', closeConfirm);
  confirmBox.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeConfirm();
    if (e.key === 'Tab') {
      const f = $$('button', confirmBox); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('[data-confirm="ok"]', confirmBox).addEventListener('click', async () => {
    confirmBox.hidden = true; document.body.style.overflow = '';
    const net = $('[data-net-error]', panel);
    net.hidden = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = 'Sending…'; submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true');
    try {
      await new Promise((res, rej) => setTimeout(() => (navigator.onLine ? res() : rej(new Error('offline'))), 900));
      fill($('#done-summary'), [['Reference', `AEG-${Math.floor(10000 + Math.random() * 89999)}`], ...rows(), ['Name', gName.value.trim()]]);
      form.hidden = true; done.hidden = false;
      if (!reduceMotion) done.classList.add('step-enter');
      done.focus();
    } catch {
      net.hidden = false;
      submitBtn.focus();
    } finally {
      submitBtn.textContent = label; submitBtn.disabled = false; submitBtn.setAttribute('aria-busy', 'false');
    }
  });
  $('#book-again').addEventListener('click', () => { done.hidden = true; form.hidden = false; sIn.focus(); });
})();
