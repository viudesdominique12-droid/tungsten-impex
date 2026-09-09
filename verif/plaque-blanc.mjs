/* ANGLE « LA PLAQUE » — le detourage sur blanc se fond-il dans var(--surface) ?
   On echantillonne les bords de l'image REELLEMENT servie et on compare au
   fond de la plaque. Un ecart de plus de ~2 niveaux sur 255 dessine un
   rectangle perceptible sur une surface de plusieurs centaines de pixels.
   Fichier temporaire d'audit. A supprimer apres lecture. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
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

const sonde = async () => {
  const img = document.querySelector('.plaque img');
  const fond = getComputedStyle(document.querySelector('.plaque')).backgroundColor
    .match(/\d+/g).map(Number);
  const solo = new Image();
  solo.src = img.currentSrc;
  await solo.decode();
  const W = solo.naturalWidth, H = solo.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  cx.drawImage(solo, 0, 0);
  const px = (x, y) => {
    const d = cx.getImageData(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)), 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  // couronne : 12 points sur le pourtour, a 2px du bord
  const pts = [];
  for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    pts.push(px(Math.round(W * t), 2));        // haut
    pts.push(px(Math.round(W * t), H - 3));    // bas
  }
  for (const t of [0.25, 0.5, 0.75]) {
    pts.push(px(2, Math.round(H * t)));        // gauche
    pts.push(px(W - 3, Math.round(H * t)));    // droite
  }
  const coins = [px(2, 2), px(W - 3, 2), px(2, H - 3), px(W - 3, H - 3)];
  const ecart = (p) => Math.max(...p.map((v, i) => Math.abs(v - fond[i])));
  const blancs = pts.filter((p) => p[0] > 235 && p[1] > 235 && p[2] > 235);
  return {
    fond,
    coins,
    ecartCoinsMax: Math.max(...coins.map(ecart)),
    coinsBlancs: coins.filter((p) => p[0] > 235).length,
    // parmi les points de pourtour clairs, l'ecart au fond de la plaque
    pourtourClairs: blancs.length,
    pourtourTotal: pts.length,
    ecartPourtourClairsMax: blancs.length ? Math.max(...blancs.map(ecart)) : null,
    exemplesClairs: blancs.slice(0, 4),
  };
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
console.log('slug'.padEnd(24), 'coins'.padEnd(6), 'ecartCoins'.padEnd(11),
            'brdClairs'.padEnd(10), 'ecartBrd'.padEnd(9), 'exemple coin haut-gauche');
for (const [route, slug] of FICHES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  const r = await page.evaluate(sonde);
  console.log(
    slug.padEnd(24),
    `${r.coinsBlancs}/4`.padEnd(6),
    String(r.ecartCoinsMax).padEnd(11),
    `${r.pourtourClairs}/${r.pourtourTotal}`.padEnd(10),
    String(r.ecartPourtourClairsMax).padEnd(9),
    'rgb(' + r.coins[0].join(',') + ')'
  );
}
console.log('\nfond de plaque mesure : rgb(' + (await page.evaluate(() => getComputedStyle(document.querySelector('.plaque')).backgroundColor)) + ')');
await nav.close();
