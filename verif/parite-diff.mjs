import { readFileSync } from 'node:fs';
const { site, maq, erreurs } = JSON.parse(readFileSync('verif/parite-tmp/mesures.json', 'utf8'));
const routes = Object.keys(site);
console.log('erreurs js maquette:', erreurs.length, erreurs.slice(0, 3));
for (const r of routes) {
  const s = site[r], m = maq[r];
  const out = [];
  if (s.titre !== m.titre) out.push(`  TITRE   site="${s.titre}" | maq="${m.titre}"`);
  const d = Math.abs(m.hauteur - s.hauteur) / s.hauteur * 100;
  if (d > 5) out.push(`  HAUTEUR site=${s.hauteur} maq=${m.hauteur} ecart=${d.toFixed(1)}%`);
  else if (s.hauteur !== m.hauteur) out.push(`  hauteur(ok<5%) site=${s.hauteur} maq=${m.hauteur} ${d.toFixed(1)}%`);
  for (const k of Object.keys(s.n)) if (s.n[k] !== m.n[k]) out.push(`  COMPTE  ${k}: site=${s.n[k]} maq=${m.n[k]}`);
  for (const k of Object.keys(s.couleurs)) if (s.couleurs[k] !== m.couleurs[k]) out.push(`  STYLE   ${k}: site=${s.couleurs[k]} | maq=${m.couleurs[k]}`);
  if (s.imgCassees !== m.imgCassees) out.push(`  IMG CASSEES site=${s.imgCassees}/${s.imgTotal} maq=${m.imgCassees}/${m.imgTotal}`);
  if (s.texte !== m.texte) {
    const a = s.texte, b = m.texte;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    out.push(`  TEXTE   len site=${a.length} maq=${b.length}; divergence a l'offset ${i}`);
    out.push(`     site: ...${JSON.stringify(a.slice(Math.max(0,i-60), i+180))}`);
    out.push(`     maq : ...${JSON.stringify(b.slice(Math.max(0,i-60), i+180))}`);
  }
  if (out.length) { console.log('\n=== ' + r); console.log(out.join('\n')); }
}
