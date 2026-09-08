import { readFileSync } from 'node:fs';
const { site, maq } = JSON.parse(readFileSync('verif/parite-tmp/fin.json', 'utf8'));
let total = 0;
for (const r of Object.keys(site)) {
  const s = site[r], m = maq[r]; const out = [];
  if (s.lang !== m.lang) out.push(`  LANG    site="${s.lang}" maq="${m.lang}"`);
  if (s.titre !== m.titre) out.push(`  TITRE   site="${s.titre}" maq="${m.titre}"`);
  const d = Math.abs(m.hauteur - s.hauteur) / s.hauteur * 100;
  if (d > 0) out.push(`  ${d > 5 ? 'HAUTEUR' : 'hauteur'} site=${s.hauteur} maq=${m.hauteur} ${d.toFixed(2)}%`);
  if (s.largeurScroll !== m.largeurScroll) out.push(`  SCROLL-X site=${s.largeurScroll} maq=${m.largeurScroll}`);
  if (s.texte !== m.texte) {
    let i = 0; while (i < s.texte.length && s.texte[i] === m.texte[i]) i++;
    out.push(`  TEXTE   len site=${s.texte.length} maq=${m.texte.length} div@${i}`);
    out.push(`    site: ${JSON.stringify(s.texte.slice(Math.max(0,i-50), i+150))}`);
    out.push(`    maq : ${JSON.stringify(m.texte.slice(Math.max(0,i-50), i+150))}`);
  }
  for (const k of Object.keys(s.styles)) if (s.styles[k] !== m.styles[k]) out.push(`  STYLE ${k}\n    site: ${s.styles[k]}\n    maq : ${m.styles[k]}`);
  if (s.geo.length !== m.geo.length) out.push(`  GEO nb blocs site=${s.geo.length} maq=${m.geo.length}`);
  else s.geo.forEach((g, i) => {
    const q = m.geo[i];
    const diffs = [];
    if (g.h !== q.h) diffs.push(`h ${g.h}->${q.h}`);
    if (g.w !== q.w) diffs.push(`w ${g.w}->${q.w}`);
    if (g.bg !== q.bg) diffs.push(`bg ${g.bg}->${q.bg}`);
    if (g.fg !== q.fg) diffs.push(`fg ${g.fg}->${q.fg}`);
    if (diffs.length) out.push(`  GEO [${i}] ${g.tag}.${g.cls} type=${g.type} sol=${g.sol} :: ${diffs.join(', ')}`);
  });
  if (s.imgDim.join() !== m.imgDim.join()) {
    out.push(`  IMG site=${s.imgDim.length} maq=${m.imgDim.length}`);
    s.imgDim.forEach((v, i) => { if (v !== m.imgDim[i]) out.push(`    [${i}] site=${v} maq=${m.imgDim[i]}`); });
  }
  if (out.length) { total++; console.log('\n=== ' + r); console.log(out.join('\n')); }
}
console.log(`\n${total}/${Object.keys(site).length} routes avec au moins un ecart`);
