/* ANGLE « est-ce vraiment laid » : la plaque produit, mesuree ET regardee.
   Script jetable — a supprimer apres lecture. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('.', import.meta.url));
const B = 'http://localhost:4321';

const routes = [
  ['/export/niger-seed-noug/', 'niger'],
  ['/export/sesame-seed/', 'sesame'],
  ['/export/red-kidney-beans/', 'rkb'],
  ['/export/soya-bean/', 'soya'],
  ['/import/electric-vehicles/', 'ev'],
  ['/import/medical-equipment/', 'medeq'],
  ['/import/human-medicine/', 'medic'],
  ['/import/building-glass/', 'glass'],
  ['/import/elevator-and-escalator/', 'lift'],
  ['/import/calcium-hypochlorite/', 'chlore'],
  ['/import/plastic-raw-materials/', 'plast'],
  ['/import/solar-lanterns/', 'lantern'],
  ['/import/stationery-materials/', 'stat'],
  ['/import/ceramics/', 'ceram'],
];

const mesure = () => {
  const f = document.querySelector('.plaque.intro__img');
  const i = f?.querySelector('img');
  if (!i) return null;
  const fr = f.getBoundingClientRect(), ir = i.getBoundingClientRect();
  return {
    sizes: i.getAttribute('sizes'),
    srcset: i.getAttribute('srcset'),
    cadreW: +fr.width.toFixed(1), cadreH: +fr.height.toFixed(1),
    imgW: +ir.width.toFixed(1), imgH: +ir.height.toFixed(1),
    nat: i.naturalWidth, natH: i.naturalHeight,
    src: i.currentSrc,
    dpr: window.devicePixelRatio,
  };
};

const b = await chromium.launch();
const lignes = [];
for (const [nom, ctx] of [
  ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['tel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const c = await b.newContext(ctx);
  const p = await c.newPage();
  for (const [route, court] of routes) {
    await p.goto(B + route, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const m = await p.evaluate(mesure);
    if (!m) { console.log(nom, court, 'PAS DE PLAQUE'); continue; }
    // octets du fichier reellement servi
    const octets = await p.evaluate(async (u) => {
      const r = await fetch(u); const b = await r.blob(); return b.size;
    }, m.src);
    const annonce = nom === 'pc' ? 620 : Math.round(390 * 0.92);
    const besoin = Math.round(m.imgW * m.dpr);
    lignes.push({ vue: nom, page: court, ...m, octets, annonce, besoin,
      ratio: +(m.nat / besoin).toFixed(2), prop: +(m.natH ? (m.nat / m.natH) : 0).toFixed(2) });
    console.log(`${nom} ${court.padEnd(8)} cadre ${String(m.cadreW).padStart(6)}x${String(m.cadreH).padEnd(6)} img ${String(m.imgW).padStart(6)}x${String(m.imgH).padEnd(6)} annonce ${annonce} besoin ${besoin} servi ${m.nat}w (${(m.octets/1024).toFixed(1)}Ko) trop=${(m.nat/besoin).toFixed(2)}x`);
  }
  await c.close();
}
await import('node:fs').then(fs => fs.writeFileSync(`${OUT}/zlaid-mesures.json`, JSON.stringify(lignes, null, 1)));
await b.close();
