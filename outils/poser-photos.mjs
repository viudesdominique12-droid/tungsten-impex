/* ---------------------------------------------------------------------------
   Pose les photographies fournies par le client sur les quatorze lignes.

   Le client envoie ses images par WhatsApp : les noms sont des horodatages,
   « WhatsApp Image 2026-09-08 at 17.19.46 (2).jpeg ». La correspondance avec
   les produits a ete etablie a l'oeil, une par une, et elle est ecrite ici
   plutot que refaite de memoire a chaque livraison.

   On ne redimensionne pas et on ne recadre pas : le fichier decide de sa mise
   en page, c'est la regle du site. On retire seulement les metadonnees — une
   photographie de telephone porte la date, parfois le lieu, et cela n'a rien
   a faire sur un site public.

   Usage : node outils/poser-photos.mjs [--sec]
   --------------------------------------------------------------------------- */
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';

const SOURCE = 'photos-originaux';
const CIBLE = 'src/img/products';
const sec = process.argv.includes('--sec');

const LIGNES = {
  'niger-seed-noug':        'WhatsApp Image 2026-09-08 at 17.19.44.jpeg',
  'sesame-seed':            'WhatsApp Image 2026-09-08 at 17.19.45.jpeg',
  'red-kidney-beans':       'WhatsApp Image 2026-09-08 at 17.19.45 (1).jpeg',
  'soya-bean':              'WhatsApp Image 2026-09-08 at 17.19.45 (2).jpeg',
  'electric-vehicles':      'WhatsApp Image 2026-09-08 at 17.19.46.jpeg',
  'medical-equipment':      'WhatsApp Image 2026-09-08 at 17.19.46 (2).jpeg',
  'human-medicine':         'WhatsApp Image 2026-09-08 at 17.19.47.jpeg',
  'building-glass':         'WhatsApp Image 2026-09-08 at 17.19.47 (1).jpeg',
  'elevator-and-escalator': 'WhatsApp Image 2026-09-08 at 17.19.47 (2).jpeg',
  'plastic-raw-materials':  'WhatsApp Image 2026-09-08 at 17.19.48 (1).jpeg',
  'solar-lanterns':         'WhatsApp Image 2026-09-08 at 17.19.48 (2).jpeg',
  'ceramics':               'WhatsApp Image 2026-09-08 at 17.19.49 (1).jpeg',
  'calcium-hypochlorite':   'WhatsApp Image 2026-09-09 at 22.56.30 (1).jpeg',
  'stationery-materials':   'WhatsApp Image 2026-09-09 at 22.56.30.jpeg',
};

/* Le seuil de la bande pleine largeur, repris de ProductSheet.astro. En
   dessous, la photographie garde sa colonne a sa taille reelle : on
   n'agrandit jamais. */
const SEUIL_BANDE = 1024;

const dim = (b) => { let i = 2; while (i < b.length) {
  if (b[i] !== 0xFF) { i++; continue; }
  const m = b[i + 1];
  if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
    return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
  i += 2 + b.readUInt16BE(i + 2);
} return [0, 0]; };

let posees = 0, colonne = [], manquantes = [];
for (const [slug, fichier] of Object.entries(LIGNES)) {
  const src = `${SOURCE}/${fichier}`;
  if (!existsSync(src)) { manquantes.push(`${slug} <- ${fichier}`); continue; }
  const avant = existsSync(`${CIBLE}/${slug}.jpg`) ? dim(readFileSync(`${CIBLE}/${slug}.jpg`)) : [0, 0];
  const apres = dim(readFileSync(src));
  const forme = apres[0] >= SEUIL_BANDE ? 'bande' : 'colonne';
  if (forme === 'colonne') colonne.push(slug);
  console.log(`${slug.padEnd(24)} ${String(avant[0] + 'x' + avant[1]).padStart(10)} -> ` +
              `${String(apres[0] + 'x' + apres[1]).padStart(10)}   ${forme}`);
  if (!sec) {
    // rotate() applique l'orientation EXIF avant de la jeter, sinon une photo
    // prise a la verticale se retrouve couchee une fois les metadonnees parties.
    await sharp(src).rotate().jpeg({ quality: 92, mozjpeg: true }).toFile(`${CIBLE}/${slug}.jpg.tmp`);
    const { renameSync } = await import('node:fs');
    renameSync(`${CIBLE}/${slug}.jpg.tmp`, `${CIBLE}/${slug}.jpg`);
  }
  posees++;
}

console.log(`\n${posees} photographie(s) ${sec ? 'a poser' : 'posees'}`);
if (manquantes.length) console.log(`ABSENTES : ${manquantes.join(', ')}`);
if (colonne.length)
  console.log(`\n${colonne.length} source(s) sous ${SEUIL_BANDE}px : la fiche garde sa colonne,\n` +
              `pas de bande pleine largeur — ${colonne.join(', ')}`);
