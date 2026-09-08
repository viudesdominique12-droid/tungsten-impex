/* Angle : scripts rejoues — passe 2. Formulaire, accumulation, mobile. */
import { chromium, devices } from 'playwright';

const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const SITE = 'http://localhost:4321';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const instrument = `
  window.__T = { vivants: new Set(), scroll: 0, keydown: 0, vis: 0, resize: 0, io: 0, ioLive: 0 };
  const si = window.setInterval, st = window.setTimeout, ci = window.clearInterval, ct = window.clearTimeout;
  window.setTimeout = function (f, d) {
    const id = st(function () { window.__T.vivants.delete(id); return f && f.apply(this, arguments); }, d);
    window.__T.vivants.add(id); return id; };
  window.setInterval = function (f, d) { const id = si(f, d); window.__T.vivants.add(id); return id; };
  window.clearTimeout = function (id) { window.__T.vivants.delete(id); return ct(id); };
  window.clearInterval = function (id) { window.__T.vivants.delete(id); return ci(id); };
  const ael = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    if (this === window || this === document) {
      if (t === 'scroll') window.__T.scroll++;
      if (t === 'keydown') window.__T.keydown++;
      if (t === 'visibilitychange') window.__T.vis++;
      if (t === 'resize') window.__T.resize++;
    }
    return ael.call(this, t, f, o); };
  const IO = window.IntersectionObserver;
  window.IntersectionObserver = function (cb, opt) {
    const o = new IO(cb, opt); window.__T.io++; window.__T.ioLive++;
    const d = o.disconnect.bind(o);
    o.disconnect = function () { window.__T.ioLive--; return d(); };
    return o; };
  window.IntersectionObserver.prototype = IO.prototype;
`;

const goRoute = (page, r) => page.evaluate((route) => {
  const a = document.createElement('a'); a.href = route; document.body.append(a); a.click(); a.remove();
}, r);

const compteurs = (p) => p.evaluate(() => ({
  min: window.__T.vivants.size, scroll: window.__T.scroll, keydown: window.__T.keydown,
  vis: window.__T.vis, resize: window.__T.resize, io: window.__T.io, ioLive: window.__T.ioLive,
}));

const ROUTES = ['/', '/about/', '/training/', '/contact/',
  '/export/sesame-seed/', '/export/soya-bean/', '/export/red-kidney-beans/', '/export/niger-seed-noug/',
  '/import/building-glass/', '/import/calcium-hypochlorite/', '/import/ceramics/',
  '/import/electric-vehicles/', '/import/elevator-and-escalator/', '/import/human-medicine/',
  '/import/medical-equipment/', '/import/plastic-raw-materials/', '/import/solar-lanterns/',
  '/import/stationery-materials/'];

