import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
for (const [u, n] of [['/about/','about'], ['/contact/','contact'],
                      ['/training/','training'], ['/export/niger-seed-noug/','out-fiche'], ['/import/electric-vehicles/','in-fiche']]) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `verif/p-${n}.png`, fullPage: true });
  await p.close();
}
await b.close(); console.log('pages capturees');
