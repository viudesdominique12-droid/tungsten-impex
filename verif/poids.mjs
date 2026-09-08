import { chromium } from 'playwright';
const b = await chromium.launch();
for (const r of ['/', '/about/', '/import/electric-vehicles/', '/export/niger-seed-noug/']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  let images = 0, total = 0;
  p.on('response', async (res) => {
    const l = Number(res.headers()['content-length'] || 0);
    total += l;
    if (/image|webp|jpe?g|png/.test(res.headers()['content-type'] || '')) images += l;
  });
  await p.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(600);
  console.log(`  ${r.padEnd(30)} images ${String(Math.round(images/1024)).padStart(5)} Ko   page ${String(Math.round(total/1024)).padStart(5)} Ko`);
  await ctx.close();
}
await b.close();
