/* Le registre : les quatorze lignes, et le fait porte par chacune.

   Le fait est designe nommement dans copy.json (cle « mark »). L'heuristique
   precedente — le plus court qui contient un chiffre — remontait le numero de
   standard pour trois lignes et repetait « More than 20 years » a l'identique
   sur deux autres. Le choix est editorial, pas automatique. */
import site from '../data/site.json';
import copy from '../data/copy.json';

const fait = (slug) => {
  const e = copy[slug];
  return e?.facts?.find((f) => f.label === e.mark) ?? null;
};
const ligne = (p, folder) => ({ ...p, folder, lead: copy[p.slug]?.lead ?? '', fact: fait(p.slug) });

export const sortants = site.exports.map((p) => ligne(p, 'export'));
export const entrants = site.imports.map((p) => ligne(p, 'import'));

/* Le manifeste du tableau de departs : les sortantes reparties parmi les
   entrantes, pour que la bascule alterne les deux fonds au lieu d'enchainer
   dix bleus. */
const carte = (p) => ({
  name: p.name,
  href: `/${p.folder}/${p.slug}/`,
  flow: p.folder === 'export' ? 'out' : 'in',
  dir: p.folder === 'export' ? 'Export' : 'Import',
  factLabel: p.fact?.label ?? '',
  factValue: p.fact?.value ?? '',
});
const pas = Math.ceil(entrants.length / sortants.length);
let oi = 0;
export const manifeste = [];
entrants.forEach((p, n) => {
  if (n % pas === 0 && oi < sortants.length) manifeste.push(carte(sortants[oi++]));
  manifeste.push(carte(p));
});
while (oi < sortants.length) manifeste.push(carte(sortants[oi++]));
