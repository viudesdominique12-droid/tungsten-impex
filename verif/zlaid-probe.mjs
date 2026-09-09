import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const b = await chromium.launch();
for (const [nom, ctx] of [
  ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['tel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const c = await b.newContext(ctx);
  const p = await c.newPage();
  for (const r of ['/import/building-glass/', '/import/solar-lanterns/', '/export/sesame-seed/']) {
    await p.goto(B + r, { waitUntil: 'networkidle' });
    const m = await p.evaluate(() => {
      const i = document.querySelector('.plaque.intro__img img');
      const pic = i.closest('picture');
      return { sizes: i.getAttribute('sizes'), src: i.currentSrc,
        nat: i.naturalWidth + 'x' + i.naturalHeight, complete: i.complete,
        srcset: i.getAttribute('srcset'),
        sources: [...pic.querySelectorAll('source')].map(s => s.type + ' :: ' + s.getAttribute('srcset')),
        rect: i.getBoundingClientRect().width.toFixed(1) + 'x' + i.getBoundingClientRect().height.toFixed(1) };
    });
    console.log('==', nom, r);
    console.log(JSON.stringify(m, null, 1));
  }
  await c.close();
}
await b.close();
