/* Rooms listing: filters by guests, view and price; the filter state lives in the URL so Back keeps it. */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, $$, D, esc, eur } = A;
  const list = $('#room-list');
  const empty = $('#room-empty');
  const count = $('#f-count');
  const maxSel = $('#f-max');
  const viewName = (id) => (D.views.find((v) => v.id === id) || {}).name;

  const q = A.params();
  let guests = Math.min(D.maxGuests, Math.max(1, Number(q.get('guests')) || 1));
  const view0 = q.get('view') || '';
  const r0 = $(`input[name="view"][value="${CSS.escape(view0)}"]`);
  if (r0) r0.checked = true;
  if ([...maxSel.options].some((o) => o.value === q.get('max'))) maxSel.value = q.get('max');

  const card = (r) => `<li class="rcard">
    <a class="rcard__img" href="room.html?id=${r.id}" tabindex="-1" aria-hidden="true"><img src="${r.gallery[0].src}" width="${r.gallery[0].w}" height="${r.gallery[0].h}" alt="" loading="lazy"></a>
    <h2 class="rcard__name"><a href="room.html?id=${r.id}">${esc(r.name)}</a></h2>
    <p class="rcard__facts">${r.size} m², ${esc(r.beds.toLowerCase())}, sleeps ${r.sleeps}</p>
    <p class="rcard__facts">${viewName(r.view)} view</p>
    <p class="rcard__price"><b>${eur(r.price)}</b> a night</p>
    <a class="ds-button ds-button--secondary" href="room.html?id=${r.id}">View room</a>
  </li>`;

  const render = () => {
    const view = $('input[name="view"]:checked').value;
    const max = Number(maxSel.value) || Infinity;
    const rooms = D.rooms.filter((r) => r.sleeps >= guests && (!view || r.view === view) && r.price <= max);
    list.innerHTML = rooms.map(card).join('');
    empty.hidden = rooms.length > 0;
    count.textContent = rooms.length === 1 ? '1 room' : `${rooms.length} rooms`;
    const p = new URLSearchParams();
    if (guests > 1) p.set('guests', String(guests));
    if (view) p.set('view', view);
    if (maxSel.value) p.set('max', maxSel.value);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    try { sessionStorage.setItem('aegis-rooms-q', qs); } catch { /* ignore */ }
  };

  const step = A.stepper($('#f-guests'), { min: 1, max: D.maxGuests, value: guests, onChange: (v) => { guests = v; render(); } });
  $$('input[name="view"]').forEach((i) => i.addEventListener('change', render));
  maxSel.addEventListener('change', render);
  const clear = () => { $('input[name="view"][value=""]').checked = true; maxSel.value = ''; step.set(1); };
  $('#f-clear').addEventListener('click', clear);
  $('[data-clear]', empty).addEventListener('click', () => { clear(); $('#f-clear').focus(); });
  render();
})();
