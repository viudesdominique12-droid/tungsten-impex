/* Angle : les scripts rejoues par le routeur de la maquette. */
import { chromium } from 'playwright';

const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const SITE = 'http://localhost:4321';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const instrument = `
  window.__T = { vivants: new Set(), scroll: 0, keydown: 0, vis: 0, resize: 0 };
  const si = window.setInterval, st = window.setTimeout,
        ci = window.clearInterval, ct = window.clearTimeout;
  window.setTimeout = function (f, d) {
    const id = st(function () { window.__T.vivants.delete(id); return f && f.apply(this, arguments); }, d);
    window.__T.vivants.add(id); return id;
  };
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
    return ael.call(this, t, f, o);
  };
`;

const goRoute = (page, r) => page.evaluate((route) => {
  const a = document.createElement('a'); a.href = route; document.body.append(a); a.click(); a.remove();
}, r);

const formeBoard = () => {
  const board = document.getElementById('board');
  const card = document.getElementById('board-card');
  if (!board || !card) return { present: false };
  const cs = getComputedStyle(card), bs = getComputedStyle(board);
  const faces = [...card.querySelectorAll('.board__face')].map((f) => {
    const s = getComputedStyle(f);
    return { position: s.position, backfaceVisibility: s.backfaceVisibility,
             transform: s.transform, bg: s.backgroundColor, sol: f.dataset.sol,
             h: Math.round(f.getBoundingClientRect().height) };
  });
  return { present: true, perspective: bs.perspective, transformStyle: cs.transformStyle,
           cardTransform: cs.transform, cardInline: card.style.transform,
           cardH: Math.round(card.getBoundingClientRect().height),
           nFaces: faces.length, faces,
           dir: card.dataset.dir, href: card.getAttribute('href') };
};

const formeRuban = () => {
  const p = document.querySelector('.ruban__piste');
  if (!p) return { present: false };
  const s = getComputedStyle(p);
  const anims = p.getAnimations ? p.getAnimations().map((a) => ({ n: a.animationName, st: a.playState })) : [];
  return { present: true, animationName: s.animationName, playState: s.animationPlayState,
           duration: s.animationDuration, width: Math.round(p.getBoundingClientRect().width),
           vw: 1440, lots: p.querySelectorAll('.ruban__lot').length,
           entrees: p.querySelectorAll('.ruban__e').length, anims };
};

const idsDupliques = () => {
  const n = {}; for (const el of document.querySelectorAll('[id]')) n[el.id] = (n[el.id] || 0) + 1;
  return Object.entries(n).filter((e) => e[1] > 1);
};

