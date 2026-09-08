import { webkit } from 'playwright';
const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const MOJI = /[\u00c2\u00c3\u00e2\u00e3]\s?[\u0080-\u00bf\u20ac\u0153\u0161\u017e\u2018\u2019\u201c\u201d\u2013\u2014\u2020\u2026]|\uFFFD/g;
const SONDE = () => {
  const t = document.body.innerText;
  const M = /[\u00c2\u00c3\u00e2\u00e3][\u0080-\u00bf\u20ac\u0153\u0161\u017e\u2018\u2019\u201c\u201d\u2013\u2014\u2020\u2026\u02dc\u2122]|\uFFFD/g;
  const trouv = t.match(M) || [];
  const codes = [...document.querySelectorAll('.code')].map((e) => e.textContent.trim().slice(0, 30));
  return { charset: document.characterSet, n: trouv.length,
           echantillon: [...new Set(trouv)].slice(0, 6),
           codes: codes.slice(0, 4),
           tiretsCorrects: (t.match(/\u2014/g) || []).length };
};
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const pm = await ctx.newPage();
await pm.goto(MAQ, { waitUntil: 'load' });
const routes = await pm.evaluate(() => Object.keys(JSON.parse(document.getElementById('routes').textContent)).sort());
let tot = 0;
console.log('=== MAQUETTE dans WebKit (moteur de Safari / iPhone) ===');
for (const r of routes) {
  await pm.evaluate((rr) => { const a = document.createElement('a'); a.href = rr; document.body.append(a); a.click(); a.remove(); }, r);
  await pm.waitForTimeout(120);
  const m = await pm.evaluate(SONDE);
  tot += m.n;
  console.log(`  ${r.padEnd(34)} charset=${m.charset} mojibake=${String(m.n).padStart(3)} tirets_ok=${m.tiretsCorrects}  ex=${JSON.stringify(m.echantillon)}  code0=${JSON.stringify(m.codes[0] || '')}`);
}
console.log('  TOTAL mojibake maquette (WebKit) :', tot);
await pm.close();
console.log('\n=== SITE SERVI dans WebKit ===');
let tot2 = 0;
for (const r of routes) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + r, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(120);
  const m = await p.evaluate(SONDE);
  tot2 += m.n;
  console.log(`  ${r.padEnd(34)} charset=${m.charset} mojibake=${String(m.n).padStart(3)} tirets_ok=${m.tiretsCorrects}  code0=${JSON.stringify(m.codes[0] || '')}`);
  await p.close();
}
console.log('  TOTAL mojibake site (WebKit) :', tot2);
await b.close();
