/* Audit des liens internes sur le site construit. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pages = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})('dist');

let bad = 0, n = 0;
for (const f of pages) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const u = m[1];
    if (/\.(jpg|png|woff2|css|js|svg|xml|ico)$/.test(u)) continue;
    n++;
    const target = u.endsWith('/') ? join('dist', u, 'index.html') : join('dist', u);
    if (!existsSync(target)) { console.log('  404 ->', u, '   depuis', f); bad++; }
  }
}
console.log(`${pages.length} pages | ${n} liens de page | ${bad} casses`);
