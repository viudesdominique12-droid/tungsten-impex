/* Audit IMAGES — maquette vs site servi. Fichier temporaire, a supprimer. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const SITE = 'http://localhost:4321';

const RECOLTE = () => {
  const out = { url: location.href, imgs: [], sources: 0, srcsets: 0, astro: [] };
  out.sources = document.querySelectorAll('source').length;
  out.srcsets = document.querySelectorAll('[srcset]').length;
  for (const el of document.querySelectorAll('[src],[srcset],[href]')) {
    for (const a of ['src', 'srcset', 'href']) {
      const v = el.getAttribute(a);
      if (v && v.includes('/_astro')) out.astro.push(el.tagName + '@' + a + '=' + v.slice(0, 90));
    }
  }
  const shell = document.querySelector('main .shell, .shell');
  const shellBox = shell ? shell.getBoundingClientRect() : null;
  for (const im of document.querySelectorAll('img')) {
    const r = im.getBoundingClientRect();
    const cs = getComputedStyle(im);
    const fig = im.closest('figure');
    const pleine = !!im.closest('.pleine');
    let cap = null;
    if (pleine && fig) {
      const c = fig.querySelector('figcaption');
      const cshell = fig.querySelector('figcaption .shell');
      if (c) {
        const cr = c.getBoundingClientRect();
        const sr = cshell ? cshell.getBoundingClientRect() : null;
        cap = {
          capLeft: Math.round(cr.left), capW: Math.round(cr.width),
          shellLeft: sr ? Math.round(sr.left) : null,
          shellW: sr ? Math.round(sr.width) : null,
          hasShell: !!cshell,
          shellDisplay: cshell ? getComputedStyle(cshell).display : null,
        };
      }
    }
    out.imgs.push({
      srcKind: (im.currentSrc || im.src || '').slice(0, 22),
      srcLen: (im.currentSrc || im.src || '').length,
      alt: (im.alt || '').slice(0, 60),
      nw: im.naturalWidth, nh: im.naturalHeight,
      complete: im.complete,
      dw: +r.width.toFixed(1), dh: +r.height.toFixed(1),
      left: Math.round(r.left), right: Math.round(r.right),
      attrW: im.getAttribute('width'), attrH: im.getAttribute('height'),
      objectFit: cs.objectFit,
      figClass: fig ? fig.className : null,
      pleine,
      cap,
    });
  }
  out.shell = shellBox ? { left: Math.round(shellBox.left), w: Math.round(shellBox.width) } : null;
  out.vw = innerWidth; out.vh = innerHeight;
  out.docW = document.documentElement.scrollWidth;
  return out;
};

const nav = async (page, route) => {
  await page.evaluate((r) => {
    const a = document.createElement('a');
    a.href = r; a.textContent = '.'; document.body.append(a); a.click(); a.remove();
  }, route);
  await page.waitForTimeout(450);
  // attendre le decodage des data URI
  await page.evaluate(() => Promise.all(
    [...document.images].map((i) => i.complete ? null : new Promise((res) => {
      i.addEventListener('load', res, { once: true });
      i.addEventListener('error', res, { once: true });
      setTimeout(res, 3000);
    }))));
  await page.waitForTimeout(250);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const erreurs = [];
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => erreurs.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto(MAQ);
await page.waitForTimeout(600);
const routes = await page.evaluate(() =>
  Object.keys(JSON.parse(document.getElementById('routes').textContent)).sort());
console.log('routes maquette:', routes.length, routes.join(' '));

const maq = {};
for (const r of routes) {
  await nav(page, r);
  maq[r] = await page.evaluate(RECOLTE);
}

// site servi
const p2 = await ctx.newPage();
const site = {};
for (const r of routes) {
  await p2.goto(SITE + r, { waitUntil: 'load' });
  await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p2.waitForTimeout(400);
  await p2.evaluate(() => window.scrollTo(0, 0));
  await p2.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? null :
    new Promise((res) => { i.addEventListener('load', res, { once: true });
      i.addEventListener('error', res, { once: true }); setTimeout(res, 3000); }))));
  await p2.waitForTimeout(250);
  site[r] = await p2.evaluate(RECOLTE);
}

writeFileSync('verif/zz-images-audit.json', JSON.stringify({ maq, site, erreurs }, null, 1));

/* ---- rapport ---- */
let totMaq = 0, totSite = 0;
for (const r of routes) {
  const M = maq[r], S = site[r];
  totMaq += M.imgs.length; totSite += S.imgs.length;
  const casse = M.imgs.filter((i) => !(i.nw > 0));
  const ligne = [`${r}`.padEnd(34),
    `maq ${String(M.imgs.length).padStart(2)} img (${M.imgs.length - casse.length} decodees)`,
    `site ${String(S.imgs.length).padStart(2)}`,
    M.sources || M.srcsets || M.astro.length ? `!! source=${M.sources} srcset=${M.srcsets} astro=${M.astro.length}` : '',
  ].join('  ');
  console.log(ligne);
  if (casse.length) for (const c of casse) console.log('    CASSE', JSON.stringify(c).slice(0, 200));
  if (M.astro.length) console.log('    ASTRO', M.astro.join(' | '));
}
console.log(`TOTAL maquette ${totMaq}  site ${totSite}`);

console.log('\n--- AGRANDISSEMENT (dw > nw) ---');
for (const [nom, jeu] of [['maq', maq], ['site', site]]) {
  for (const r of routes) for (const i of jeu[r].imgs) {
    if (i.nw > 0 && i.dw > i.nw + 0.5) {
      console.log(`${nom} ${r} dw=${i.dw} nw=${i.nw} ratio=${(i.dw / i.nw).toFixed(2)} pleine=${i.pleine} alt=${i.alt}`);
    }
  }
}

console.log('\n--- BANDES PLEINES ---');
for (const [nom, jeu] of [['maq', maq], ['site', site]]) {
  for (const r of routes) for (const i of jeu[r].imgs) {
    if (!i.pleine) continue;
    console.log(`${nom} ${r} h=${i.dh} w=${i.dw} (vw=${jeu[r].vw}) fit=${i.objectFit} left=${i.left} right=${i.right} cap=${JSON.stringify(i.cap)}`);
  }
}

console.log('\n--- SHELL page ---');
for (const r of routes) console.log(r, 'maq', JSON.stringify(maq[r].shell), ' site', JSON.stringify(site[r].shell));

console.log('\nerreurs console maquette:', erreurs.length, erreurs.slice(0, 10));
await b.close();
