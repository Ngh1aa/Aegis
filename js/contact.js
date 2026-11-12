/* Contact: message form with inline validation. Nothing is sent anywhere; the result says so. */
(() => {
  'use strict';
  const A = window.Aegis;
  const { $ } = A;
  const form = $('#msg-form');
  const done = $('#m-done');
  const f = { name: $('#m-name'), email: $('#m-email'), text: $('#m-text') };
  A.clearOnInput(form);
  const b = A.store.activeBooking();
  if (b) { f.name.value = `${b.first} ${b.surname}`; f.email.value = b.email; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let first = null;
    const bad = (el, msg) => { A.setError(el, msg); if (!first) first = el; };
    if (!f.name.value.trim()) bad(f.name, 'Enter your name.'); else A.setError(f.name, false);
    if (!A.emailOk(f.email.value)) bad(f.email, 'Enter a valid email, for example name@gmail.com.'); else A.setError(f.email, false);
    if (!f.text.value.trim()) bad(f.text, 'Write a message.'); else A.setError(f.text, false);
    if (first) { first.focus(); return; }
    const btn = $('#m-submit');
    $('#m-net').hidden = true;
    A.busy(btn, true);
    try {
      await A.send();
      form.hidden = true; done.hidden = false; done.focus();
    } catch {
      $('#m-net').hidden = false; btn.focus();
    } finally {
      A.busy(btn, false);
    }
  });
  $('#m-again').addEventListener('click', () => { f.text.value = ''; done.hidden = true; form.hidden = false; f.text.focus(); });
})();
