import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = `verif/${process.argv[2] || 'b'}`;
mkdirSync(OUT, { recursive: true });
const pages = [['/', 'accueil'], ['/export/sesame-seed/', 'fiche-out'],
               ['/import/electric-vehicles/', 'fiche-in'],
               ['/about/', 'about'], ['/contact/', 'contact'], ['/training/', 'training']];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
for (const [chemin, nom] of pages) {
  await p.goto('http://localhost:4321' + chemin, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map(i => i.decode().catch(()=>{}))); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${nom}-00.png` });
  const h = await p.evaluate(() => document.body.scrollHeight);
  console.log(`${nom.padEnd(10)} ${h}px  debord ${await p.evaluate(() => document.documentElement.scrollWidth - 1440)}`);
  const n = Math.min(Math.ceil(h / 900), 14);
  for (let i = 1; i < n; i++) {
    await p.evaluate((y) => scrollTo(0, y), i * 900);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/${nom}-${String(i).padStart(2, '0')}.png` });
  }
}
await b.close();
