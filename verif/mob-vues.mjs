import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 12'] });
for (const [u, n, y] of [['/', 'm-accueil', 0], ['/', 'm-accueil2', 900],
                         ['/import/electric-vehicles/', 'm-fiche', 0],
                         ['/contact/', 'm-contact', 500]]) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))); });
  if (y) await p.evaluate((v) => scrollTo(0, v), y);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `verif/${n}.png` });
  await p.close();
}
await b.close(); console.log('vues mobiles capturees');
