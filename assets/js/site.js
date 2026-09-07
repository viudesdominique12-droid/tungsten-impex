/* Tungsten Import Export — comportement. Aucune dépendance. */
(function () {
  'use strict';

  /* --------------------------------------------------------- menu pop-up -- */
  var nav = document.getElementById('nav');
  var open = document.getElementById('nav-open');
  var shut = document.getElementById('nav-close');
  var last = null;

  function reachable() {
    return Array.prototype.filter.call(
      nav.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  function openNav() {
    last = document.activeElement;
    nav.setAttribute('data-open', 'true');
    nav.removeAttribute('aria-hidden');
    open.setAttribute('aria-expanded', 'true');
    document.body.setAttribute('data-nav', 'open');
    // Le panneau apparaît en fondu : focus() est ignoré tant qu'il est masqué.
    setTimeout(function () {
      var f = reachable();
      if (f.length) f[0].focus();
    }, 320);
  }

  function closeNav() {
    nav.setAttribute('data-open', 'false');
    nav.setAttribute('aria-hidden', 'true');
    open.setAttribute('aria-expanded', 'false');
    document.body.removeAttribute('data-nav');
    if (last) last.focus();
  }

  if (nav && open && shut) {
    open.addEventListener('click', openNav);
    shut.addEventListener('click', closeNav);
    document.addEventListener('keydown', function (e) {
      if (nav.getAttribute('data-open') !== 'true') return;
      if (e.key === 'Escape') { closeNav(); return; }
      if (e.key !== 'Tab') return;
      var f = reachable();
      if (!f.length) return;
      var first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    });
  }

  /* ------------------------------------------------------------ apparitions */
  var targets = document.querySelectorAll('[data-in]');
  if (targets.length) {
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('on'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          setTimeout(function () { el.classList.add('on'); }, parseInt(el.getAttribute('data-in'), 10) || 0);
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
      Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
    }
  }

  /* ------------------------------------------------------------ inscription */
  /* Sans serveur, le formulaire ouvre la messagerie du visiteur avec tout
     pré-rempli. Pour collecter automatiquement, mettez l'adresse d'un service
     de formulaire (Formspree, Netlify…) dans ENDPOINT. */
  var ENDPOINT = '';

  var form = document.getElementById('enrol');
  if (!form) return;
  var status = document.getElementById('enrol-status');

  function say(msg, tone) {
    if (!status) return;
    status.textContent = msg;
    if (tone) status.setAttribute('data-tone', tone); else status.removeAttribute('data-tone');
  }

  form.addEventListener('submit', function (e) {
    if (!form.reportValidity()) return;
    e.preventDefault();

    var data = new FormData(form);
    var get = function (k) { return (data.get(k) || '').toString().trim(); };

    var body = [
      'Training enquiry — Tungsten Import Export', '',
      'Name:            ' + get('name'),
      'Email:           ' + get('email'),
      'Phone:           ' + get('phone'),
      'City / country:  ' + get('location'),
      'Programme:       ' + (get('track') || 'not specified'),
      'Preferred start: ' + (get('start') || 'as soon as a place opens'),
      'Experience:      ' + (get('experience') || 'not specified'),
      '', 'Message:', get('message') || '—'
    ].join('\n');

    if (ENDPOINT) {
      say('Sending…');
      fetch(ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          form.reset();
          say('Thank you. We will contact you as soon as a place opens.', 'ok');
        })
        .catch(function () {
          say('That did not go through. Please email ' + form.dataset.email + ' directly.', 'err');
        });
      return;
    }

    window.location.href = 'mailto:' + form.dataset.email +
      '?subject=' + encodeURIComponent('Training enquiry — ' + (get('name') || 'new student')) +
      '&body=' + encodeURIComponent(body);
    say('Your email app is opening with the enquiry ready to send. If nothing happens, write to ' +
        form.dataset.email + '.', 'ok');
  });
})();