(async () => {
  const nav = await chromium.launch();

  /* ============ A. le formulaire de /training/ ============ */
  console.log('=== A. FORMULAIRE /training/ ===');
  for (const [nom, base, ouvrir] of [['MAQUETTE', MAQ, 'maq'], ['SITE', SITE + '/training/', 'site']]) {
    const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(instrument);
    const p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', (e) => erreurs.push(String(e.message)));
    let navigations = 0;
    p.on('framenavigated', (f) => { if (f === p.mainFrame()) navigations++; });
    await p.goto(base);
    await p.waitForTimeout(800);
    if (ouvrir === 'maq') { await goRoute(p, '/training/'); await p.waitForTimeout(800); }
    const avant = await p.evaluate(() => ({
      form: !!document.getElementById('enrol'),
      url: location.href.slice(-60),
      status: (document.getElementById('status') || {}).textContent,
    }));
    // on remplit et on soumet
    await p.evaluate(() => {
      const f = document.getElementById('enrol'); if (!f) return;
      const set = (n, v) => { const el = f.elements[n]; if (el) el.value = v; };
      set('name', 'Client Test'); set('email', 'client@example.com'); set('phone', '+251 900 000 000');
      set('location', 'Addis'); set('message', 'Bonjour');
    });
    navigations = 0;
    await p.evaluate(() => { const f = document.getElementById('enrol'); if (f) f.requestSubmit(); });
    await p.waitForTimeout(1500);
    const apres = await p.evaluate(() => ({
      url: location.href.slice(-90),
      titre: document.title.slice(0, 40),
      status: (document.getElementById('status') || {}).textContent,
      formEncorePresent: !!document.getElementById('enrol'),
    }));
    console.log(nom, JSON.stringify({ avant, apres, navigationsPendantSubmit: navigations, erreurs }));
    await ctx.close();
  }

  /* ============ B. accumulation sur 36 navigations ============ */
  console.log('');
  console.log('=== B. ACCUMULATION (36 navigations dans la maquette) ===');
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(instrument);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
  const cons = []; p.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 200)); });
  await p.goto(MAQ);
  await p.waitForTimeout(900);
  console.log('depart :', JSON.stringify(await compteurs(p)));
  let n = 0;
  for (let tour = 0; tour < 2; tour++) {
    for (const r of ROUTES) { await goRoute(p, r); await p.waitForTimeout(120); n++; }
  }
  await goRoute(p, '/'); n++;
  await p.waitForTimeout(1500);
  console.log('apres ' + n + ' navigations :', JSON.stringify(await compteurs(p)));
  console.log('ids dupliques :', JSON.stringify(await p.evaluate(() => {
    const c = {}; for (const e of document.querySelectorAll('[id]')) c[e.id] = (c[e.id] || 0) + 1;
    return Object.entries(c).filter((x) => x[1] > 1);
  })));
  // le tableau tourne-t-il toujours ?
  const vus = new Set(); const fin = Date.now() + 6000;
  while (Date.now() < fin) { vus.add(await p.evaluate(() => (document.getElementById('board-card') || {}).style.transform)); await sleep(150); }
  console.log('transforms apres ' + n + ' navigations :', JSON.stringify([...vus]));
  console.log('ruban :', JSON.stringify(await p.evaluate(() => {
    const x = document.querySelector('.ruban__piste'); if (!x) return null;
    const s = getComputedStyle(x); return { a: s.animationName, ps: s.animationPlayState, w: Math.round(x.getBoundingClientRect().width) };
  })));
  // cout d'un defilement : combien de temps pour 40 evenements scroll
  const cout = await p.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) { scrollTo(0, (i % 20) * 60); await new Promise((r) => requestAnimationFrame(r)); }
    return Math.round(performance.now() - t0);
  });
  console.log('40 defilements (ms) :', cout);
  console.log('rail apres 37 navigations :', JSON.stringify(await p.evaluate(() => (document.getElementById('rail-t') || {}).textContent)));
  console.log('erreurs :', JSON.stringify(errs), JSON.stringify(cons));

  /* ============ C. menu : clic sur un lien du panneau ============ */
  console.log('');
  console.log('=== C. MENU : navigation depuis le panneau ouvert ===');
  await goRoute(p, '/'); await p.waitForTimeout(700);
  await p.click('#nav-open'); await p.waitForTimeout(500);
  const pdt = await p.evaluate(() => ({ bodyNav: document.body.dataset.nav, overflow: getComputedStyle(document.body).overflow }));
  await p.click('#nav .nav__main a[href="/about/"]');
  await p.waitForTimeout(800);
  const ap = await p.evaluate(() => ({
    titre: document.title.slice(0, 30), bodyNav: document.body.dataset.nav,
    overflow: getComputedStyle(document.body).overflow,
    navOpen: (document.getElementById('nav') || {}).dataset ? document.getElementById('nav').dataset.open : null,
    navVis: getComputedStyle(document.getElementById('nav')).visibility,
  }));
  console.log(JSON.stringify({ pendant: pdt, apresClic: ap }));

  /* ============ D. ancre /#exports ============ */
  console.log('');
  console.log('=== D. ANCRE /#exports ===');
  await goRoute(p, '/'); await p.waitForTimeout(600);
  await p.click('#nav-open'); await p.waitForTimeout(400);
  await p.click('#nav a[href="/#exports"]');
  await p.waitForTimeout(900);
  console.log(JSON.stringify(await p.evaluate(() => ({
    scrollY: Math.round(scrollY), titre: document.title.slice(0, 30),
    cibleY: (() => { const e = document.getElementById('exports'); return e ? Math.round(e.getBoundingClientRect().top) : null; })(),
    rail: (document.getElementById('rail-t') || {}).textContent,
  }))));
  await ctx.close();

  /* ============ E. mobile : la barre d'appel et ses observateurs ============ */
  console.log('');
  console.log('=== E. MOBILE — barre d appel, observateurs ===');
  for (const [nom, cible] of [['MAQUETTE', MAQ], ['SITE', SITE + '/']]) {
    const c2 = await nav.newContext(Object.assign({}, devices['iPhone 13']));
    await c2.addInitScript(instrument);
    const p2 = await c2.newPage();
    const e2 = []; p2.on('pageerror', (e) => e2.push(String(e.message)));
    await p2.goto(cible);
    await p2.waitForTimeout(900);
    const lire = () => p2.evaluate(() => {
      const b = document.getElementById('barre');
      return { present: !!b, hidden: b ? b.hidden : null, display: b ? getComputedStyle(b).display : null };
    });
    console.log(nom, 'accueil haut :', JSON.stringify(await lire()), JSON.stringify(await compteurs(p2)));
    await p2.evaluate(() => scrollTo(0, 2000));
    await p2.waitForTimeout(700);
    console.log(nom, 'accueil defile :', JSON.stringify(await lire()));
    if (nom === 'MAQUETTE') {
      for (const r of ROUTES) { await goRoute(p2, r); await p2.waitForTimeout(120); }
      await goRoute(p2, '/'); await p2.waitForTimeout(900);
      console.log(nom, 'apres 19 navigations :', JSON.stringify(await compteurs(p2)));
      await p2.evaluate(() => scrollTo(0, 2000));
      await p2.waitForTimeout(700);
      console.log(nom, 'barre apres 19 nav + defile :', JSON.stringify(await lire()));
      const vus2 = new Set(); const f2 = Date.now() + 5000;
      while (Date.now() < f2) { vus2.add(await p2.evaluate(() => (document.getElementById('board-card') || {}).style.transform)); await sleep(150); }
      console.log(nom, 'transforms mobile :', JSON.stringify([...vus2]));
    }
    console.log(nom, 'erreurs :', JSON.stringify(e2));
    await c2.close();
  }

  await nav.close();
})();
