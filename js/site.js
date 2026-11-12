/* Aegis shared layer for every page: helpers, availability and pricing, the sessionStorage store,
 * header and mobile menu, confirm dialog, toast, calendar and the footer "Reset demo data" control.
 * There is no server. Guest data lives only in sessionStorage (this tab), under STORE_KEY. */
(() => {
  'use strict';
  window.__aegis = true;
  const D = window.AEGIS_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Dates and formatting ---------- */
  const DAY = 86400000;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromISO = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const longDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const monthName = (d) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const nightsBetween = (a, b) => Math.round((b - a) / DAY);
  const sameDay = (a, b) => a && b && a.getTime() === b.getTime();
  const eur = (n) => `€${Math.round(n).toLocaleString('en-GB')}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const params = () => new URLSearchParams(location.search);

  /* ---------- Availability and pricing ---------- */
  const room = (id) => D.rooms.find((r) => r.id === id) || null;
  const offsetOf = (d) => nightsBetween(today(), d);
  const soldOut = (d) => (d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 31)) || D.soldOutOffsets.includes(offsetOf(d));
  const roomTaken = (id, d) => (D.roomTaken[id] || []).includes(offsetOf(d));
  const nightsOf = (inD, outD) => Array.from({ length: Math.max(0, nightsBetween(inD, outD)) }, (_, i) => addDays(inD, i));
  /* First blocked night of a stay, or null. With a room id also checks that room. */
  const blockedNight = (inD, outD, roomId) => nightsOf(inD, outD).find((d) => soldOut(d) || (roomId && roomTaken(roomId, d))) || null;
  const extraCost = (x, guests, n) => (x.unit === 'guest-night' ? x.price * guests * n : x.unit === 'guest' ? x.price * guests : x.price);
  const extraUnit = (x) => ({ 'guest-night': 'per guest a night', guest: 'per guest', stay: 'per stay' }[x.unit]);
  const quote = ({ roomId, inD, outD, guests, extras = [] }) => {
    const r = room(roomId);
    const n = inD && outD && outD > inD ? nightsBetween(inD, outD) : 0;
    const roomSum = r ? r.price * n : 0;
    const lines = extras.map((id) => D.extras.find((x) => x.id === id)).filter(Boolean).map((x) => ({ id: x.id, name: x.name, sum: extraCost(x, guests, n) }));
    const extrasSum = lines.reduce((a, l) => a + l.sum, 0);
    const tax = D.taxPerGuestNight * guests * n;
    return { r, n, roomSum, lines, extrasSum, tax, total: roomSum + extrasSum + tax };
  };

  /* ---------- Store (sessionStorage only) ---------- */
  const STORE_KEY = 'aegis-demo-v1';
  const empty = () => ({ bookings: [], tables: [], spa: [], active: null, draft: null });
  let memory = null; // used if sessionStorage is blocked
  const load = () => {
    try { const raw = sessionStorage.getItem(STORE_KEY); return raw ? { ...empty(), ...JSON.parse(raw) } : empty(); } catch { return memory || empty(); }
  };
  const save = (s) => { memory = s; try { sessionStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* memory only */ } };
  const update = (fn) => { const s = load(); fn(s); save(s); return s; };
  const makeRef = (prefix) => {
    const s = load();
    const used = new Set([...s.bookings, ...s.tables, ...s.spa].map((x) => x.ref));
    let ref;
    do { ref = `${prefix}-${Math.floor(10000 + Math.random() * 89999)}`; } while (used.has(ref));
    return ref;
  };
  const norm = (s) => String(s || '').trim().toLowerCase();
  const store = {
    get: load,
    update,
    findBooking: (ref, surname) => load().bookings.find((b) => norm(b.ref) === norm(ref) && (surname === undefined || norm(b.surname) === norm(surname))) || null,
    activeBooking: () => { const s = load(); return s.active ? s.bookings.find((b) => b.ref === s.active) || null : null; },
    setActive: (ref) => update((s) => { s.active = ref; }),
    plansFor: (b) => { const s = load(); const mine = (x) => x.bookingRef === b.ref || norm(x.surname) === norm(b.surname); return { tables: s.tables.filter(mine), spa: s.spa.filter(mine) }; },
    counts: () => { const s = load(); return { bookings: s.bookings.length, tables: s.tables.length, spa: s.spa.length }; },
    reset: () => { memory = null; try { sessionStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ } },
  };

  /* Simulated network: resolves after a short wait, fails while the browser is offline. */
  const send = () => new Promise((res, rej) => setTimeout(() => (navigator.onLine ? res() : rej(new Error('offline'))), 900));

  /* ---------- Small DOM helpers ---------- */
  const fill = (dl, list) => dl.replaceChildren(...list.flatMap(([k, v, c]) => {
    const dt = Object.assign(document.createElement('dt'), { textContent: k });
    const dd = Object.assign(document.createElement('dd'), { textContent: v });
    if (c) dd.className = c;
    return [dt, dd];
  }));
  const setError = (input, msg) => {
    const err = document.getElementById(input.dataset.err || `${input.id}-err`);
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    if (err) { err.hidden = !msg; if (typeof msg === 'string') $('span', err).textContent = msg; }
    return !msg;
  };
  const clearOnInput = (root) => $$('input, select, textarea', root).forEach((i) => i.addEventListener('input', () => {
    if (i.getAttribute('aria-invalid') === 'true') setError(i, false);
  }));
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  const icon = (id, cls = '') => `<svg class="ds-icon ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const busy = (btn, on, label) => {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Sending…'; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; btn.setAttribute('aria-busy', 'false'); }
  };
  const trapTab = (box, e) => {
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea', box).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const stepper = (group, { min, max, value, onChange }) => {
    const [minus, plus] = $$('button', group);
    const out = $('output', group);
    let v = value;
    const set = (n, silent) => { v = Math.min(max, Math.max(min, n)); out.textContent = String(v); out.value = String(v); minus.disabled = v <= min; plus.disabled = v >= max; if (onChange && !silent) onChange(v); };
    minus.addEventListener('click', () => set(v - 1));
    plus.addEventListener('click', () => set(v + 1));
    set(v, true); // no callback during setup, so callers may declare their handlers later
    return { get: () => v, set, setMax: (m) => { max = m; set(v); } };
  };

  /* ---------- Confirm dialog (Cancel always available) ---------- */
  const confirmDialog = ({ title, rows = [], text = '', ok, cancel = 'Cancel', danger = false }) => new Promise((resolve) => {
    const back = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'dialog-scrim';
    scrim.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
      <h3 id="dlg-title"></h3><div id="dlg-body"><dl class="summary"></dl><p class="dialog__text"></p></div>
      <div class="form-actions between"><button class="ds-button ds-button--secondary ds-button--lg" type="button" data-dlg="cancel"></button>
      <button class="ds-button ${danger ? 'ds-button--danger' : 'ds-button--primary'} ds-button--lg" type="button" data-dlg="ok"></button></div></div>`;
    $('h3', scrim).textContent = title;
    if (rows.length) fill($('dl', scrim), rows); else $('dl', scrim).remove();
    if (text) $('.dialog__text', scrim).textContent = text; else $('.dialog__text', scrim).remove();
    $('[data-dlg="cancel"]', scrim).textContent = cancel;
    $('[data-dlg="ok"]', scrim).textContent = ok;
    document.body.append(scrim);
    document.body.style.overflow = 'hidden';
    const close = (val) => { scrim.remove(); document.body.style.overflow = ''; if (back && back.focus) back.focus(); resolve(val); };
    $('[data-dlg="cancel"]', scrim).addEventListener('click', () => close(false));
    $('[data-dlg="ok"]', scrim).addEventListener('click', () => close(true));
    scrim.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); trapTab(scrim, e); });
    $('[data-dlg="ok"]', scrim).focus();
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  const toast = (msg) => {
    let t = $('#toast');
    if (!t) { t = Object.assign(document.createElement('div'), { id: 'toast', className: 'ds-toast toast' }); t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  };
  const FLASH = 'aegis-flash';
  try { const f = sessionStorage.getItem(FLASH); if (f) { sessionStorage.removeItem(FLASH); setTimeout(() => toast(f), 50); } } catch { /* no flash */ }

  /* ---------- Calendar ----------
   * mode 'range': pick check-in then check-out; nights may not cross a blocked night.
   * mode 'single': pick one day. */
  const calendar = (host, opts) => {
    const o = { mode: 'range', maxAhead: 365, maxNights: D.maxNights, blocked: soldOut, disabled: () => false, label: () => '', onChange: () => {}, ...opts };
    let start = o.start || null, end = o.end || null;
    const min = today(), maxD = addDays(today(), o.maxAhead);
    let view = new Date((start || min).getFullYear(), (start || min).getMonth(), 1);
    let focusDay = null;
    const months = () => (host.clientWidth >= 620 ? 2 : 1);
    const checkoutOk = (d) => start && !end && d > start && nightsBetween(start, d) <= o.maxNights && !nightsOf(start, d).some(o.blocked);
    const state = (d) => {
      if (d < min || d > maxD) return { off: true, why: 'unavailable' };
      if (o.mode === 'single') return o.disabled(d) ? { off: true, why: o.label(d) || 'unavailable' } : { off: false };
      if (start && !end && d > start) return checkoutOk(d) ? { off: false } : { off: true, why: o.blocked(d) ? 'sold out' : 'unavailable for this stay' };
      return o.blocked(d) ? { off: true, why: 'sold out', sold: true } : { off: false };
    };
    const render = () => {
      const n = months();
      const first = new Date(min.getFullYear(), min.getMonth(), 1);
      if (view < first) view = first;
      const parts = [];
      for (let m = 0; m < n; m++) {
        const mStart = new Date(view.getFullYear(), view.getMonth() + m, 1);
        const lead = (mStart.getDay() + 6) % 7;
        const days = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getDate();
        let cells = '<span class="cal__pad"></span>'.repeat(lead);
        for (let i = 1; i <= days; i++) {
          const d = new Date(mStart.getFullYear(), mStart.getMonth(), i);
          const st = state(d);
          const sold = o.mode === 'range' ? o.blocked(d) : false;
          const cls = ['cal__day'];
          if (sold && d >= min) cls.push('is-sold');
          if (sameDay(d, today())) cls.push('is-today');
          if (sameDay(d, start)) cls.push('is-start');
          if (sameDay(d, end)) cls.push('is-end');
          if (start && end && d > start && d < end) cls.push('is-range');
          const sel = Boolean(sameDay(d, start) || sameDay(d, end));
          const name = `${longDate(d)}${st.off && d >= min ? `, ${sold ? 'sold out' : st.why}` : ''}${sameDay(d, start) ? (o.mode === 'range' ? ', check-in' : ', selected') : ''}${sameDay(d, end) ? ', check-out' : ''}`;
          cells += `<button type="button" class="${cls.join(' ')}" data-day="${toISO(d)}" aria-label="${esc(name)}" aria-pressed="${sel}"${st.off ? ' disabled' : ''} tabindex="-1">${i}</button>`;
        }
        parts.push(`<div class="cal__month"><p class="cal__title">${monthName(mStart)}</p><div class="cal__dow" aria-hidden="true"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div><div class="cal__grid">${cells}</div></div>`);
      }
      const canPrev = view > first;
      const lastShown = new Date(view.getFullYear(), view.getMonth() + n, 0);
      host.innerHTML = `<div class="cal__nav"><button type="button" class="icon-btn" data-cal="prev" aria-label="Previous month"${canPrev ? '' : ' disabled'}>${icon('chev-left')}</button><button type="button" class="icon-btn" data-cal="next" aria-label="Next month"${lastShown < maxD ? '' : ' disabled'}>${icon('chev-right')}</button></div><div class="cal__months">${parts.join('')}</div>`;
      // roving tab stop: selected day, else first enabled day
      const btns = $$('.cal__day', host);
      const pick = btns.find((b) => b.dataset.day === focusDay && !b.disabled) || btns.find((b) => b.getAttribute('aria-pressed') === 'true' && !b.disabled) || btns.find((b) => !b.disabled);
      if (pick) pick.tabIndex = 0;
      return pick;
    };
    const emit = () => o.onChange({ start, end });
    host.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-cal]');
      if (nav) { view = new Date(view.getFullYear(), view.getMonth() + (nav.dataset.cal === 'next' ? 1 : -1), 1); render(); const b = $(`[data-cal="${nav.dataset.cal}"]`, host); if (b && !b.disabled) b.focus(); return; }
      const b = e.target.closest('.cal__day');
      if (!b || b.disabled) return;
      const d = fromISO(b.dataset.day);
      if (o.mode === 'single') { start = d; }
      else if (start && !end && d > start) { end = d; }
      else { start = d; end = null; }
      focusDay = b.dataset.day;
      const f = render(); if (f) f.focus();
      emit();
    });
    host.addEventListener('keydown', (e) => {
      const b = e.target.closest('.cal__day');
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!b || !step) return;
      e.preventDefault();
      const all = $$('.cal__day', host);
      let i = all.indexOf(b) + step;
      while (all[i] && all[i].disabled) i += Math.sign(step);
      if (all[i]) { b.tabIndex = -1; all[i].tabIndex = 0; all[i].focus(); }
    });
    let lastN = 0;
    window.addEventListener('resize', () => { const n = months(); if (n !== lastN) { lastN = n; render(); } });
    lastN = months(); render();
    return {
      get: () => ({ start, end }),
      set: (s, e2) => { start = s || null; end = e2 || null; if (start) view = new Date(start.getFullYear(), start.getMonth(), 1); render(); },
      refresh: render,
    };
  };

  /* ---------- Header: mobile menu, hide on scroll down ---------- */
  const hdr = $('#hdr');
  if (hdr) {
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (!hdr.contains(document.activeElement)) hdr.classList.toggle('is-hidden', y > lastY && y > 320);
      lastY = y;
    }, { passive: true });
    hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
  }
  const menu = $('#mmenu');
  const menuBtn = $('.menu-btn');
  if (menu && menuBtn) {
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
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); trapTab(menu, e); });
  }

  /* ---------- Footer: reset demo data ---------- */
  $$('[data-reset]').forEach((btn) => btn.addEventListener('click', async () => {
    const c = store.counts();
    const ok = await confirmDialog({
      title: 'Reset demo data?',
      rows: [['Bookings', String(c.bookings)], ['Table reservations', String(c.tables)], ['Spa and experiences', String(c.spa)]],
      text: 'Everything saved in this browser tab is removed.',
      ok: 'Reset data', danger: true,
    });
    if (!ok) return;
    store.reset();
    try { sessionStorage.setItem(FLASH, 'Demo data reset. Nothing is saved in this tab now.'); } catch { /* ignore */ }
    location.reload();
  }));

  window.Aegis = {
    D, $, $$, reduceMotion, today, addDays, toISO, fromISO, shortDate, longDate, nightsBetween, sameDay, eur, plural, esc, params,
    room, soldOut, roomTaken, nightsOf, blockedNight, extraCost, extraUnit, quote,
    store, makeRef, send, fill, setError, clearOnInput, emailOk, icon, busy, trapTab, stepper, confirmDialog, toast, calendar,
  };
})();
