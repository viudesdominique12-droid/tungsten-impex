import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.evaluate(async () => {
    document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    // decoding="async" : attendre onload ne suffit pas, la capture peut
    // passer avant le decodage. On attend le decodage lui-meme.
    await Promise.all([...document.querySelectorAll('img')]
      .map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(300);
const y = await p.evaluate(() => document.querySelector('.orient').getBoundingClientRect().top + scrollY);
await p.evaluate((v) => scrollTo(0, v - 30), y);
await p.waitForTimeout(400);
await p.screenshot({ path: 'verif/bas.png' });
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
await p.screenshot({ path: 'verif/haut.png' });
await b.close();
