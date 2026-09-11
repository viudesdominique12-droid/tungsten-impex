/* ---------------------------------------------------------------------------
   Pose les photographies fournies par le client sur les quatorze lignes.

   Le client envoie ses images par WhatsApp : les noms sont des horodatages,
   « WhatsApp Image 2026-09-08 at 17.19.46 (2).jpeg ». La correspondance avec
   les produits a ete etablie a l'oeil, une par une, et elle est ecrite ici
   plutot que refaite de memoire a chaque livraison.

   On ne redimensionne pas : le fichier decide de sa mise en page, c'est la
   regle du site. On retire les metadonnees — une photographie de telephone
   porte la date, parfois le lieu, et cela n'a rien a faire sur un site public.

   DEUX CHOSES EN PLUS, ET ELLES SONT DECRITES PLUS BAS :

   LE RECADRAGE DE DEUX FILIGRANES. Deux fichiers portaient la marque d'une
   autre entreprise. Dans les deux cas elle etait pres d'un bord, sur une zone
   sans sujet, et une coupe l'emporte sans rien perdre — elle ameliore meme le
   cadrage. Voir RECADRE.

   L'AFFUTAGE. Dix des quatorze fichiers sont plus petits que la taille a
   laquelle la page les montre : le navigateur les etire, et ce qui etait mou
   le devient davantage. On ne peut pas inventer les pixels manquants, mais on
   peut rendre les transitions plus franches avant qu'il les etire. Voir SIGMA.

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

/* ---- LES DEUX FILIGRANES A COUPER ---------------------------------------
   Bornes relevees a l'oeil sur les fichiers agrandis, puis verifiees en
   regardant le resultat. Elles ne sont pas devinees : le filigrane est absent
   de la coupe, et le sujet y est entier.

   red-kidney-beans  le cachet « HANDMADE IN KILMORA — THE HIMALAYAS » occupe
                     le rebord du bol, en haut a gauche, jusqu'a x=110 y=105.
                     On ne coupe QUE le haut : le cachet ne descend pas plus
                     bas, et couper aussi en largeur ramenait le fichier de 447
                     a 329px — l'image se serait alors affichee plus petite que
                     les treize autres, et la plaque serait redevenue le
                     timbre-poste qu'on venait de corriger. La largeur se garde,
                     et le cadrage y gagne : le tiers de rebord vide part avec
                     le cachet.

   ceramics          le logo « MY7YLES » est sur le mur, en haut a droite,
                     entre y=55 et y=67. Couper le haut l'emporte ET retire un
                     plafond qui ne portait rien. La largeur est preservee. */
const RECADRE = {
  'red-kidney-beans': { left: 0, top: 110, width: 447, height: 337, pourquoi: 'filigrane KILMORA retire' },
  'ceramics':         { left: 0, top: 72,  width: 516, height: 315, pourquoi: 'filigrane MY7YLES retire' },
  'building-glass':   { left: 0, top: 30,  width: 452, height: 452, pourquoi: 'carre, pour remplir la plaque' },
};

/* ---- ET LE TROISIEME RECADRAGE N'EST PAS UN FILIGRANE -------------------
   « The dimensions on building glass is a bit off. Zoom it in and expand to
   fill frame I think. The other dimensions are good. » — le client, 11
   septembre 2026. Il a vu juste, et il a vu la seule des quatorze qui cloche.

   La source fait 452x678 : un rapport de 0,667, la seule verticale franche du
   lot. La plaque borne sa proportion entre 1 et 1,5, donc elle se presentait
   carree et la photographie s'y posait en 215x322 — 56 % de remplissage,
   contre 71 a 85 % pour les treize autres. Sur telephone cela donnait une
   bande verticale de 215px avec 135px de blanc a cote, dans un cadre blanc
   pose sur un sol presque blanc. Le timbre-poste, revenu par la porte des
   sources verticales.

   POURQUOI COUPER PLUTOT QUE CHANGER LA BORNE. C'etait la premiere piste :
   laisser la plaque suivre les proportions verticales. Elle ne tient pas. La
   plaque fait 620px de large sur ordinateur, et c'est cette largeur qui donne
   au catalogue sa ressemblance ; un rapport de 0,667 y donnerait une plaque de
   930px de haut, plus haute que la zone de lecture de la plupart des ecrans —
   l'ecueil que le commentaire de ProductSheet.astro signalait deja. Borner la
   hauteur ramenerait le letterboxing. Pour cette source-la, « remplir le
   cadre » ne s'obtient qu'en coupant.

   LE CHOIX DE LA FENETRE. Quatre carres de 452 ont ete rendus et regardes
   (haut, 30, centre, bas). A 30 : la ligne de toit reste, la courbe de la
   facade balaie tout le cadre, le ciel tient le coin haut droit, et ce qui
   part est le verre sombre du rez-de-chaussee plus une bande de ciel vide en
   haut. Au centre, la ligne de toit est coupee et le bas s'assombrit ; ce
   n'etait plus un batiment, c'etait un mur.

   La largeur ne bouge pas — 452px avant, 452px apres — donc la fiche continue
   de s'afficher a la meme taille que les treize autres. Remplissage : 56 % ->
   100 %. */

/* ---- L'AFFUTAGE, PROPORTIONNE AU SUR-ECHANTILLONNAGE ---------------------
   La plaque montre l'image sur 568px au plus ; un ecran a densite double en
   demande donc 1136. Un fichier de 450px sera etire deux fois et demie, un
   fichier de 1600px pas du tout. L'affutage suit cet ecart : fort la ou le
   navigateur va etirer, discret la ou il n'a rien a etirer.

   Les valeurs sont calibrees en regardant, pas en lisant un chiffre. A 1,2 les
   bords commencent a se cerner d'un halo sur les contrastes francs ; a 0,6 le
   gain est net et l'artefact absent. La variance du laplacien passe de 412 a
   1042 sur la fiche des medicaments : ce n'est pas du detail invente, ce sont
   les transitions existantes rendues franches avant l'etirement. */
const SIGMA = (largeur) => (largeur < 700 ? 0.8 : largeur < 1024 ? 0.6 : 0.4);

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
  const r = RECADRE[slug];
  const finales = r ? [r.width, r.height] : apres;
  const forme = finales[0] >= SEUIL_BANDE ? 'bande' : 'colonne';
  if (forme === 'colonne') colonne.push(slug);
  console.log(`${slug.padEnd(24)} ${String(avant[0] + 'x' + avant[1]).padStart(10)} -> ` +
              `${String(finales[0] + 'x' + finales[1]).padStart(10)}` +
              `   affute ${SIGMA(finales[0]).toFixed(1)}` +
              `${r ? '   RECADRE : ' + r.pourquoi : ''}`);
  if (!sec) {
    // rotate() applique l'orientation EXIF avant de la jeter, sinon une photo
    // prise a la verticale se retrouve couchee une fois les metadonnees parties.
    let p = sharp(src).rotate();
    if (r) { const { left, top, width, height } = r; p = p.extract({ left, top, width, height }); }
    // L'affutage vient APRES le recadrage : la largeur qui compte est celle
    // qui sera servie, pas celle du fichier d'origine.
    const large = RECADRE[slug] ? RECADRE[slug].width : apres[0];
    p = p.sharpen({ sigma: SIGMA(large) });
    await p.jpeg({ quality: 94, mozjpeg: true }).toFile(`${CIBLE}/${slug}.jpg.tmp`);
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
