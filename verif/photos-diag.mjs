import { chromium } from 'playwright';
const routes = ['/', '/about/', '/contact/', '/training/',
  '/export/niger-seed-noug/', '/export/soya-bean/',
  '/import/electric-vehicles/', '/import/calcium-hypochlorite/',
  '/import/stationery-materials/', '/import/medical-equipment/'];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 })).newPage();
let pire = 0, coupables = [];
for (const r of routes) {
  await p.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')]
      .map(i => i.complete ? 0 : new Promise(res => { i.onload = i.onerror = res; })));
  });
  const rows = await p.evaluate(() => [...document.querySelectorAll('img')].map(i => ({
    src: (i.currentSrc || i.src).split('/').pop(),
    intrinseque: i.naturalWidth,
    affiche: Math.round(i.getBoundingClientRect().width),
    haut: Math.round(i.getBoundingClientRect().height),
    attrs: i.getAttribute('width') && i.getAttribute('height') ? 'oui' : 'NON',
  })));
  if (!rows.length) continue;
  console.log('\n' + r);
  for (const x of rows) {
    const e = x.intrinseque ? x.affiche / x.intrinseque : 0;
    if (e > pire) pire = e;
    if (e > 1.001) coupables.push(r + ' ' + x.src);
    console.log(`  ${x.src.slice(0,46).padEnd(48)} servie ${String(x.intrinseque).padStart(5)}px -> affichee ${String(x.affiche).padStart(4)}x${String(x.haut).padEnd(4)}  echelle ${e.toFixed(2)}x   dimensions dans le HTML : ${x.attrs}`);
  }
}
console.log('\n=================================================');
console.log('agrandissement maximal sur tout le site :', pire.toFixed(2) + 'x');
console.log(coupables.length ? 'AGRANDIES : ' + coupables.join(', ') : 'aucune image agrandie');
await b.close();
