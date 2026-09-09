/* A/B : la plaque telle qu'elle est (sizes = le cadre) vs telle que le remede
   la voudrait (sizes = la largeur reellement occupee). Meme page, meme pixel ?
   Script jetable. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const OUT = fileURLToPath(new URL('.', import.meta.url));
const B = 'http://localhost:4321';

const cas = [
  ['/import/building-glass/', 'glass'],
  ['/import/solar-lanterns/', 'lantern'],
  ['/import/human-medicine/', 'medic'],
];

const b = await chromium.launch();
const rows = [];
for (const [nom, ctx] of [
  ['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['tel', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const c = await b.newContext(ctx);
  const p = await c.newPage();
  for (const [route, court] of cas) {
    await p.goto(B + route, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const fig = p.locator('.plaque.intro__img');
    await fig.screenshot({ path: `${OUT}/zlaid-${nom}-${court}-A-actuel.png` });
    const a = await p.evaluate(async () => {
      const i = document.querySelector('.plaque.intro__img img');
      const t = new Image(); t.src = i.currentSrc; await t.decode();
      const r = await fetch(i.currentSrc); const oct = (await r.blob()).size;
      return { servi: t.naturalWidth, oct, occupe: +i.getBoundingClientRect().width.toFixed(1),
               dpr: devicePixelRatio, sizes: i.getAttribute('sizes') };
    });
    // B : on impose le sizes que le remede calculerait
    const bres = await p.evaluate(async () => {
      const i = document.querySelector('.plaque.intro__img img');
      const pic = i.closest('picture');
      const w = Math.round(i.getBoundingClientRect().width);
      for (const s of pic.querySelectorAll('source')) s.setAttribute('sizes', w + 'px');
      i.setAttribute('sizes', w + 'px');
      await new Promise(r => setTimeout(r, 900));
      const t = new Image(); t.src = i.currentSrc; await t.decode();
      const r = await fetch(i.currentSrc); const oct = (await r.blob()).size;
      return { servi: t.naturalWidth, oct, sizes: w + 'px',
               occupe: +i.getBoundingClientRect().width.toFixed(1) };
    });
    await fig.screenshot({ path: `${OUT}/zlaid-${nom}-${court}-B-remede.png` });
    rows.push({ vue: nom, page: court, A: a, B: bres });
    console.log(`${nom} ${court.padEnd(8)} occupe ${a.occupe} dpr${a.dpr}` +
      ` | A sizes=${a.sizes} servi ${a.servi}w ${(a.oct/1024).toFixed(1)}Ko` +
      ` | B sizes=${bres.sizes} servi ${bres.servi}w ${(bres.oct/1024).toFixed(1)}Ko` +
      ` | economie ${((a.oct-bres.oct)/1024).toFixed(1)}Ko`);
  }
  await c.close();
}
fs.writeFileSync(`${OUT}/zlaid-ab.json`, JSON.stringify(rows, null, 1));
await b.close();
