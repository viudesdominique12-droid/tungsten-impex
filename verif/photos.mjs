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
  const files = readdirSync(join('public/img', dir)).filter((f) => f.endsWith('.jpg'));
  const used = files.filter((f) => all.includes(`/img/${dir}/${f}`));
  const idle = files.filter((f) => !used.includes(f));
  console.log(`\n${dir} : ${used.length}/${files.length} posees`);
  if (idle.length) console.log('  en reserve : ' + idle.join(', '));
};
report('products');
report('company');
