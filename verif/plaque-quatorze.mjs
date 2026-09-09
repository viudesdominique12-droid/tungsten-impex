/* ANGLE « LA PLAQUE » — mesure des quatorze fiches produit, deux formats.
   Fichier temporaire d'audit. A supprimer apres lecture. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const OUT = 'verif/plaque-oeil';
mkdirSync(OUT, { recursive: true });

const FICHES = [
  ['/export/niger-seed-noug/', 'niger-seed-noug'],
  ['/export/sesame-seed/', 'sesame-seed'],
  ['/export/red-kidney-beans/', 'red-kidney-beans'],
  ['/export/soya-bean/', 'soya-bean'],
  ['/import/electric-vehicles/', 'electric-vehicles'],
  ['/import/medical-equipment/', 'medical-equipment'],
  ['/import/human-medicine/', 'human-medicine'],
  ['/import/building-glass/', 'building-glass'],
  ['/import/elevator-and-escalator/', 'elevator-and-escalator'],
  ['/import/calcium-hypochlorite/', 'calcium-hypochlorite'],
  ['/import/plastic-raw-materials/', 'plastic-raw-materials'],
  ['/import/solar-lanterns/', 'solar-lanterns'],
  ['/import/stationery-materials/', 'stationery-materials'],
  ['/import/ceramics/', 'ceramics'],
];

const FORMATS = [
  ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['tel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];

const mesure = () => {
  const f = document.querySelector('.plaque');
  if (!f) return { absent: true };
  const img = f.querySelector('img');
  const rf = f.getBoundingClientRect();
  const ri = img.getBoundingClientRect();
  const cs = getComputedStyle(f);
  const ci = getComputedStyle(img);
  const pad = {
    t: parseFloat(cs.paddingTop), r: parseFloat(cs.paddingRight),
    b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft),
  };
  const inW = rf.width - pad.l - pad.r;
  const inH = rf.height - pad.t - pad.b;
  return {
    plaque: { w: +rf.width.toFixed(1), h: +rf.height.toFixed(1), ratio: +(rf.width / rf.height).toFixed(4) },
    interieur: { w: +inW.toFixed(1), h: +inH.toFixed(1) },
    pad,
    img: {
      w: +ri.width.toFixed(1), h: +ri.height.toFixed(1),
      ratioAffiche: +(ri.width / ri.height).toFixed(4),
      natW: img.naturalWidth, natH: img.naturalHeight,
      ratioNat: +(img.naturalWidth / img.naturalHeight).toFixed(4),
      src: (img.currentSrc || '').split('/').pop(),
      fit: ci.objectFit,
    },
    fond: cs.backgroundColor,
    ombre: cs.boxShadow,
    bord: cs.borderTopWidth + ' ' + cs.borderStyle + ' ' + cs.borderTopColor,
    rayon: cs.borderTopLeftRadius,
    ombreImg: ci.boxShadow,
    bordImg: ci.borderTopWidth,
    debordement: {
      // l'image depasse-t-elle la boite interieure ?
      dx: +(ri.width - inW).toFixed(1),
      dy: +(ri.height - inH).toFixed(1),
    },
  };
};

const lignes = [];

const nav = await chromium.launch();
for (const [nomF, opt] of FORMATS) {
  const ctx = await nav.newContext(opt);
  const page = await ctx.newPage();
  for (const [route, slug] of FICHES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    const m = await page.evaluate(mesure);
    m.route = route; m.slug = slug; m.format = nomF;
    lignes.push(m);
    const el = page.locator('.plaque');
    await el.screenshot({ path: `${OUT}/${nomF}-${slug}.png` });
    // et la section entiere, pour juger de la composition
    await page.locator('section.intro').screenshot({ path: `${OUT}/${nomF}-${slug}-SECTION.png` });
  }
  await ctx.close();
}
await nav.close();

writeFileSync(`${OUT}/mesures.json`, JSON.stringify(lignes, null, 1));

// ---- tableau lisible
for (const nomF of ['pc', 'tel']) {
  console.log(`\n===== ${nomF} =====`);
  console.log(
    'slug'.padEnd(24), 'plaque'.padEnd(14), 'r'.padEnd(7),
    'img'.padEnd(14), 'rAff'.padEnd(7), 'rNat'.padEnd(7),
    'agrand'.padEnd(7), 'rempl'.padEnd(7), 'nat'
  );
  for (const l of lignes.filter((x) => x.format === nomF)) {
    const agr = l.img.w / l.img.natW;
    const rempl = (l.img.w * l.img.h) / (l.interieur.w * l.interieur.h);
    console.log(
      l.slug.padEnd(24),
      `${l.plaque.w}x${l.plaque.h}`.padEnd(14),
      String(l.plaque.ratio).padEnd(7),
      `${l.img.w}x${l.img.h}`.padEnd(14),
      String(l.img.ratioAffiche).padEnd(7),
      String(l.img.ratioNat).padEnd(7),
      agr.toFixed(3).padEnd(7),
      (rempl * 100).toFixed(1).padStart(5) + '%',
      `${l.img.natW}x${l.img.natH}`
    );
  }
}

console.log('\n--- decor de la plaque (pc, premiere fiche) ---');
const p0 = lignes.find((l) => l.format === 'pc');
console.log(JSON.stringify({ fond: p0.fond, ombre: p0.ombre, bord: p0.bord, rayon: p0.rayon, ombreImg: p0.ombreImg, bordImg: p0.bordImg, fit: p0.img.fit }, null, 1));

console.log('\n--- debordements (image plus grande que la boite interieure) ---');
for (const l of lignes) {
  if (l.debordement.dx > 0.5 || l.debordement.dy > 0.5) {
    console.log(l.format, l.slug, JSON.stringify(l.debordement));
  }
}
