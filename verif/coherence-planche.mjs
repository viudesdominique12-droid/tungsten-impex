/* ANGLE coherence — la planche de contact : les quatorze plaques cote a cote. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4321';
const R = [['niger-seed-noug', 'export'], ['sesame-seed', 'export'], ['red-kidney-beans', 'export'], ['soya-bean', 'export'],
['electric-vehicles', 'import'], ['medical-equipment', 'import'], ['human-medicine', 'import'], ['building-glass', 'import'],
['elevator-and-escalator', 'import'], ['calcium-hypochlorite', 'import'], ['plastic-raw-materials', 'import'],
['solar-lanterns', 'import'], ['stationery-materials', 'import'], ['ceramics', 'import']];

const dossier = 'verif/coh-tmp';
const cible = process.argv[2] || 'plaque'; // plaque | intro | page
const fmt = process.argv[3] || 'bureau';
const vp = fmt === 'tel'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const nav = await chromium.launch();
const ctx = await nav.newContext(vp);
const vues = [];
for (const [slug, d] of R) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${d}/${slug}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(150);
  let buf;
  if (cible === 'page') {
    buf = await p.screenshot({ fullPage: true });
  } else {
    const sel = cible === 'plaque' ? '.plaque' : '.intro';
    buf = await p.locator(sel).screenshot();
  }
  vues.push({ slug, b64: buf.toString('base64') });
  await p.close();
}
await ctx.close();

/* La planche : on remonte les vignettes dans une page et on la photographie. */
const large = cible === 'page' ? 150 : (fmt === 'tel' ? 200 : 300);
const cols = cible === 'page' ? 7 : (cible === 'plaque' ? 4 : 3);
const html = `<style>
 body{margin:0;background:#111;font:11px/1.3 monospace;color:#eee;padding:12px}
 .g{display:grid;grid-template-columns:repeat(${cols},${large}px);gap:14px}
 figure{margin:0}
 img{width:${large}px;display:block;background:#333;${cible === 'page' ? '' : 'outline:1px solid #f0f;outline-offset:0;'}}
 figcaption{padding:3px 0}
</style><div class="g">${vues.map((v) => `<figure><img src="data:image/png;base64,${v.b64}"><figcaption>${v.slug}</figcaption></figure>`).join('')}</div>`;

const ctx2 = await nav.newContext({ viewport: { width: cols * (large + 14) + 30, height: 800 }, deviceScaleFactor: 1 });
const p2 = await ctx2.newPage();
await p2.setContent(html);
await p2.waitForTimeout(400);
await p2.screenshot({ path: `${dossier}/planche-${cible}-${fmt}.png`, fullPage: true });
await nav.close();
console.log(`${dossier}/planche-${cible}-${fmt}.png`);
