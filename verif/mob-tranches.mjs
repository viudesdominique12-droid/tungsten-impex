/* ---------------------------------------------------------------------------
   Les tranches mobiles. Le pli seul ne dit rien du rythme d'une page : ce qui
   se juge, c'est la suite — deux blocs qui se touchent presque, une section
   qui commence a 8px de la precedente. On defile donc la page entiere par
   ecrans de 844px et on garde chaque vue.

   Usage : node verif/mob-tranches.mjs <dossier>
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = `verif/${process.argv[2] || 'mob'}`;
mkdirSync(OUT, { recursive: true });

const pages = [['/', 'accueil'], ['/export/sesame-seed/', 'fiche-out'],
               ['/import/electric-vehicles/', 'fiche-in'],
               ['/about/', 'about'], ['/contact/', 'contact'], ['/training/', 'training']];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
                                 deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage();

for (const [chemin, nom] of pages) {
  await p.goto('http://localhost:4321' + chemin, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${nom}-00.png` });
  const h = await p.evaluate(() => document.body.scrollHeight);
  const deborde = await p.evaluate(() => document.documentElement.scrollWidth - 390);
  console.log(`${nom.padEnd(10)} hauteur ${String(h).padStart(5)}px   debordement ${deborde}px`);
  const n = Math.min(Math.ceil(h / 844), 14);
  for (let i = 1; i < n; i++) {
    await p.evaluate((y) => scrollTo(0, y), i * 844);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/${nom}-${String(i).padStart(2, '0')}.png` });
  }
}
await b.close();
