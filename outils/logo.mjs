/* ---------------------------------------------------------------------------
   Decoupe le logo du client en deux pieces, pour un en-tete horizontal.

   LE LOGO FOURNI EST EMPILE : le verrou circulaire en haut, sous lui
   « TUNGSTEN », sous lui « Import Export ». C'est une composition verticale,
   faite pour une enseigne ou une carte de visite. Une barre d'en-tete fait
   soixante-huit pixels de haut, et le logo entier n'y tiendrait que sur
   quarante-quatre. Mesure faite sur le fichier : les trois blocs occupent
   48 %, 20 % et 10,6 % de sa hauteur — a 44px, « Import Export » ferait
   4,7 pixels. Illisible, et pas un peu : mecaniquement illisible.

   On ne redessine rien. On decoupe les DEUX pieces de son artwork et on les
   pose cote a cote — c'est le meme logo, dans sa version horizontale. Toutes
   les maisons en ont deux, l'empilee et la couchee ; celle-ci manquait.

   Deux transparences, et deux methodes, parce que les deux pieces n'ont pas le
   meme probleme :

     le verrou    un disque bleu qui contient du BLANC — la feuille, l'etoile,
                  les lettres. « Le blanc devient transparent » le trouerait.
                  On applique donc un masque circulaire : on garde le disque,
                  on jette ce qui l'entoure.

     le mot       de l'encre bleue sur du blanc, et rien de blanc a
                  l'interieur. La luminance devient donc l'alpha : le blanc
                  disparait, le bleu reste, et les bords restent lisses au
                  lieu d'etre decoupes au couteau.

   Les bornes sont MESUREES a chaque execution, jamais ecrites en dur : si le
   client renvoie son logo un jour, le script retrouve ses reperes tout seul.

   Usage : node outils/logo.mjs
   --------------------------------------------------------------------------- */
import sharp from 'sharp';
import { statSync } from 'node:fs';

const SOURCE = 'src/img/company/logo.jpg';
const VERROU = 'src/img/company/embleme.png';
const MOT = 'src/img/company/mot-symbole.png';

const { data, info } = await sharp(SOURCE).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const blanc = (x, y) => { const i = (y * W + x) * C;
  return data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235; };

/* ---- 1. les blocs d'encre, de haut en bas ------------------------------- */
const encre = [];
for (let y = 0; y < H; y++) { let n = 0;
  for (let x = 0; x < W; x++) if (!blanc(x, y)) n++;
  encre.push(n); }
const blocs = []; let debut = null;
for (let y = 0; y < H; y++) {
  if (encre[y] > 0 && debut === null) debut = y;
  if (encre[y] === 0 && debut !== null) { blocs.push([debut, y - 1]); debut = null; }
}
if (debut !== null) blocs.push([debut, H - 1]);
if (blocs.length < 2) throw new Error(`logo illisible : ${blocs.length} bloc(s) trouve(s)`);

const bornesX = (y0, y1) => { let a = W, b = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++)
    if (!blanc(x, y)) { if (x < a) a = x; if (x > b) b = x; }
  return [a, b]; };

/* ---- 2. le verrou : masque circulaire ----------------------------------- */
{
  const [y0, y1] = blocs[0];
  const [x0, x1] = bornesX(y0, y1);
  const cote = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  const gauche = Math.max(0, Math.round((x0 + x1) / 2 - cote / 2));
  const haut = Math.max(0, Math.round((y0 + y1) / 2 - cote / 2));
  const T = 256;   // rendu a 44px au plus : large marge pour une densite triple
  const masque = Buffer.from(
    `<svg width="${T}" height="${T}"><circle cx="${T / 2}" cy="${T / 2}" r="${T / 2 - 1}" fill="#fff"/></svg>`);
  await sharp(SOURCE)
    .extract({ left: gauche, top: haut, width: cote, height: cote })
    .resize(T, T, { fit: 'cover' })
    .composite([{ input: masque, blend: 'dest-in' }])
    .png({ compressionLevel: 9 }).toFile(VERROU);
  console.log(`verrou      ${gauche},${haut} ${cote}x${cote} -> ${VERROU} ${T}x${T}, ${Math.round(statSync(VERROU).size / 1024)} Ko`);
}

/* ---- 3. le mot-symbole : la luminance devient l'alpha -------------------- */
{
  const y0 = blocs[1][0], y1 = blocs[blocs.length - 1][1];
  const [x0, x1] = bornesX(y0, y1);
  const marge = 2;
  const l = Math.max(0, x0 - marge), t = Math.max(0, y0 - marge);
  const w = Math.min(W - l, x1 - x0 + 1 + marge * 2), h = Math.min(H - t, y1 - y0 + 1 + marge * 2);

  const { data: px, info: i2 } = await sharp(SOURCE)
    .extract({ left: l, top: t, width: w, height: h })
    .raw().toBuffer({ resolveWithObject: true });

  /* Le bleu de la maison, releve sur l'artwork lui-meme : le pixel le plus
     sature du bloc. On ne le devine pas et on ne le prend pas dans la charte —
     c'est SON bleu qui doit sortir, pas celui du site. */
  let bleu = [0, 0, 0], score = -1;
  for (let k = 0; k < px.length; k += i2.channels) {
    const [r, g, b] = [px[k], px[k + 1], px[k + 2]];
    const s = b - (r + g) / 2 - (r + g + b) / 3 * 0.15;
    if (s > score) { score = s; bleu = [r, g, b]; }
  }

  /* L'alpha est NORMALISE sur la luminance de l'encre, pas sur le noir.
     Ecrit simplement — alpha = 1 - luminance — un bleu dont la luminance vaut
     0,195 ne monte jamais qu'a 80 % d'opacite : les lettres sortaient delavees,
     un violet pale la ou l'artwork porte un bleu franc. On ramene donc la
     pleine opacite sur l'encre elle-meme, et le degrade des bords suit. */
  const lumEncre = (bleu[0] * 0.2126 + bleu[1] * 0.7152 + bleu[2] * 0.0722) / 255;
  const sortie = Buffer.alloc(w * h * 4);
  for (let k = 0, j = 0; k < px.length; k += i2.channels, j += 4) {
    const lum = (px[k] * 0.2126 + px[k + 1] * 0.7152 + px[k + 2] * 0.0722) / 255;
    const a = (1 - lum) / (1 - lumEncre);
    sortie[j] = bleu[0]; sortie[j + 1] = bleu[1]; sortie[j + 2] = bleu[2];
    sortie[j + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255);
  }
  await sharp(sortie, { raw: { width: w, height: h, channels: 4 } })
    .resize({ height: 220, fit: 'inside' })
    .png({ compressionLevel: 9 }).toFile(MOT);
  const m = await sharp(MOT).metadata();
  console.log(`mot-symbole ${l},${t} ${w}x${h} -> ${MOT} ${m.width}x${m.height}, ` +
              `${Math.round(statSync(MOT).size / 1024)} Ko, bleu rgb(${bleu.join(',')})`);
}
