/* ---------------------------------------------------------------------------
   Le choix du cadre.

   La bibliotheque du client va de 400x331 a 1600x581. La charte demandait
   « un seul format d'image » et cela avait ete applique en forcant tout le
   monde dans une bande de 1440x480 : une vignette de 400px etalee sur 1440
   (x3,6), une photo de telephone en portrait rognee a 19 % de sa hauteur.
   On ne fait pas entrer une vignette dans une bande — on donne au fichier le
   cadre qu'il peut porter.

   Regle unique et non negociable : aucune image n'est jamais affichee au-dela
   de sa largeur native. Le pipeline d'Astro la garantit au build (il ne
   fabrique jamais de variante plus large que la source) et la feuille de style
   la garantit au rendu (max-width en pixels reels).
   --------------------------------------------------------------------------- */

const fichiers = import.meta.glob('/src/img/**/*.jpg', { eager: true });

const parCle = {};
for (const [chemin, mod] of Object.entries(fichiers)) {
  parCle[chemin.replace('/src/', '')] = mod.default; // "img/products/x.jpg"
}

export const photo = (cle) => parCle[String(cle).replace(/^\//, '')] ?? null;

/* Deux cadres, et aucun des deux ne rogne.

   portrait — la photo est plus haute que large. Bornee plus court, sinon elle
              occuperait deux ecrans de hauteur.
   plaque   — tout le reste.

   Le format reste celui du fichier : une source panoramique donne une bande,
   une source 4:3 donne un bloc, une vignette donne une petite image nette.
   C'est le fichier qui decide de sa taille, pas la maquette. */
export function cadre(m) {
  if (!m) return null;
  return m.width / m.height < 1.0 ? 'portrait' : 'plate';
}

/* Les largeurs demandees au pipeline, bornees a la source. Astro ne fabrique
   jamais plus large que l'original ; on evite juste de lui demander l'inutile. */
export function largeurs(m, max) {
  const plafond = Math.min(m.width, max);
  return [...new Set([480, 720, 960, 1280, 1600, 1920]
    .filter((w) => w < plafond)
    .concat(plafond))];
}
