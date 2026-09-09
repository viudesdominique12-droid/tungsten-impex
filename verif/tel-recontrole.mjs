/* Recontrole d'une seule route : la mesure de /import/plastic-raw-materials/
   etait aberrante (2120px, ni plaque ni barre) alors que le HTML servi les
   contient. On recharge deux fois pour distinguer un vrai defaut d'un
   accident de compilation du serveur de developpement. */
import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('  console.error:', m.text().slice(0, 160)); });
p.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 160)));

for (const tour of [1, 2]) {
  await p.goto('http://localhost:4321/import/plastic-raw-materials/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => ({
    h: document.body.scrollHeight,
    plaque: !!document.querySelector('.plaque'),
    barre: !!document.getElementById('barre'),
    feuilles: document.styleSheets.length,
    sections: document.querySelectorAll('.section').length,
  }));
  console.log(`tour ${tour}`, JSON.stringify(m));
}
await b.close();
