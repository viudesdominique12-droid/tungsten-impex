/* ANGLE « LA PLAQUE » — quelle variante est REELLEMENT servie, et a quelle
   taille elle est affichee. naturalWidth est corrige par la densite du srcset
   (spec HTML : « density-corrected intrinsic size »), il ne dit donc PAS la
   largeur du fichier. On recharge la ressource seule pour l'obtenir.
   Fichier temporaire d'audit. A supprimer apres lecture. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const FICHES = [
  ['/export/niger-seed-noug/', 'niger-seed-noug', 612, 407],
  ['/export/sesame-seed/', 'sesame-seed', 1254, 705],
  ['/export/red-kidney-beans/', 'red-kidney-beans', 447, 447],
  ['/export/soya-bean/', 'soya-bean', 588, 393],
  ['/import/electric-vehicles/', 'electric-vehicles', 588, 393],
  ['/import/medical-equipment/', 'medical-equipment', 588, 330],
  ['/import/human-medicine/', 'human-medicine', 588, 516],
  ['/import/building-glass/', 'building-glass', 452, 678],
  ['/import/elevator-and-escalator/', 'elevator-and-escalator', 588, 414],
  ['/import/calcium-hypochlorite/', 'calcium-hypochlorite', 1600, 1099],
  ['/import/plastic-raw-materials/', 'plastic-raw-materials', 588, 390],
  ['/import/solar-lanterns/', 'solar-lanterns', 447, 447],
  ['/import/stationery-materials/', 'stationery-materials', 612, 408],
  ['/import/ceramics/', 'ceramics', 516, 387],
];
const FORMATS = [
  ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['tel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];

const sonde = async () => {
  const img = document.querySelector('.plaque img');
  const pic = img.closest('picture');
  const srcs = [...pic.querySelectorAll('source')].map((s) => ({ type: s.type, srcset: s.srcset, sizes: s.sizes }));
  const r = img.getBoundingClientRect();
  // largeur VRAIE de la variante servie : on la recharge hors srcset
  const solo = new Image();
  solo.src = img.currentSrc;
  await solo.decode().catch(() => {});
  return {
    affiche: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
    servi: { w: solo.naturalWidth, h: solo.naturalHeight, url: img.currentSrc },
    dpr: window.devicePixelRatio,
    srcs,
    imgSizes: img.sizes,
    imgSrcset: img.srcset,
  };
};

const out = [];
const nav = await chromium.launch();
for (const [nomF, opt] of FORMATS) {
  const ctx = await nav.newContext(opt);
  const page = await ctx.newPage();
  for (const [route, slug, srcW, srcH] of FICHES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const d = await page.evaluate(sonde);
    out.push({ format: nomF, slug, route, srcW, srcH, ...d });
  }
  await ctx.close();
}
await nav.close();
writeFileSync('verif/plaque-oeil/servi.json', JSON.stringify(out, null, 1));

for (const nomF of ['pc', 'tel']) {
  console.log(`\n===== ${nomF} =====`);
  console.log('slug'.padEnd(24), 'source'.padEnd(10), 'servi'.padEnd(10), 'affiche'.padEnd(13),
              'devPx'.padEnd(7), 'x/servi'.padEnd(8), 'x/source');
  for (const l of out.filter((x) => x.format === nomF)) {
    const devW = l.affiche.w * l.dpr;
    console.log(
      l.slug.padEnd(24),
      `${l.srcW}x${l.srcH}`.padEnd(10),
      `${l.servi.w}x${l.servi.h}`.padEnd(10),
      `${l.affiche.w}x${l.affiche.h}`.padEnd(13),
      devW.toFixed(0).padEnd(7),
      (devW / l.servi.w).toFixed(3).padEnd(8),
      (devW / l.srcW).toFixed(3)
    );
  }
}
console.log('\nsizes annonce (pc) :', out[0].imgSizes, '| variantes :', out[0].imgSrcset.replace(/[^ ,]*\//g, ''));
