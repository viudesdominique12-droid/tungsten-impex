/* Quelles photos sont reellement posees dans le site construit ? */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) html.push(readFileSync(p, 'utf8'));
  }
})('dist');
const all = html.join('\n');

const report = (dir) => {
  const files = readdirSync(join('src/img', dir)).filter((f) => f.endsWith('.jpg'));
  // Depuis le passage au pipeline d'Astro les noms livres sont hachés
  // (niger-seed-noug.CbBN2SLo_S0YAB.webp) : on cherche le radical, pas le
  // chemin d'origine, qui n'existe plus dans le HTML livre.
  const used = files.filter((f) => all.includes(`/${f.replace(/\.jpg$/, '')}.`));
  const idle = files.filter((f) => !used.includes(f));
  console.log(`\n${dir} : ${used.length}/${files.length} posees`);
  if (idle.length) console.log('  en reserve : ' + idle.join(', '));
};
report('products');
report('company');
