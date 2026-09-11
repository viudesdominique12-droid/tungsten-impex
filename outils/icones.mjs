/* ---------------------------------------------------------------------------
   Les icones du site, et la vignette de partage.

   Deux manques que l'audit a releves et qui se voient tous les deux hors du
   site — donc nulle part dans les captures qu'on prend :

   L'ONGLET ETAIT VIDE. Aucun favicon : /favicon.ico repondait 404, et l'onglet
   du navigateur affichait le carre gris par defaut. Sur un telephone, « ajouter
   a l'ecran d'accueil » posait une vignette blanche sans marque.

   LE LIEN PARTAGE NE MONTRAIT RIEN. C'est par WhatsApp que ce client envoie son
   site — ses propres messages en temoignent. Sans balise og:image, WhatsApp,
   Telegram, LinkedIn et X n'affichent qu'une ligne de texte grise : pas de
   vignette, pas de marque, rien qui donne envie d'ouvrir. La vignette est donc
   fabriquee ici, aux dimensions que ces services attendent (1200x630), avec le
   fond nuit du site, le verrou et le mot-symbole.

   Tout est derive de l'artwork du client — embleme.png et mot-symbole.png,
   eux-memes decoupes par outils/logo.mjs. Rien n'est redessine.

   Usage : node outils/icones.mjs
   --------------------------------------------------------------------------- */
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';

const SORTIE = 'public';
mkdirSync(SORTIE, { recursive: true });

const NUIT = '#0A1B3C';
const dire = (f) => console.log(`  ${f.padEnd(34)} ${String(Math.round(statSync(f).size / 1024)).padStart(4)} Ko`);

/* ---- 1. les favicons ---------------------------------------------------
   Le verrou seul : a 32 pixels de cote, un mot-symbole est une tache. */
console.log('favicons :');
for (const t of [32, 180, 192, 512]) {
  /* Fond nuit plutot que transparent : le verrou est bleu fonce, et pose
     transparent sur la barre d'onglets sombre d'un navigateur en theme nuit il
     disparaitrait. Le disque garde son propre bord. */
  const nom = t === 180 ? `${SORTIE}/apple-touch-icon.png` : `${SORTIE}/icone-${t}.png`;
  const marge = Math.round(t * 0.08);
  await sharp({ create: { width: t, height: t, channels: 4, background: NUIT } })
    .composite([{
      input: await sharp('src/img/company/embleme.png')
        .resize(t - marge * 2, t - marge * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer(),
      top: marge, left: marge,
    }])
    .png({ compressionLevel: 9 }).toFile(nom);
  dire(nom);
}

/* Le .ico, pour les navigateurs et les lecteurs de flux qui ne lisent que lui.
   Un ICO est un conteneur : on y met le PNG de 32px tel quel, ce qui est une
   forme valide depuis Vista et qu'aucun navigateur actuel ne refuse. */
{
  const png = await sharp(`${SORTIE}/icone-32.png`).png().toBuffer();
  const en = Buffer.alloc(22);
  en.writeUInt16LE(0, 0); en.writeUInt16LE(1, 2); en.writeUInt16LE(1, 4);
  en[6] = 32; en[7] = 32; en[8] = 0; en[9] = 0;
  en.writeUInt16LE(1, 10); en.writeUInt16LE(32, 12);
  en.writeUInt32LE(png.length, 14); en.writeUInt32LE(22, 18);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${SORTIE}/favicon.ico`, Buffer.concat([en, png]));
  dire(`${SORTIE}/favicon.ico`);
}

/* ---- 2. la vignette de partage, 1200x630 -------------------------------- */
const L = 1200, H = 630;
const verrou = await sharp('src/img/company/embleme.png').resize(200, 200).toBuffer();
const mot = await sharp('src/img/company/mot-symbole.png').resize({ height: 104 }).toBuffer();
const motInfo = await sharp(mot).metadata();

/* Le mot-symbole de l'artwork est bleu fonce : sur le fond nuit il ne se
   detacherait pas. On le recolore en clair en gardant son canal alpha —
   la forme des lettres est conservee, seule l'encre change. */
const motClair = await sharp(mot)
  .composite([{
    input: { create: { width: motInfo.width, height: motInfo.height, channels: 4, background: '#EAF1FA' } },
    blend: 'in',
  }]).toBuffer();

const texte = Buffer.from(`<svg width="${L}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="88" y="470" font-family="Georgia, serif" font-size="58" fill="#EAF1FA">Ethiopian oilseeds and pulses, out.</text>
  <text x="88" y="540" font-family="Georgia, serif" font-size="58" fill="#EAF1FA">Medicines, vehicles and materials, in.</text>
  <text x="88" y="592" font-family="monospace" font-size="24" fill="#93A7C7" letter-spacing="3">ADDIS ABABA, ETHIOPIA</text>
</svg>`);

await sharp({ create: { width: L, height: H, channels: 4, background: NUIT } })
  .composite([
    { input: verrou, top: 84, left: 88 },
    { input: motClair, top: 132, left: 88 + 200 + 34 },
    { input: texte, top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 }).toFile(`${SORTIE}/partage.png`);
console.log('vignette de partage :');
dire(`${SORTIE}/partage.png`);
const m = await sharp(`${SORTIE}/partage.png`).metadata();
console.log(`  ${m.width}x${m.height} — le format attendu par WhatsApp, Telegram, LinkedIn et X`);
