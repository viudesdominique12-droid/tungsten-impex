/* ANGLE : la coherence d'une fiche a l'autre.
   Mesure les quatorze fiches dans les deux formats et rend un JSON. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4321';
const SORTANTS = ['niger-seed-noug', 'sesame-seed', 'red-kidney-beans', 'soya-bean'];
const ENTRANTS = ['electric-vehicles', 'medical-equipment', 'human-medicine', 'building-glass',
  'elevator-and-escalator', 'calcium-hypochlorite', 'plastic-raw-materials',
  'solar-lanterns', 'stationery-materials', 'ceramics'];
const ROUTES = [
  ...SORTANTS.map((s) => ({ slug: s, url: `/export/${s}/` })),
  ...ENTRANTS.map((s) => ({ slug: s, url: `/import/${s}/` })),
];

const FORMATS = {
  bureau: { width: 1440, height: 900, deviceScaleFactor: 1 },
  tel: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const mesure = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }; };
  const out = {};
  out.pageH = document.documentElement.scrollHeight;
  out.pageW = document.documentElement.scrollWidth;

  const sections = [...document.querySelectorAll('article > section, article > header')];
  out.sections = sections.map((s) => {
    const b = r(s);
    return {
      cls: s.className,
      type: s.dataset.type || null,
      sol: s.dataset.sol || null,
      rail: s.dataset.railSection || null,
      y: Math.round(b.y), h: Math.round(b.h),
      bg: getComputedStyle(s).backgroundColor,
    };
  });

  const tete = document.querySelector('.tete');
  out.tete = tete ? { h: Math.round(r(tete).h), y: Math.round(r(tete).y) } : null;
  const h1 = document.querySelector('.tete__h');
  if (h1) { const b = r(h1); out.h1 = { y: Math.round(b.y), h: Math.round(b.h), fs: getComputedStyle(h1).fontSize, txt: h1.textContent.trim(), lines: Math.round(b.h / parseFloat(getComputedStyle(h1).lineHeight)) }; }

  const pl = document.querySelector('.plaque');
  if (pl) {
    const b = r(pl);
    out.plaque = { y: Math.round(b.y), h: Math.round(b.h), w: Math.round(b.w) };
    const im = pl.querySelector('img');
    if (im) {
      const ib = r(im);
      out.img = {
        w: Math.round(ib.w), h: Math.round(ib.h),
        y: Math.round(ib.y),
        nat: im.naturalWidth + 'x' + im.naturalHeight,
        natW: im.naturalWidth, natH: im.naturalHeight,
        src: (im.currentSrc || '').split('/').pop(),
        // part de la plaque reellement occupee par l'image
        remplissage: +((ib.w * ib.h) / (b.w * b.h)).toFixed(3),
        marge_g: Math.round(ib.x - b.x),
        marge_h: Math.round(ib.y - b.y),
      };
    }
  }

  const intro = document.querySelector('.intro__in');
  if (intro) out.intro = { h: Math.round(r(intro).h), cols: getComputedStyle(intro).gridTemplateColumns };
  const lead = document.querySelector('.intro__lead');
  if (lead) { const b = r(lead); out.lead = { y: Math.round(b.y), h: Math.round(b.h), lines: Math.round(b.h / parseFloat(getComputedStyle(lead).lineHeight)) }; }

  out.specs = [...document.querySelectorAll('.index__l')].length;
  const specsSec = document.querySelector('.specs');
  out.specsH = specsSec ? Math.round(r(specsSec).h) : 0;
  out.blocs = [...document.querySelectorAll('.bloc')].length;

  // grille du pied
  const cartes = [...document.querySelectorAll('.onward .carte')];
  out.nbCartes = cartes.length;
  if (cartes.length) {
    const grille = document.querySelector('.onward .cartes');
    out.cartesCols = getComputedStyle(grille).gridTemplateColumns.split(' ').length;
    const rows = {};
    cartes.forEach((c) => { const y = Math.round(r(c).y); (rows[y] ||= []).push(Math.round(r(c).w)); });
    out.rangees = Object.keys(rows).sort((a, b) => a - b).map((y) => rows[y].length);
    out.derniereRangee = out.rangees[out.rangees.length - 1];
    out.carteH = [...new Set(cartes.map((c) => Math.round(r(c).h)))];
  }
  return out;
};

const dossier = 'verif/coh-tmp';
const res = {};
const nav = await chromium.launch();
for (const [fmt, vp] of Object.entries(FORMATS)) {
  const ctx = await nav.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  res[fmt] = {};
  for (const { slug, url } of ROUTES) {
    const p = await ctx.newPage();
    await p.goto(BASE + url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(180);
    res[fmt][slug] = await p.evaluate(mesure);
    if (process.env.SHOTS === '1') {
      await p.screenshot({ path: `${dossier}/${fmt}-${slug}.png`, fullPage: true });
    }
    await p.close();
  }
  await ctx.close();
}
await nav.close();
fs.writeFileSync(`${dossier}/mesures.json`, JSON.stringify(res, null, 1));
console.log('ok');
