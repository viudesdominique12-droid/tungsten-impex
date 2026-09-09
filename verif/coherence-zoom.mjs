/* ANGLE coherence — la plaque a l'echelle 1, pour juger a l'oeil. */
import { chromium } from 'playwright';
const BASE = 'http://localhost:4321';
const arg = process.argv.slice(2);
const fmt = arg.pop();
const vp = fmt === 'tel'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const nav = await chromium.launch();
const ctx = await nav.newContext(vp);
for (const spec of arg) {
  const [d, slug] = spec.split(':');
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${d}/${slug}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(150);
  // le cadre de la section intro, pour voir la plaque dans son contexte
  await p.locator('.intro').screenshot({ path: `verif/coh-tmp/zoom-${fmt}-${slug}.png` });
  console.log(`verif/coh-tmp/zoom-${fmt}-${slug}.png`);
  await p.close();
}
await nav.close();
