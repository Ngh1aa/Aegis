/* Aegis: page behaviour, booking flows and motion. No external libraries.
 * Availability, prices and sending are SIMULATED (no booking engine yet); see docs/DESIGN-NOTES.md.
 * Rules used by the simulation:
 *   - every room is sold out for nights of 24 and 31 December (alternative dates are offered)
 *   - the middle room type of each hotel is sold out for any stay that includes a Saturday night
 *   - Hearth is closed on Mondays; two evening slots per restaurant and date are already taken
 *   - sending fails while the browser is offline, and keeps everything the guest typed */
(() => {
  'use strict';
  window.__aegis = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Data ---------- */
  const HOTELS = {
    riverside: { name: 'Aegis Riverside', city: 'Hội An', rooms: [
      { name: 'River View Room', size: 32, bed: 'King bed', sleeps: 2, price: 3200000 },
      { name: 'Balcony Suite', size: 48, bed: 'King bed and sofa bed', sleeps: 3, price: 5100000 },
      { name: 'Family Loft', size: 60, bed: 'Two queen beds', sleeps: 4, price: 6400000 },
    ] },
    cliff: { name: 'Aegis Cliff', city: 'Đà Nẵng', rooms: [
      { name: 'Garden Villa', size: 85, bed: 'King bed, plunge pool', sleeps: 2, price: 7800000 },
      { name: 'Ocean Pool Villa', size: 110, bed: 'King bed, infinity pool', sleeps: 2, price: 10500000 },
      { name: 'Two-bedroom Villa', size: 160, bed: 'King and twin beds, pool', sleeps: 4, price: 14900000 },
    ] },
    house: { name: 'Aegis House', city: 'Huế', rooms: [
      { name: 'Courtyard Room', size: 26, bed: 'Queen bed', sleeps: 2, price: 2400000 },
      { name: 'Heritage Room', size: 34, bed: 'King bed', sleeps: 2, price: 3100000 },
      { name: 'Garden Suite', size: 45, bed: 'King bed and daybed', sleeps: 3, price: 4600000 },
    ] },
  };
  const RESTS = {
    hearth: { name: 'Hearth', city: 'Hội An', closedDays: [1] },
    tide: { name: 'Tide', city: 'Đà Nẵng', closedDays: [] },
    lantern: { name: 'Lantern Room', city: 'Huế', closedDays: [] },
  };
  const SLOTS = ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
  const VAT = 0.08, SERVICE = 0.05;
  const MAX_NIGHTS = 14;

  /* ---------- Date and money helpers ---------- */
  const DAY = 86400000;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromISO = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const longDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const vnd = (n) => `VND ${Math.round(n).toLocaleString('en-US')}`;
  const nightsBetween = (a, b) => Math.round((b - a) / DAY);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Motion: reveals, count-up, statement ink, parallax ---------- */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const from = target > 1000 ? target - 12 : 0;
    const start = performance.now();
    const tick = (now) => {
      const k = 1 - Math.pow(1 - Math.min(1, (now - start) / 1400), 4);
      el.textContent = String(Math.round(from + (target - from) * k));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const reveal = (el) => {
    el.classList.add('is-in');
    if (!reduceMotion) $$('[data-count]', el).forEach(countUp);
  };
  const revealEls = $$('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    // Clip-path reveals start fully clipped; Chromium treats that as zero area, so watch the parent.
    const byTrigger = new Map();
    revealEls.forEach((el) => {
      const trigger = el.matches('[data-reveal="img"]') ? el.parentElement : el;
      if (!byTrigger.has(trigger)) byTrigger.set(trigger, []);
      byTrigger.get(trigger).push(el);
    });
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      byTrigger.get(e.target).forEach(reveal);
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    byTrigger.forEach((_, t) => io.observe(t));
  }

  const ink = $('[data-ink]');
  let inkWords = [];
  if (ink && !reduceMotion) {
    const words = ink.textContent.trim().split(/\s+/);
    ink.setAttribute('aria-label', ink.textContent.trim());
    ink.replaceChildren(...words.flatMap((w, i) => {
      const span = Object.assign(document.createElement('span'), { className: 'w', textContent: w });
      span.setAttribute('aria-hidden', 'true');
      return i < words.length - 1 ? [span, document.createTextNode(' ')] : [span];
    }));
    ink.setAttribute('role', 'text');
    inkWords = $$('.w', ink);
  }

  const parallax = $$('.hero__img, [data-parallax]');
  const onScroll = () => {
    const vh = window.innerHeight;
    if (!reduceMotion) {
      parallax.forEach((img) => {
        const box = img.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        img.style.translate = `0 ${(((box.top + box.height / 2 - vh / 2) / vh) * -7).toFixed(2)}%`;
      });
    }
    if (inkWords.length) {
      const r = ink.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const lit = Math.round(p * inkWords.length);
      inkWords.forEach((w, i) => w.classList.toggle('is-ink', i < lit));
    }
  };
  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
  onScroll();

  /* ---------- Header hides on scroll down; nav marks the current section ---------- */
  const hdr = $('#hdr');
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!hdr.contains(document.activeElement)) hdr.classList.toggle('is-hidden', y > lastY && y > 320);
    lastY = y;
  }, { passive: true });
  hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
  const navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
      const a = byId.get(e.target.id);
      if (a && e.isIntersecting) { navLinks.forEach((l) => l.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

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

  /* ---------- Shared form helpers ---------- */
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const digits = (v) => v.replace(/[^\d+]/g, '');
  const setError = (input, msg) => {
    const err = document.getElementById(input.getAttribute('aria-describedby'));
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    if (err) {
      err.hidden = !msg;
      const slot = $('span', err);
      if (slot && typeof msg === 'string') slot.textContent = msg;
    }
    return !msg;
  };
  const checkText = (input) => setError(input, !input.value.trim());
  const checkEmail = (input) => setError(input, !EMAIL.test(input.value.trim()));
  const checkPhone = (input) => { const n = digits(input.value).replace('+', '').length; return setError(input, n < 9 || n > 12); };
  $$('.ds-field__control[aria-describedby]').forEach((input) => input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') setError(input, false);
  }));
  const fakeSend = () => new Promise((res, rej) => setTimeout(() => (navigator.onLine ? res() : rej(new Error('offline'))), 900));
  const busy = (btn, on, label) => {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; } else if (btn.dataset.label) btn.textContent = btn.dataset.label;
    btn.disabled = on; btn.setAttribute('aria-busy', String(on));
  };
  const showStep = (panel, name, focusEl) => {
    $$('[data-step]', panel).forEach((s) => {
      const on = s.dataset.step === name;
      s.hidden = !on;
      if (on && !reduceMotion) { s.classList.remove('step-enter'); void s.offsetWidth; s.classList.add('step-enter'); }
    });
    $('[data-net-error]', panel).hidden = true;
    if (focusEl) focusEl.focus({ preventScroll: true });
  };
  const ref = (prefix) => `${prefix}-${Math.floor(10000 + Math.random() * 89999)}`;
  const fillSummary = (dl, rows) => dl.replaceChildren(...rows.flatMap(([k, v, cls]) => {
    const dt = Object.assign(document.createElement('dt'), { textContent: k });
    const dd = Object.assign(document.createElement('dd'), { textContent: v });
    if (cls) dd.className = cls;
    return [dt, dd];
  }));

  /* Steppers: min / max with a reason shown at the limit */
  const makeStepper = (output, min, max, hint, onChange) => {
    const group = output.closest('.stepper');
    const [minus, plus] = $$('.stepper__btn', group);
    const set = (v, silent) => {
      output.value = String(v); output.textContent = String(v);
      minus.disabled = v <= min; plus.disabled = v >= max;
      hint.hidden = v < max;
      if (onChange && !silent) onChange(v);
    };
    minus.addEventListener('click', () => set(Math.max(min, Number(output.textContent) - 1)));
    plus.addEventListener('click', () => set(Math.min(max, Number(output.textContent) + 1)));
    set(Number(output.textContent), true);
    return { get: () => Number(output.textContent), set };
  };

  /* ---------- Side card (the page's single highlight card) ---------- */
  const card = { main: $('#card-main'), ctx: $('#card-ctx'), sum: $('#card-sum'), label: $('.stay-card__label') };

  /* ---------- Tabs: Stay | Dine ---------- */
  const tabs = $$('.seg__tab');
  let mode = 'stay';
  const selectTab = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    mode = tab.id === 'tab-dine' ? 'dine' : 'stay';
    $$('[data-policies]').forEach((l) => { l.hidden = l.dataset.policies !== mode; });
    updateCard();
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });

  /* ---------- STAY ---------- */
  const stayPanel = $('#panel-stay');
  const sHotel = $('#s-hotel'), sIn = $('#s-in'), sOut = $('#s-out');
  const stay = { hotel: null, inD: null, outD: null, nights: 0, room: null };
  const guests = makeStepper($('#s-guests'), 1, 4, $('#s-guests-max'), () => updateCard());
  sIn.min = toISO(today()); sOut.min = toISO(addDays(today(), 1));
  sIn.value = toISO(addDays(today(), 2)); sOut.value = toISO(addDays(today(), 4));
  sIn.addEventListener('change', () => {
    const d = fromISO(sIn.value);
    if (d) { sOut.min = toISO(addDays(d, 1)); const o = fromISO(sOut.value); if (!o || o <= d) sOut.value = toISO(addDays(d, 2)); }
    updateCard();
  });
  sOut.addEventListener('change', updateCard);
  sHotel.addEventListener('change', updateCard);

  const blockedNight = (d) => d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 31);
  const nightsOf = (a, n) => Array.from({ length: n }, (_, i) => addDays(a, i));
  const totals = (price, nights) => {
    const sub = price * nights;
    return { sub, vat: sub * VAT, service: sub * SERVICE, total: sub * (1 + VAT + SERVICE) };
  };

  function validateStay() {
    const inD = fromISO(sIn.value), outD = fromISO(sOut.value);
    let ok = true;
    if (!inD) ok = setError(sIn, 'Choose a check-in date.');
    else if (inD < today()) ok = setError(sIn, 'Check-in can’t be in the past.');
    else setError(sIn, false);
    if (!outD) ok = setError(sOut, 'Choose a check-out date.') && false;
    else if (inD && outD <= inD) ok = setError(sOut, 'Check-out must be after check-in.') && false;
    else if (inD && nightsBetween(inD, outD) > MAX_NIGHTS) ok = setError(sOut, `Book up to ${MAX_NIGHTS} nights online; call us for longer stays.`) && false;
    else setError(sOut, false);
    return ok ? { inD, outD } : null;
  }

  function renderRooms() {
    const h = HOTELS[stay.hotel];
    const nights = nightsOf(stay.inD, stay.nights);
    const blocked = nights.filter(blockedNight);
    const saturday = nights.find((d) => d.getDay() === 6);
    $('#stay-trip').textContent = `${h.name}, ${shortDate(stay.inD)} to ${shortDate(stay.outD)}, ${plural(stay.nights, 'night', 'nights')}, ${plural(guests.get(), 'adult', 'adults')}`;
    const list = $('#stay-room-list');
    list.replaceChildren(...h.rooms.map((r, i) => {
      const li = document.createElement('li');
      li.className = 'room';
      let why = '';
      if (blocked.length) why = `Sold out on ${longDate(blocked[0])}`;
      else if (i === 1 && saturday) why = `Sold out on ${longDate(saturday)}`;
      else if (guests.get() > r.sleeps) why = `Sleeps up to ${r.sleeps}`;
      const t = totals(r.price, stay.nights);
      li.innerHTML = `<div><h4></h4><p class="room__meta"></p></div><div class="room__price"><span class="room__night"></span><span class="room__total"></span></div>`;
      $('h4', li).textContent = r.name;
      $('.room__meta', li).textContent = `${r.size} m², ${r.bed}, sleeps ${r.sleeps}`;
      $('.room__night', li).textContent = `${vnd(r.price)} / night`;
      $('.room__total', li).textContent = `${vnd(t.total)} total with taxes`;
      const price = $('.room__price', li);
      if (why) {
        li.classList.add('is-out');
        price.append(Object.assign(document.createElement('span'), { className: 'room__why', textContent: why }));
      } else {
        const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'ds-button ds-button--primary', textContent: 'Select room' });
        btn.setAttribute('aria-label', `Select room: ${r.name}`);
        btn.addEventListener('click', () => { stay.room = i; updateCard(); showStep(stayPanel, 'details', $('#g-name')); });
        price.append(btn);
      }
      return li;
    }));
    const soldOut = $('#stay-soldout');
    soldOut.hidden = !blocked.length;
    if (blocked.length) {
      const last = blocked[blocked.length - 1];
      const altIn = addDays(last, 1);
      const altOut = addDays(altIn, stay.nights);
      $('#stay-soldout-text').textContent = `${h.name} is fully booked on ${longDate(blocked[0])}.`;
      const alt = $('#stay-alt');
      alt.textContent = `Try ${shortDate(altIn)} to ${shortDate(altOut)}`;
      alt.onclick = () => {
        sIn.value = toISO(altIn); sOut.value = toISO(altOut);
        stay.inD = altIn; stay.outD = altOut; updateCard(); renderRooms();
        const first = $('#stay-room-list .ds-button'); if (first) first.focus();
      };
    }
  }

  $('#stay-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = validateStay();
    if (!v) { (sIn.getAttribute('aria-invalid') === 'true' ? sIn : sOut).focus(); return; }
    Object.assign(stay, { hotel: sHotel.value, inD: v.inD, outD: v.outD, nights: nightsBetween(v.inD, v.outD), room: null });
    renderRooms();
    updateCard();
    showStep(stayPanel, 'rooms', $('#stay-trip'));
    $('#stay-trip').setAttribute('tabindex', '-1');
    $('#stay-trip').focus({ preventScroll: true });
  });

  const gName = $('#g-name'), gEmail = $('#g-email'), gPhone = $('#g-phone');
  const confirmBox = $('#confirm');
  const stayRows = () => {
    const h = HOTELS[stay.hotel], r = h.rooms[stay.room], t = totals(r.price, stay.nights);
    return [
      ['Hotel', h.name], ['Room', r.name],
      ['Dates', `${shortDate(stay.inD)} to ${shortDate(stay.outD)}`],
      ['Guests', plural(guests.get(), 'adult', 'adults')],
      ['Total with taxes', vnd(t.total), 'total'],
    ];
  };
  $('#stay-details').addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = [checkText(gName), checkEmail(gEmail), checkPhone(gPhone)];
    const bad = [gName, gEmail, gPhone][ok.indexOf(false)];
    if (bad) { bad.focus(); return; }
    fillSummary($('#confirm-body'), stayRows());
    confirmBox.hidden = false;
    document.body.style.overflow = 'hidden';
    $('[data-confirm="ok"]', confirmBox).focus();
  });
  const closeConfirm = () => {
    confirmBox.hidden = true; document.body.style.overflow = '';
    $('#stay-details button[type="submit"]').focus();
  };
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
    const btn = $('#stay-details button[type="submit"]');
    busy(btn, true, 'Sending…');
    try {
      await fakeSend();
      fillSummary($('#stay-done-summary'), [['Reference', ref('AEG')], ...stayRows(), ['Name', gName.value.trim()]]);
      showStep(stayPanel, 'done', $('#stay-done'));
    } catch {
      $('[data-net-error]', stayPanel).hidden = false;
      btn.focus();
    } finally { busy(btn, false); }
  });
  $$('[data-stay-back]', stayPanel).forEach((b) => b.addEventListener('click', () => {
    const to = b.dataset.stayBack;
    if (b.hasAttribute('data-reset')) { stay.room = null; updateCard(); }
    if (to === 'rooms') { stay.room = null; updateCard(); }
    showStep(stayPanel, to, to === 'search' ? sHotel : $('#stay-trip'));
  }));

  /* ---------- DINE ---------- */
  const dinePanel = $('#panel-dine');
  const dRest = $('#d-rest'), dDate = $('#d-date'), slotsEl = $('#d-slots');
  const party = makeStepper($('#d-party'), 1, 8, $('#d-party-max'), () => updateCard());
  dDate.min = toISO(today());
  dDate.value = toISO(addDays(today(), 1));
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  function renderSlots() {
    const r = RESTS[dRest.value];
    const d = fromISO(dDate.value);
    const closed = $('#d-closed');
    slotsEl.replaceChildren();
    $('#d-slot-err').hidden = true;
    if (!d) { closed.hidden = true; return; }
    if (r.closedDays.includes(d.getDay())) {
      let next = addDays(d, 1);
      while (r.closedDays.includes(next.getDay())) next = addDays(next, 1);
      $('#d-closed-text').textContent = `${r.name} is closed on ${d.toLocaleDateString('en-GB', { weekday: 'long' })}s.`;
      const b = $('#d-next-open');
      b.textContent = `Try ${longDate(next)}`;
      b.onclick = () => { dDate.value = toISO(next); renderSlots(); updateCard(); const f = $('input', slotsEl); if (f) f.focus(); };
      closed.hidden = false;
      return;
    }
    closed.hidden = true;
    const h = hash(dRest.value + dDate.value);
    const taken = new Set([h % SLOTS.length, (h >> 4) % SLOTS.length]);
    const now = new Date();
    const isToday = toISO(d) === toISO(today());
    slotsEl.append(...SLOTS.map((t, i) => {
      const [hh, mm] = t.split(':').map(Number);
      const past = isToday && (hh * 60 + mm) < (now.getHours() * 60 + now.getMinutes() + 60);
      const label = document.createElement('label');
      label.className = 'slot';
      label.innerHTML = '<input type="radio" name="slot"><span></span>';
      const input = $('input', label);
      input.value = t;
      input.disabled = taken.has(i) || past;
      $('span', label).textContent = t;
      if (input.disabled) input.setAttribute('aria-label', `${t}, unavailable`);
      input.addEventListener('change', () => { $('#d-slot-err').hidden = true; updateCard(); });
      return label;
    }));
  }
  dRest.addEventListener('change', () => { renderSlots(); updateCard(); });
  dDate.addEventListener('change', () => { setError(dDate, false); renderSlots(); updateCard(); });
  renderSlots();
  const chosenSlot = () => { const c = $('input[name="slot"]:checked', slotsEl); return c ? c.value : null; };
  const dineRows = () => {
    const r = RESTS[dRest.value];
    return [['Restaurant', `${r.name}, ${r.city}`], ['Date', longDate(fromISO(dDate.value))], ['Time', chosenSlot()], ['Party', plural(party.get(), 'person', 'people')]];
  };
  $('#dine-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = fromISO(dDate.value);
    if (!d) { setError(dDate, 'Choose a date.'); dDate.focus(); return; }
    if (d < today()) { setError(dDate, 'That date has passed.'); dDate.focus(); return; }
    setError(dDate, false);
    if (!chosenSlot()) {
      $('#d-slot-err').hidden = false;
      const first = $('input:not(:disabled)', slotsEl) || $('#d-next-open');
      if (first) first.focus();
      return;
    }
    const r = RESTS[dRest.value];
    $('#dine-trip').textContent = `${r.name}, ${shortDate(d)} at ${chosenSlot()}, ${plural(party.get(), 'person', 'people')}`;
    showStep(dinePanel, 'details', $('#r-name'));
  });
  const rName = $('#r-name'), rPhone = $('#r-phone');
  $('#dine-details').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = [checkText(rName), checkPhone(rPhone)];
    const bad = [rName, rPhone][ok.indexOf(false)];
    if (bad) { bad.focus(); return; }
    const btn = $('#dine-details button[type="submit"]');
    busy(btn, true, 'Sending…');
    try {
      await fakeSend();
      fillSummary($('#dine-done-summary'), [['Reference', ref('TBL')], ...dineRows(), ['Name', rName.value.trim()]]);
      showStep(dinePanel, 'done', $('#dine-done'));
    } catch {
      $('[data-net-error]', dinePanel).hidden = false;
      btn.focus();
    } finally { busy(btn, false); }
  });
  $$('[data-dine-back]', dinePanel).forEach((b) => b.addEventListener('click', () => {
    if (b.hasAttribute('data-reset')) { renderSlots(); updateCard(); }
    showStep(dinePanel, 'search', dRest);
  }));

  /* ---------- Side card content ---------- */
  function updateCard() {
    if (mode === 'dine') {
      const r = RESTS[dRest.value];
      const d = fromISO(dDate.value);
      card.label.textContent = 'Your table';
      card.main.textContent = r.name;
      const slot = chosenSlot();
      card.ctx.textContent = d ? `${longDate(d)}${slot ? ` at ${slot}` : ', choose a time'}, ${plural(party.get(), 'person', 'people')}` : 'Choose a date';
      card.sum.hidden = true;
      return;
    }
    const h = HOTELS[stay.room !== null && stay.hotel ? stay.hotel : sHotel.value];
    const inD = stay.room !== null ? stay.inD : fromISO(sIn.value);
    const outD = stay.room !== null ? stay.outD : fromISO(sOut.value);
    card.label.textContent = 'Your stay';
    if (stay.room !== null) {
      const r = h.rooms[stay.room];
      const t = totals(r.price, stay.nights);
      card.main.textContent = `${r.name}, ${h.name}`;
      card.ctx.textContent = `${shortDate(inD)} to ${shortDate(outD)}, ${plural(guests.get(), 'adult', 'adults')}`;
      fillSummary(card.sum, [
        [`${plural(stay.nights, 'night', 'nights')} × ${vnd(r.price)}`, vnd(t.sub)],
        ['VAT 8%', vnd(t.vat)], ['Service 5%', vnd(t.service)], ['Total', vnd(t.total), 'total'],
      ]);
      card.sum.hidden = false;
      return;
    }
    card.main.textContent = h.name;
    const n = inD && outD && outD > inD ? nightsBetween(inD, outD) : 0;
    const from = Math.min(...h.rooms.map((r) => r.price));
    card.ctx.textContent = n
      ? `${shortDate(inD)} to ${shortDate(outD)}, ${plural(n, 'night', 'nights')}, from ${vnd(from)} a night`
      : 'Choose dates to see prices';
    card.sum.hidden = true;
  }
  updateCard();

  /* ---------- Links anywhere on the page preset the booking ---------- */
  $$('a[data-book]').forEach((a) => a.addEventListener('click', () => {
    const isDine = a.dataset.book === 'dine';
    selectTab(isDine ? tabs[1] : tabs[0]);
    if (a.dataset.hotel) { sHotel.value = a.dataset.hotel; if (stay.room === null) showStep(stayPanel, 'search'); }
    if (a.dataset.restaurant) { dRest.value = a.dataset.restaurant; renderSlots(); showStep(dinePanel, 'search'); }
    updateCard();
    setTimeout(() => (isDine ? dRest : sHotel).focus({ preventScroll: true }), reduceMotion ? 0 : 500);
  }));

  /* ---------- Newsletter ---------- */
  const nForm = $('#news-form'), nEmail = $('#n-email'), nConsent = $('#n-consent');
  nConsent.addEventListener('change', () => { if (nConsent.checked) $('#n-consent-err').hidden = true; });
  nForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const okEmail = checkEmail(nEmail);
    $('#n-consent-err').hidden = nConsent.checked;
    nConsent.setAttribute('aria-invalid', String(!nConsent.checked));
    if (!okEmail) { nEmail.focus(); return; }
    if (!nConsent.checked) { nConsent.focus(); return; }
    $('#n-net-err').hidden = true;
    const btn = $('button[type="submit"]', nForm);
    busy(btn, true, 'Sending…');
    try {
      await fakeSend();
      $('.news__row', nForm).hidden = true;
      $('.ds-check', nForm).hidden = true;
      const done = $('#news-done'); done.hidden = false; done.focus();
    } catch {
      $('#n-net-err').hidden = false;
      btn.focus();
    } finally { busy(btn, false); }
  });
})();
