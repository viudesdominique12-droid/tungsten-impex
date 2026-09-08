/* Mesure cote a cote : maquette (fichier unique) vs site servi.
   Ecrit verif/parite-tmp/mesures.json. Script temporaire. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';

const ROUTES = JSON.parse(readFileSync('verif/parite-tmp/routes.json', 'utf8'));
const MAQ = 'file:///' + process.cwd().split(String.fromCharCode(92)).join('/').split(' ').join('%20') + '/verif/maquette.html';
const SITE = 'http://localhost:4321';

const SONDE = () => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const col = (sel, prop) => {
    const e = document.querySelector(sel);
    return e ? getComputedStyle(e)[prop] : null;
  };
  const n = (sel) => document.querySelectorAll(sel).length;
  const nuit = document.querySelector('[data-sol="nuit"]');
  const act = document.querySelector('.act');
  const b = getComputedStyle(document.body);
  return {
    titre: document.title,
    texte: norm(document.body.innerText),
    hauteur: document.documentElement.scrollHeight,
    n: {
      'section[data-type]': n('section[data-type]'),
      '.index__l': n('.index__l'),
      '.carte': n('.carte'),
      '.conduite': n('.conduite'),
      '.t-label': n('.t-label'),
      img: n('img'),
      'section': n('section'),
      '[data-sol]': n('[data-sol]'),
      'a[href]': n('a[href]'),
    },
    couleurs: {
      bodyBg: b.backgroundColor,
      bodyFg: b.color,
      bodyFont: b.fontFamily,
      nuitBg: nuit ? getComputedStyle(nuit).backgroundColor : null,
      nuitFg: nuit ? getComputedStyle(nuit).color : null,
      actBg: act ? getComputedStyle(act).backgroundColor : null,
      actFg: act ? getComputedStyle(act).color : null,
      h1Font: col('h1', 'fontFamily'),
      h1Size: col('h1', 'fontSize'),
    },
    imgCassees: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    imgTotal: document.images.length,
  };
};

const attendre = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  // forcer les revelations au scroll
  await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
};

const nav = { width: 1440, height: 900 };
const b = await chromium.launch();

// --- site servi ---
const ctxS = await b.newContext({ viewport: nav, deviceScaleFactor: 1 });
const pS = await ctxS.newPage();
const site = {};
for (const r of ROUTES) {
  await pS.goto(SITE + r, { waitUntil: 'networkidle' });
  await attendre(pS);
  site[r] = await pS.evaluate(SONDE);
}
await ctxS.close();

// --- maquette ---
const ctxM = await b.newContext({ viewport: nav, deviceScaleFactor: 1 });
const pM = await ctxM.newPage();
const erreurs = [];
pM.on('pageerror', (e) => erreurs.push(String(e)));
await pM.goto(MAQ, { waitUntil: 'load' });
const maq = {};
for (const r of ROUTES) {
  await pM.evaluate((route) => {
    const a = document.createElement('a'); a.href = route; document.body.append(a); a.click(); a.remove();
  }, r);
  await attendre(pM);
  maq[r] = await pM.evaluate(SONDE);
}
await ctxM.close();
await b.close();

writeFileSync('verif/parite-tmp/mesures.json', JSON.stringify({ site, maq, erreurs }, null, 1));
console.log('OK', ROUTES.length, 'routes; erreurs js maquette:', erreurs.length);
