/* SCEPTIQUE — le mot-symbole de l'en-tete est-il vraiment sur-servi ?
   Mesure : ressource reellement decodee vs taille reellement rendue,
   sur les deux formats, plus le poids reseau reel. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const ROUTES = ['/', '/about/', '/contact/', '/training/',
  '/export/niger-seed-noug/', '/export/sesame-seed/', '/export/red-kidney-beans/',
  '/export/soya-bean/', '/import/electric-vehicles/', '/import/medical-equipment/',
  '/import/human-medicine/', '/import/building-glass/', '/import/elevator-and-escalator/',
  '/import/calcium-hypochlorite/', '/import/plastic-raw-materials/',
  '/import/solar-lanterns/', '/import/stationery-materials/', '/import/ceramics/'];

const FORMATS = [
  { nom: 'pc',  opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { nom: 'tel', opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
                        isMobile: true, hasTouch: true } },
];

const nav = await chromium.launch();
const sortie = {};

for (const f of FORMATS) {
  const ctx = await nav.newContext(f.opts);
  const page = await ctx.newPage();

  // poids reseau reel des ressources de l'en-tete
  const poids = new Map();
  page.on('response', async (r) => {
    const u = r.url();
    if (!/_image|mot-symbole|embleme/.test(u)) return;
    try {
      const b = await r.body();
      poids.set(u, b.length);
    } catch {}
  });

  const lignes = [];
  for (const route of ROUTES) {
    poids.clear();
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    const m = await page.evaluate(async () => {
      const out = {};
      for (const [cle, sel] of [['mot', '.mark__mot'], ['verrou', '.mark__verrou']]) {
        const i = document.querySelector(sel);
        if (!i) { out[cle] = null; continue; }
        const t = new Image(); t.src = i.currentSrc; await t.decode();
        const r = i.getBoundingClientRect();
        out[cle] = {
          src: i.currentSrc,
          srcset: i.getAttribute('srcset'),
          attrs: [i.getAttribute('width'), i.getAttribute('height')],
          servi: [t.naturalWidth, t.naturalHeight],
          css: [+r.width.toFixed(1), +r.height.toFixed(1)],
          dpr: devicePixelRatio,
          demande: Math.round(r.width * devicePixelRatio),
          exces: +(t.naturalWidth / Math.round(r.width * devicePixelRatio)).toFixed(2),
        };
      }
      return out;
    });
    for (const cle of ['mot', 'verrou']) {
      if (m[cle]) m[cle].octets = poids.get(m[cle].src) ?? null;
    }
    lignes.push({ route, ...m });
  }

  sortie[f.nom] = lignes;

  // capture de l'en-tete pour l'oeil
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.hdr').screenshot({ path: `verif/sq-entete-${f.nom}.png` });
  // loupe : la meme zone agrandie 4x pour juger la nettete
  const box = await page.locator('.hdr .mark').boundingBox();
  await page.screenshot({
    path: `verif/sq-mark-${f.nom}.png`,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    scale: 'device',
  });
  await ctx.close();
}

await nav.close();

// resume
for (const fmt of Object.keys(sortie)) {
  const l = sortie[fmt];
  const uniques = new Set(l.map(x => JSON.stringify([x.mot.servi, x.mot.css, x.mot.octets])));
  console.log('==== ' + fmt + ' — ' + l.length + ' routes, ' + uniques.size + ' mesure(s) distincte(s)');
  console.log('  MOT   ', JSON.stringify(l[0].mot, null, 0));
  console.log('  VERROU', JSON.stringify(l[0].verrou, null, 0));
  if (uniques.size > 1) for (const u of uniques) console.log('   variante', u);
}
import { writeFileSync } from 'fs';
writeFileSync('verif/sq-mesures.json', JSON.stringify(sortie, null, 2));
