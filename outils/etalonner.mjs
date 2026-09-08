/* ---------------------------------------------------------------------------
   Etalonnage des interieurs.

   Reproductible : les originaux sont conserves dans originaux/ et ce script
   part toujours d'eux, jamais du resultat precedent. On peut donc changer la
   force et relancer sans degrader.

   CE QU'ON ETALONNE, ET CE QU'ON NE TOUCHE PAS.

   Les photos de bureau ont ete prises par la meme personne dans le meme
   batiment : elles doivent se lire comme une seule serie, et elles ne le font
   pas. Mesure : point blanc entre 233 et 248 au lieu de 255 — elles
   n'atteignent jamais le blanc — luminance de 154 a 207, saturation de 0,15
   a 0,24. Elles ne sont pas mal balancees, elles sont plates et delavees.
   Seule pharma-warehouse porte une vraie dominante chaude (248/231/225).

   Les photos produit ne sont PAS etalonnees. Celles qui affichent le plus
   grand ecart de point blanc sont precisement celles dont la couleur est le
   sujet : red-kidney-beans mesure 86 d'ecart parce que ce sont des haricots
   rouges, sesame-seed et soya-bean parce que ce sont des graines beiges.
   Neutraliser cet ecart reviendrait a effacer la marchandise.

   LA CORRECTION. Une extension de niveaux par canal, appliquee a force
   partielle : elle ramene le point noir a 4 et le point blanc a 250, ce qui
   rend le contraste ET corrige la dominante d'un seul geste, puisqu'un canal
   trop court est aussi un canal trop teinte. Puis un reglage de luminosite et
   de saturation vers la mediane de la serie, pour qu'elles convergent au lieu
   de se rapprocher chacune d'un ideal abstrait. Tous les facteurs sont bornes :
   une correction qui depasse ses bornes est une correction qui se trompe de
   diagnostic.
   --------------------------------------------------------------------------- */

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

/* Les interieurs, y compris ceux en reserve : la serie doit etre prete
   entiere le jour ou le client en demande une autre. */
const SERIE = [
  'about.jpg', 'efda-office.jpg', 'founder.jpg', 'office-corridor.jpg',
  'office-floor.jpg', 'pharma-warehouse.jpg', 'quarantine.jpg',
  'records.jpg', 'team-desk.jpg',
];

const LO = 4, HI = 250;      // points cibles
const FORCE = 0.7;           // force de l'extension de niveaux
const borne = (v, min, max) => Math.min(max, Math.max(min, v));
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];

async function mesurer(chemin) {
  const { data } = await sharp(chemin).resize(200, null, { fit: 'inside' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = [[], [], []];
  let lum = 0, sat = 0, n = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    ch[0].push(r); ch[1].push(g); ch[2].push(b);
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat += mx === 0 ? 0 : (mx - mn) / mx;
    n++;
  }
  ch.forEach((c) => c.sort((x, y) => x - y));
  return {
    p1: ch.map((c) => pct(c, 0.01)),
    p99: ch.map((c) => pct(c, 0.99)),
    lum: lum / n,
    sat: sat / n,
  };
}

const mediane = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

/* --- 1. mesurer la serie entiere pour en tirer ses propres cibles -------- */
const avant = {};
for (const f of SERIE) avant[f] = await mesurer(`originaux/${f}`);

const cibleLum = mediane(SERIE.map((f) => avant[f].lum));
const cibleSat = Math.max(0.24, mediane(SERIE.map((f) => avant[f].sat)));
console.log(`cibles de la serie : luminance ${cibleLum.toFixed(0)}, saturation ${cibleSat.toFixed(2)}\n`);

/* --- 2. corriger ---------------------------------------------------------- */
for (const f of SERIE) {
  const m = avant[f];

  /* On ne corrige une dominante que la ou on en mesure une. L'extension par
     canal est un correcteur de dominante ; appliquee a une image deja neutre
     elle en FABRIQUE une, parce qu'elle prend pour un dereglage ce qui est le
     sujet. Constate : team-desk, dont le point noir est 39/74/39 — des murs et
     un bureau creme, pas une dominante — passait d'un ecart de 7 a 22.
     Au-dessous du seuil, l'extension est neutre : meme gain sur les trois
     canaux, calcule sur la moyenne. Elle ne rend alors que du contraste. */
  const ecart = Math.max(...m.p99) - Math.min(...m.p99);
  const parCanal = ecart >= 12;
  const a = [], b = [];
  const moyP1 = (m.p1[0] + m.p1[1] + m.p1[2]) / 3;
  const moyP99 = (m.p99[0] + m.p99[1] + m.p99[2]) / 3;
  for (let c = 0; c < 3; c++) {
    const lo = parCanal ? m.p1[c] : moyP1;
    const hi = parCanal ? m.p99[c] : moyP99;
    const s = (HI - LO) / Math.max(1, hi - lo);
    a.push(borne(1 + FORCE * (s - 1), 0.9, 1.4));
    b.push(borne(FORCE * (LO - lo * s), -40, 40));
  }

  // luminance apres extension, estimee sur le canal vert qui pese le plus
  const lumApres = m.lum * ((a[0] + a[1] + a[2]) / 3) + (b[0] + b[1] + b[2]) / 3;
  const clarte = borne(cibleLum / Math.max(1, lumApres), 0.86, 1.08);
  const saturation = borne(cibleSat / Math.max(0.01, m.sat), 1.0, 1.25);

  const sortie = await sharp(`originaux/${f}`)
    .linear(a, b)
    .modulate({ brightness: clarte, saturation })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();
  writeFileSync(`src/img/company/${f}`, sortie);

  console.log(`${f.padEnd(24)} ${parCanal ? 'par canal' : '  neutre '} gains ${a.map((v) => v.toFixed(2)).join('/')}` +
              `  offsets ${b.map((v) => Math.round(v)).join('/')}` +
              `  clarte ${clarte.toFixed(2)}  saturation ${saturation.toFixed(2)}`);
}

/* --- 3. verifier que la serie a bien converge ---------------------------- */
console.log('\n' + 'fichier'.padEnd(24) + 'ecart de point blanc      luminance        saturation');
let ecartAvantMax = 0, ecartApresMax = 0;
const lumApres = [], lumAvant = [];
for (const f of SERIE) {
  const ap = await mesurer(`src/img/company/${f}`);
  const eA = Math.max(...avant[f].p99) - Math.min(...avant[f].p99);
  const eB = Math.max(...ap.p99) - Math.min(...ap.p99);
  ecartAvantMax = Math.max(ecartAvantMax, eA);
  ecartApresMax = Math.max(ecartApresMax, eB);
  lumAvant.push(avant[f].lum); lumApres.push(ap.lum);
  console.log(`${f.padEnd(24)}${String(eA).padStart(6)} -> ${String(eB).padStart(3)}` +
              `        ${String(Math.round(avant[f].lum)).padStart(5)} -> ${String(Math.round(ap.lum)).padStart(3)}` +
              `      ${avant[f].sat.toFixed(2)} -> ${ap.sat.toFixed(2)}`);
}
const etendue = (a) => Math.round(Math.max(...a) - Math.min(...a));
console.log(`\necart de point blanc, pire cas : ${ecartAvantMax} -> ${ecartApresMax}`);
console.log(`dispersion de luminance sur la serie : ${etendue(lumAvant)} -> ${etendue(lumApres)}`);
