/* Deuxieme passe : animation gelee (prefers-reduced-motion), geometrie par
   section, styles calcules elargis. Script temporaire. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';

const ROUTES = JSON.parse(readFileSync('verif/parite-tmp/routes.json', 'utf8'));
const MAQ = 'file:///' + process.cwd().split(String.fromCharCode(92)).join('/').split(' ').join('%20') + '/verif/maquette.html';
const SITE = 'http://localhost:4321';

const SONDE = () => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const geo = [...document.querySelectorAll('section, figure.pleine, .ruban, header, footer')]
    .map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return {
        tag: e.tagName.toLowerCase(),
        cls: e.className.toString().slice(0, 40),
        type: e.dataset.type || '',
        sol: e.dataset.sol || '',
        w: Math.round(r.width), h: Math.round(r.height),
        bg: cs.backgroundColor, fg: cs.color,
      };
    });
  const styles = {};
  for (const sel of ['body', 'h1', '.t-label', '.t-lead', '.act', '.index__l', '.carte',
                     '.conduite', '[data-sol="nuit"]', '[data-sol="accent"]', '[data-sol="wash"]',
                     '.shell', 'footer', '.ruban__piste', '.board', 'nav a']) {
    const e = document.querySelector(sel);
    if (!e) { styles[sel] = null; continue; }
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    styles[sel] = [cs.fontFamily.split(',')[0], cs.fontSize, cs.fontWeight, cs.color,
                   cs.backgroundColor, cs.letterSpacing, cs.lineHeight,
                   Math.round(r.width) + 'x' + Math.round(r.height)].join(' | ');
  }
  return {
    lang: document.documentElement.lang,
    titre: document.title,
    texte: norm(document.body.innerText),
    hauteur: document.documentElement.scrollHeight,
    largeurScroll: document.documentElement.scrollWidth,
    geo, styles,
    imgDim: [...document.images].map((i) => `${i.naturalWidth}x${i.naturalHeight}->${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`),
  };
};

const attendre = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
};

const b = await chromium.launch();
const opts = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };

const ctxS = await b.newContext(opts);
const pS = await ctxS.newPage();
const site = {};
for (const r of ROUTES) { await pS.goto(SITE + r, { waitUntil: 'networkidle' }); await attendre(pS); site[r] = await pS.evaluate(SONDE); }
await ctxS.close();

const ctxM = await b.newContext(opts);
const pM = await ctxM.newPage();
const erreurs = [];
pM.on('pageerror', (e) => erreurs.push(String(e)));
pM.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
await pM.goto(MAQ, { waitUntil: 'load' });
const maq = {};
for (const r of ROUTES) {
  await pM.evaluate((route) => { const a = document.createElement('a'); a.href = route; document.body.append(a); a.click(); a.remove(); }, r);
  await attendre(pM);
  maq[r] = await pM.evaluate(SONDE);
}
await ctxM.close();
await b.close();
writeFileSync('verif/parite-tmp/fin.json', JSON.stringify({ site, maq, erreurs }, null, 1));
console.log('OK; erreurs maquette:', erreurs.length, erreurs.slice(0, 5));