function auditer(page) {
  const erreurs = [], consoleErr = [];
  page.on('pageerror', (e) => erreurs.push(String(e.message || e)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleErr.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  return { erreurs, consoleErr };
}

const dump = (o) => console.log(JSON.stringify(o, null, 1));

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(instrument);
  const page = await ctx.newPage();
  const jrn = auditer(page);

  await page.goto(MAQ);
  await page.waitForTimeout(1200);

  console.log('=== 1. MAQUETTE / accueil (premier rendu) ===');
  dump({ board: await page.evaluate(formeBoard), ruban: await page.evaluate(formeRuban) });

  const suivre = async (ms) => {
    const vus = new Set(), sols = new Set(), noms = new Set();
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const e = await page.evaluate(() => {
        const c = document.getElementById('board-card');
        if (!c) return null;
        const f = [...c.querySelectorAll('.board__face')];
        return { t: c.style.transform,
                 sols: f.map((x) => x.dataset.sol + ':' + getComputedStyle(x).backgroundColor).join('|'),
                 noms: f.map((x) => (x.querySelector('.board__n') || {}).textContent).join('|') };
      });
      if (e) { vus.add(e.t); sols.add(e.sols); noms.add(e.noms); }
      await sleep(150);
    }
    return { transforms: [...vus], fonds: [...sols], textes: [...noms].slice(0, 6) };
  };
  console.log('--- rotation accueil (6s) ---');
  dump(await suivre(6000));

  console.log('--- rail ---');
  dump(await page.evaluate(() => {
    const t = document.getElementById('rail-t');
    return { existe: !!t, texte: t ? t.textContent : null,
             prefixe: (document.querySelector('.rail__p') || {}).textContent,
             display: t ? getComputedStyle(document.getElementById('rail')).display : null,
             sections: [...document.querySelectorAll('[data-rail-section]')].map((s) => s.dataset.railSection) };
  }));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight * 0.45));
  await page.waitForTimeout(500);
  console.log('rail 45% :', JSON.stringify(await page.evaluate(() => (document.getElementById('rail-t') || {}).textContent)));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight * 0.8));
  await page.waitForTimeout(500);
  console.log('rail 80% :', JSON.stringify(await page.evaluate(() => (document.getElementById('rail-t') || {}).textContent)));
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);

  console.log('--- menu ---');
  const menu = async (p) => {
    const av = await p.evaluate(() => {
      const n = document.getElementById('nav');
      return { open: n.dataset.open, opacity: getComputedStyle(n).opacity, vis: getComputedStyle(n).visibility };
    });
    let ap = null, fermer = null;
    try {
      await p.click('#nav-open', { timeout: 3000 });
      await p.waitForTimeout(600);
      ap = await p.evaluate(() => {
        const n = document.getElementById('nav');
        return { open: n.dataset.open, opacity: getComputedStyle(n).opacity, vis: getComputedStyle(n).visibility,
                 ariaExpanded: document.getElementById('nav-open').getAttribute('aria-expanded'),
                 bodyNav: document.body.dataset.nav };
      });
    } catch (e) { ap = 'ECHEC OUVERTURE: ' + String(e.message).slice(0, 200); }
    try {
      await p.click('#nav-close', { timeout: 3000 });
      await p.waitForTimeout(600);
      fermer = await p.evaluate(() => {
        const n = document.getElementById('nav');
        return { open: n.dataset.open, opacity: getComputedStyle(n).opacity, vis: getComputedStyle(n).visibility };
      });
    } catch (e) { fermer = 'ECHEC FERMETURE: ' + String(e.message).slice(0, 200); }
    return { avant: av, apresOuverture: ap, apresFermeture: fermer };
  };
  dump(await menu(page));

  const compteurs = (p) => p.evaluate(() => ({
    minuteries: window.__T.vivants.size, scroll: window.__T.scroll,
    keydown: window.__T.keydown, visibilitychange: window.__T.vis, resize: window.__T.resize,
  }));
  console.log('compteurs apres accueil :', JSON.stringify(await compteurs(page)));
  console.log('ids dupliques :', JSON.stringify(await page.evaluate(idsDupliques)));

  console.log('');
  console.log('=== 2. PARCOURS ===');
  const parcours = ['/about/', '/export/sesame-seed/', '/contact/', '/training/', '/import/ceramics/', '/'];
  for (const r of parcours) {
    await goRoute(page, r);
    await page.waitForTimeout(900);
    const etat = await page.evaluate(() => ({
      titre: document.title.slice(0, 40),
      bodyAttrs: [...document.body.attributes].map((a) => a.name + '=' + a.value),
      rail: (document.getElementById('rail-t') || {}).textContent,
      board: !!document.getElementById('board-card'),
      ruban: !!document.querySelector('.ruban__piste'),
    }));
    const c = await compteurs(page);
    console.log(r, JSON.stringify(Object.assign(etat, c, { dupes: await page.evaluate(idsDupliques) })));
  }

  console.log('');
  console.log('=== 3. RETOUR ACCUEIL ===');
  dump({ board: await page.evaluate(formeBoard), ruban: await page.evaluate(formeRuban) });
  console.log('--- rotation apres retour (6s) ---');
  dump(await suivre(6000));

  await page.evaluate(() => scrollTo(0, document.body.scrollHeight * 0.45));
  await page.waitForTimeout(500);
  console.log('rail 45% apres retour :', JSON.stringify(await page.evaluate(() => (document.getElementById('rail-t') || {}).textContent)));
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);

  console.log('--- menu apres retour ---');
  dump(await menu(page));
  console.log('compteurs finaux :', JSON.stringify(await compteurs(page)));
  console.log('ids dupliques finaux :', JSON.stringify(await page.evaluate(idsDupliques)));

  console.log('');
  console.log('=== ERREURS MAQUETTE ===');
  console.log('pageerror :', JSON.stringify(jrn.erreurs, null, 1));
  console.log('console   :', JSON.stringify(jrn.consoleErr.slice(0, 40), null, 1));

  await page.close();

  console.log('');
  console.log('=== 4. SITE SERVI (temoin) ===');
  const p2 = await ctx.newPage();
  const jrn2 = auditer(p2);
  await p2.goto(SITE + '/', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1200);
  dump({ board: await p2.evaluate(formeBoard), ruban: await p2.evaluate(formeRuban) });
  const vus = new Set(); const fin = Date.now() + 6000;
  while (Date.now() < fin) {
    vus.add(await p2.evaluate(() => (document.getElementById('board-card') || {}).style.transform));
    await sleep(150);
  }
  console.log('transforms site :', JSON.stringify([...vus]));
  console.log('rail site :', JSON.stringify(await p2.evaluate(() => (document.getElementById('rail-t') || {}).textContent)));
  await p2.evaluate(() => scrollTo(0, document.body.scrollHeight * 0.45));
  await p2.waitForTimeout(500);
  console.log('rail site 45% :', JSON.stringify(await p2.evaluate(() => (document.getElementById('rail-t') || {}).textContent)));
  console.log('menu site :');
  dump(await menu(p2));
  console.log('compteurs site :', JSON.stringify(await compteurs(p2)));
  console.log('erreurs site :', JSON.stringify(jrn2.erreurs), JSON.stringify(jrn2.consoleErr.slice(0, 20)));

  await nav.close();
})();
