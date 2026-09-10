/* ---------------------------------------------------------------------------
   Le QR code du site, et sa relecture.

   Il n'encode PAS l'adresse du site. Il encode l'adresse-relais — voir
   src/pages/aller.astro — parce qu'un QR imprime ne se corrige pas : ce qui est
   sur le papier y reste. Le relais, lui, se modifie en une ligne.

   Trois choses que ce script fait et qu'un generateur en ligne ne fait pas :

   IL RELIT SON PROPRE RESULTAT. Le QR est genere, rendu en pixels, puis DECODE,
   et le texte decode est compare a l'adresse de depart. Un QR qui s'affiche
   n'est pas un QR qui se lit ; c'est exactement le genre de chose qu'on
   decouvre quand la brochure est deja chez l'imprimeur.

   IL LE RELIT ABIME. On le decode aussi a quatre tailles reduites, jusqu'a
   celle d'un timbre, pour savoir a partir de quelle dimension il cesse d'etre
   lisible. Le chiffre imprime dans la sortie est la taille minimale a respecter
   sur le papier.

   IL CORRIGE A 30 %. Le niveau H tolere qu'un tiers du motif soit efface :
   une tache, un pli, un reflet, un doigt. Sur une carte de visite qui vit dans
   une poche, ce n'est pas du luxe.

   Deux fichiers en sortent : un SVG, qui ne pixelise a aucune taille
   d'impression, et un PNG pour ce qui n'accepte que du bitmap.

   Usage : node outils/qr.mjs
   --------------------------------------------------------------------------- */
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';

const site = JSON.parse(readFileSync('src/data/site.json', 'utf8'));
const ADRESSE = site.web.relais;
/* Dans public/ et non dans verif/ : le fichier est ainsi publie avec le site.
   Le client peut le telecharger depuis son propre site le jour ou son
   imprimeur le lui redemande, sans avoir a nous ecrire. */
const SORTIE = 'public/qr';
mkdirSync(SORTIE, { recursive: true });

const OPTIONS = {
  errorCorrectionLevel: 'H',
  margin: 2,          // la « zone de silence » : sous 2 modules, les lecteurs peinent
  color: { dark: '#0A1B3C', light: '#FFFFFF' },
};

console.log(`adresse encodee : ${ADRESSE}\n`);

/* ---- 1. le SVG, pour l'impression --------------------------------------- */
const svg = await QRCode.toString(ADRESSE, { ...OPTIONS, type: 'svg', width: 1024 });
writeFileSync(`${SORTIE}/tungsten-qr.svg`, svg);

/* ---- 2. le PNG, pour tout le reste -------------------------------------- */
await QRCode.toFile(`${SORTIE}/tungsten-qr.png`, ADRESSE, { ...OPTIONS, width: 1024 });

/* ---- 3. LA RELECTURE ----------------------------------------------------
   On ne se contente pas de generer : on decode, et on compare. */
const relire = async (chemin, taille) => {
  const { data, info } = await sharp(chemin)
    .resize(taille, taille, { kernel: 'nearest' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lu = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return lu ? lu.data : null;
};

const lu = await relire(`${SORTIE}/tungsten-qr.png`, 1024);
if (lu !== ADRESSE) {
  console.error(`ARRET : le QR ne se relit pas.\n  encode : ${ADRESSE}\n  decode : ${lu}`);
  process.exit(1);
}
console.log('relu a 1024px  : identique a l adresse encodee');

/* ---- 4. jusqu'ou il reste lisible --------------------------------------- */
let plusPetit = null;
for (const t of [512, 256, 192, 128, 96, 64]) {
  const r = await relire(`${SORTIE}/tungsten-qr.png`, t);
  const ok = r === ADRESSE;
  console.log(`relu a ${String(t).padStart(4)}px  : ${ok ? 'identique' : 'ILLISIBLE'}`);
  if (ok) plusPetit = t; else break;
}

/* Un lecteur de telephone a besoin d'environ deux pixels de camera par module
   du motif. La regle d'impression qui en decoule est simple : la plus petite
   taille lisible ici, ramenee en millimetres a 300 points par pouce, puis
   doublee pour la marge de securite d'une camera reelle, d'un papier mat et
   d'un eclairage quelconque. */
const mm = plusPetit ? (plusPetit / 300 * 25.4 * 2) : null;

const meta = await sharp(`${SORTIE}/tungsten-qr.png`).metadata();
console.log(`\nSVG : ${SORTIE}/tungsten-qr.svg  (${Math.round(statSync(`${SORTIE}/tungsten-qr.svg`).size / 1024)} Ko, sans pixels)`);
console.log(`PNG : ${SORTIE}/tungsten-qr.png  (${meta.width}x${meta.height}, ${Math.round(statSync(`${SORTIE}/tungsten-qr.png`).size / 1024)} Ko)`);
console.log(`correction d erreur : niveau H — un tiers du motif peut etre efface`);
if (mm) console.log(`taille minimale a l impression : ${mm.toFixed(0)} mm de cote`);
console.log(`\nrenvoie vers : ${site.web.canonique}`);
console.log('pour changer de destination, une seule ligne : web.canonique dans src/data/site.json');
