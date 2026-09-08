import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
for (const [u, n] of [['/import/calcium-hypochlorite/','pire-400'],
                      ['/import/stationery-materials/','pire-500'],
                      ['/training/','pire-portrait']]) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    // decoding="async" : attendre onload ne suffit pas, la capture peut
    // passer avant le decodage. On attend le decodage lui-meme.
    await Promise.all([...document.querySelectorAll('img')]
      .map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `verif/${n}.png` });
  await p.close();
}
await b.close(); console.log('pires cas captures');
