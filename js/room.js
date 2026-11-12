/* Room detail, driven by ?id=. Unknown or missing ids show the not-found state. */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $, D, esc, eur } = A;
  const id = A.params().get('id');
  const r = A.room(id);

  try { const q = sessionStorage.getItem('aegis-rooms-q'); if (q) $('#back-rooms').href = `rooms.html?${q}`; } catch { /* default link */ }

  if (!r) {
    $('#room-missing').hidden = false;
    document.title = 'Room not found at Aegis';
    return;
  }
  document.title = `${r.name} at Aegis`;
  $('#room-view').hidden = false;
  $('#room-name').textContent = r.name;
  $('#room-price').textContent = eur(r.price);
  $('#room-rate-ctx').textContent = `Sleeps ${r.sleeps}, breakfast included`;
  $('#room-book').href = `book.html?room=${r.id}`;
  $('#room-summary').textContent = r.summary;
  const view = D.views.find((v) => v.id === r.view).name;
  A.fill($('#room-facts'), [['Size', `${r.size} m²`], ['Beds', r.beds], ['Sleeps', String(r.sleeps)], ['View', view], ['Check-in', `From ${D.hotel.checkIn}`], ['Check-out', `By ${D.hotel.checkOut}`]]);
  $('#room-amenities').innerHTML = r.amenities.map((a) => `<li>${A.icon('check')}<span>${esc(a)}</span></li>`).join('');

  /* Gallery: one large photo, thumbnails switch it */
  const photo = $('#room-photo');
  const thumbs = $('#room-thumbs');
  const show = (i) => {
    const g = r.gallery[i];
    Object.assign(photo, { src: g.src, width: g.w, height: g.h, alt: g.alt });
    [...thumbs.children].forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
  };
  thumbs.innerHTML = r.gallery.map((g, i) => `<button type="button" class="thumb" aria-label="Photo ${i + 1} of ${r.gallery.length}: ${esc(g.alt)}"><img src="${g.src}" width="${g.w}" height="${g.h}" alt="" loading="lazy"></button>`).join('');
  [...thumbs.children].forEach((b, i) => b.addEventListener('click', () => show(i)));
  show(0);

  $('#room-others').innerHTML = D.rooms.filter((o) => o.id !== r.id).slice(0, 3).map((o) => `<li class="rcard">
    <a class="rcard__img" href="room.html?id=${o.id}" tabindex="-1" aria-hidden="true"><img src="${o.gallery[0].src}" width="${o.gallery[0].w}" height="${o.gallery[0].h}" alt="" loading="lazy"></a>
    <h3 class="rcard__name"><a href="room.html?id=${o.id}">${esc(o.name)}</a></h3>
    <p class="rcard__price"><b>${eur(o.price)}</b> a night</p>
  </li>`).join('');
})();
