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
import { writeFileSync, readFileSync } from 'node:fs';

/* Les interieurs, y compris ceux en reserve : la serie doit etre prete
   entiere le jour ou le client en demande une autre. */
const SERIE = [
  'about.jpg', 'efda-office.jpg', 'founder.jpg', 'office-corridor.jpg',
  'office-floor.jpg', 'pharma-warehouse.jpg', 'quarantine.jpg',
  'records.jpg', 'team-desk.jpg',
];

/* Recadrages declares un par un, avec leur raison. La regle du site reste
   « on ne recadre jamais pour faire entrer une image dans un gabarit » : ce
   sont deux gestes differents. Ici on ne suit aucune maquette, on retire ce
   qui ne sert pas la photographie. Et jamais d'agrandissement : la largeur
   native est conservee. */
const CADRAGE = {
  // Le tiers superieur est un plafond nu. Affichee en pleine largeur, la photo
  // montrait surtout ce vide ; recadree, elle montre les palettes, les cartons
  // et la ligne imprimee « YOUR PARTNER FOR QUALITY MEDICINES ».
  'pharma-warehouse.jpg': { left: 0, top: 202, width: 1080, height: 608 },
  // Meme defaut a la verticale : un mur blanc occupait le tiers haut.
  'team-desk.jpg': { left: 0, top: 300, width: 720, height: 980 },
};

const LO = 4, HI = 250;      // points cibles
const FORCE = 0.7;           // force de l'extension de niveaux
const borne = (v, min, max) => Math.min(max, Math.max(min, v));
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];

/* La source, recadree s'il y a lieu. Tout part de la : la mesure comme la
   correction, sinon on etalonne un histogramme qu'on ne publiera pas. */
const source = (f) => {
  const s = sharp(`originaux/${f}`);
  return CADRAGE[f] ? s.extract(CADRAGE[f]) : s;
};

async function mesurer(entree) {
  const { data } = await sharp(entree).resize(200, null, { fit: 'inside' })
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
for (const f of SERIE) avant[f] = await mesurer(await source(f).toBuffer());

const cibleLum = mediane(SERIE.map((f) => avant[f].lum));
const cibleSat = Math.max(0.24, mediane(SERIE.map((f) => avant[f].sat)));
console.log(`cibles de la serie : luminance ${cibleLum.toFixed(0)}, saturation ${cibleSat.toFixed(2)}\n`);

/* --- 2. corriger ---------------------------------------------------------- */
/* On ne choisit plus la methode sur un seuil. Un seuil est un pari : celui de
   12 marchait jusqu'a ce qu'un recadrage fasse passer team-desk a 12,3 et que
   le correcteur par canal lui fabrique une dominante de 20 qu'elle n'avait
   pas. On applique donc les DEUX corrections, on mesure les deux resultats, et
   on garde celle qui reduit reellement l'ecart de point blanc. Une regle qui
   se verifie elle-meme ne peut pas se tromper de diagnostic. */
const ecartDe = (m) => Math.max(...m.p99) - Math.min(...m.p99);

const niveaux = (m, parCanal) => {
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
  return { a, b };
};

const choix = {};
for (const f of SERIE) {
  const m = avant[f];
  const essais = [];
  for (const parCanal of [false, true]) {
    const { a, b } = niveaux(m, parCanal);
    const lumApres = m.lum * ((a[0] + a[1] + a[2]) / 3) + (b[0] + b[1] + b[2]) / 3;
    const clarte = borne(cibleLum / Math.max(1, lumApres), 0.86, 1.08);
    const saturation = borne(cibleSat / Math.max(0.01, m.sat), 1.0, 1.25);
    const buf = await source(f).linear(a, b).modulate({ brightness: clarte, saturation })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
    essais.push({ parCanal, a, b, clarte, saturation, buf, ecart: ecartDe(await mesurer(buf)) });
  }
  // a egalite on prefere le neutre : il ne touche pas a l'equilibre des canaux
  const garde = essais[1].ecart < essais[0].ecart - 1 ? essais[1] : essais[0];
  writeFileSync(`src/img/company/${f}`, garde.buf);
  choix[f] = garde;

  console.log(`${f.padEnd(24)}${CADRAGE[f] ? ' recadre ' : '         '}` +
              `${garde.parCanal ? 'par canal' : '  neutre '}` +
              `  ecart ${ecartDe(m)} -> ${garde.ecart}` +
              `  (l'autre methode : ${essais[garde.parCanal ? 0 : 1].ecart})` +
              `  clarte ${garde.clarte.toFixed(2)}  saturation ${garde.saturation.toFixed(2)}`);
}

/* --- 3. verifier que la serie a bien converge ---------------------------- */
console.log('\n' + 'fichier'.padEnd(24) + 'ecart de point blanc      luminance        saturation');
let ecartAvantMax = 0, ecartApresMax = 0;
const lumApres = [], lumAvant = [];
for (const f of SERIE) {
  const ap = await mesurer(readFileSync(`src/img/company/${f}`));
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
