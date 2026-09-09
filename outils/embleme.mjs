/* ---------------------------------------------------------------------------
   Decoupe l'embleme du logo pour l'en-tete.

   Le client a envoye son logo en JPEG : le verrou circulaire bleu, et sous lui
   le mot-symbole « TUNGSTEN / Import Export ». L'en-tete porte deja ce
   mot-symbole en typographie ; ce qu'il lui manque, c'est le verrou.

   Deux difficultes, et c'est pour elles que ce script existe plutot qu'un
   recadrage a la main :

   1. Un JPEG n'a pas de transparence. Pose tel quel sur le fond du site
      (#F2F5F9, un blanc bleute), le carre blanc du fichier se verrait comme
      une vignette collee. On applique donc un MASQUE CIRCULAIRE : le disque
      est garde, tout ce qui l'entoure devient transparent. Un simple
      « le blanc devient transparent » ne marcherait pas — la feuille et les
      lettres a l'interieur du disque sont blanches elles aussi, et seraient
      trouees.

   2. Les bornes du disque sont MESUREES, pas devinees : on balaie la moitie
      haute du fichier et on releve le premier et le dernier pixel non blanc.
      Si le client renvoie son logo un jour, le script retrouve les bonnes
      bornes tout seul.
   --------------------------------------------------------------------------- */
import sharp from 'sharp';

const SOURCE = 'src/img/company/logo.jpg';
const CIBLE = 'src/img/company/embleme.png';
const COTE = 256;   // rendu a 40px au plus dans l'en-tete : large marge pour les ecrans a densite triple

const { data, info } = await sharp(SOURCE).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

let x0 = W, x1 = 0, y0 = H, y1 = 0;
for (let y = 0; y < Math.floor(H * 0.55); y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
/* Le disque est carre : on prend le plus grand des deux cotes et on centre,
   sinon le masque rognerait un bord. */
const cote = Math.max(x1 - x0 + 1, y1 - y0 + 1);
const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
const gauche = Math.max(0, cx - Math.round(cote / 2));
const haut = Math.max(0, cy - Math.round(cote / 2));

const masque = Buffer.from(
  `<svg width="${COTE}" height="${COTE}"><circle cx="${COTE / 2}" cy="${COTE / 2}" r="${COTE / 2 - 1}" fill="#fff"/></svg>`
);

await sharp(SOURCE)
  .extract({ left: gauche, top: haut, width: cote, height: cote })
  .resize(COTE, COTE, { fit: 'cover' })
  .composite([{ input: masque, blend: 'dest-in' }])
  .png({ compressionLevel: 9 })
  .toFile(CIBLE);

const { size } = await sharp(CIBLE).metadata().then(async (m) => ({ ...m, size: (await import('node:fs')).statSync(CIBLE).size }));
console.log(`embleme releve a ${gauche},${haut} sur ${cote}x${cote} -> ${CIBLE}  ${COTE}x${COTE}, ${Math.round(size / 1024)} Ko`);
