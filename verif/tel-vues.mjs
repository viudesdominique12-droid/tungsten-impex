/* ---------------------------------------------------------------------------
   ANGLE TELEPHONE — captures et nettete reelle.

   Correction sur la mesure precedente : `img.naturalWidth` d'une image tiree
   d'un `srcset` est CORRIGE DE LA DENSITE — il rend la taille intrinseque
   divisee par la densite retenue, pas les pixels du fichier. On recharge donc
   chaque `currentSrc` dans une Image() nue, sans srcset, pour lire les vrais
   pixels et juger la nettete a densite double.

   On garde aussi : la plaque (part de la boite occupee par l'image), et une
   tranche de 844px tous les 844px sur les 18 routes.

   Usage : node verif/tel-vues.mjs
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const OUT = 'verif/tel-vues';
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['/', 'accueil'], ['/about/', 'about'], ['/contact/', 'contact'], ['/training/', 'training'],
  ['/export/niger-seed-noug/', 'x-niger'], ['/export/sesame-seed/', 'x-sesame'],
  ['/export/red-kidney-beans/', 'x-kidney'], ['/export/soya-bean/', 'x-soya'],
  ['/import/electric-vehicles/', 'i-vehicules'], ['/import/medical-equipment/', 'i-materiel'],
  ['/import/human-medicine/', 'i-medicament'], ['/import/building-glass/', 'i-verre'],
  ['/import/elevator-and-escalator/', 'i-escalator'], ['/import/calcium-hypochlorite/', 'i-chlore'],
  ['/import/plastic-raw-materials/', 'i-plastique'], ['/import/solar-lanterns/', 'i-lanternes'],
  ['/import/stationery-materials/', 'i-bureau'], ['/import/ceramics/', 'i-ceramique'],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage();

const bilan = [];

for (const [route, nom] of ROUTES) {
  /* deux chargements : le serveur de developpement compile parfois pendant le
     premier et rend une page nue (mesure de 2120px au lieu de 5292px) */
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(500);

  const m = await p.evaluate(async () => {
    const r = (n) => Math.round(n * 10) / 10;
    /* vrais pixels du fichier retenu : Image() nue, sans srcset ni sizes */
    const vrai = (img) => new Promise((ok) => {
      const t = new Image();
      t.onload = () => ok([t.naturalWidth, t.naturalHeight]);
      t.onerror = () => ok(null);
      t.src = img.currentSrc || img.src;
    });

    const plaques = [];
    for (const f of document.querySelectorAll('.plaque')) {
      const fb = f.getBoundingClientRect();
      const img = f.querySelector('img');
      if (!img) continue;
      const ib = img.getBoundingClientRect();
      const cs = getComputedStyle(f);
      const dispoW = fb.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const dispoH = fb.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const v = await vrai(img);
      plaques.push({
        plaque: [r(fb.width), r(fb.height)], dispo: [r(dispoW), r(dispoH)],
        img: [r(ib.width), r(ib.height)], fichier: v,
        /* blanc perdu dans la boite disponible */
        occupe: r(100 * (ib.width * ib.height) / (dispoW * dispoH)),
        /* marge laterale ou verticale laissee vide, de chaque cote */
        videX: r((dispoW - ib.width) / 2), videY: r((dispoH - ib.height) / 2),
        densite: v ? r(v[0] / ib.width) : null,
        src: (img.currentSrc || img.src).split('/').pop(),
      });
    }

    const pleines = [];
    for (const f of document.querySelectorAll('.pleine')) {
      const img = f.querySelector('img');
      if (!img) continue;
      const ib = img.getBoundingClientRect();
      const v = await vrai(img);
      let besoinW = ib.width;
      if (v) {
        const rb = ib.width / ib.height, ri = v[0] / v[1];
        besoinW = ri > rb ? ib.width : ib.height * ri;
      }
      /* rogne : part de la hauteur du fichier reellement montree */
      let garde = 100;
      if (v) {
        const rb = ib.width / ib.height, ri = v[0] / v[1];
        garde = ri > rb ? r(100 * rb / ri) : r(100 * ri / rb);
      }
      pleines.push({
        boite: [r(ib.width), r(ib.height)], fichier: v,
        sizes: img.getAttribute('sizes'),
        densite: v ? r(v[0] / besoinW) : null,
        gardePct: garde,
        src: (img.currentSrc || img.src).split('/').pop(),
      });
    }

    const mark = document.querySelector('header .mark');
    let logo = null;
    if (mark) {
      const pieces = [];
      for (const i of mark.querySelectorAll('img')) {
        const bb = i.getBoundingClientRect();
        const v = await vrai(i);
        pieces.push({ css: [r(bb.width), r(bb.height)], fichier: v,
          densite: v ? r(v[0] / bb.width) : null, src: (i.currentSrc || i.src).split('/').pop() });
      }
      logo = { boite: [r(mark.getBoundingClientRect().width), r(mark.getBoundingClientRect().height)], pieces };
    }

    return { plaques, pleines, logo, hauteur: document.body.scrollHeight,
             deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

  bilan.push({ route, nom, ...m });
  console.log(`\n=== ${route}  ${m.hauteur}px  deborde ${m.deborde}`);
  for (const q of m.plaques)
    console.log(`  PLAQUE ${q.plaque.join('x')} dispo ${q.dispo.join('x')} img ${q.img.join('x')} fichier ${q.fichier && q.fichier.join('x')} occupe ${q.occupe}% videX ${q.videX} videY ${q.videY} densite ${q.densite}x`);
  for (const q of m.pleines)
    console.log(`  PLEINE ${q.boite.join('x')} fichier ${q.fichier && q.fichier.join('x')} densite ${q.densite}x garde ${q.gardePct}% sizes="${q.sizes}"`);
  if (m.logo) console.log(`  LOGO ${m.logo.boite.join('x')} ${JSON.stringify(m.logo.pieces)}`);

  /* --- tranches de 844px --- */
  const n = Math.min(Math.ceil(m.hauteur / 844), 15);
  for (let i = 0; i < n; i++) {
    await p.evaluate((y) => scrollTo(0, y), i * 844);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${nom}-${String(i).padStart(2, '0')}.png` });
  }
  await p.evaluate(() => scrollTo(0, 0));
}

writeFileSync('verif/tel-vues.json', JSON.stringify(bilan, null, 1));
await b.close();
console.log('\n--- captures dans verif/tel-vues/');
