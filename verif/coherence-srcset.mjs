/* ANGLE coherence — annexe : ce que le navigateur telecharge pour la plaque. */
import { chromium } from 'playwright';
const BASE = 'http://localhost:4321';
const R = [['niger-seed-noug', 'export'], ['sesame-seed', 'export'], ['red-kidney-beans', 'export'], ['soya-bean', 'export'],
['electric-vehicles', 'import'], ['medical-equipment', 'import'], ['human-medicine', 'import'], ['building-glass', 'import'],
['elevator-and-escalator', 'import'], ['calcium-hypochlorite', 'import'], ['plastic-raw-materials', 'import'],
['solar-lanterns', 'import'], ['stationery-materials', 'import'], ['ceramics', 'import']];

const nav = await chromium.launch();
for (const fmt of [['bureau', 1440, 900, 1, false], ['tel', 390, 844, 2, true]]) {
  const [nom, w, h, dpr, mob] = fmt;
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mob, hasTouch: mob });
  console.log('=== ' + nom + ' ===');
  for (const [slug, dossier] of R) {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${dossier}/${slug}/`, { waitUntil: 'networkidle' });
    const d = await p.evaluate(() => {
      const im = document.querySelector('.plaque img');
      const src = im.closest('picture')?.querySelector('source');
      const b = im.getBoundingClientRect();
      return {
        srcset: (src?.getAttribute('srcset') || im.getAttribute('srcset') || '').replace(/\/_image\?[^ ]*?&w=/g, 'w=').split(', ').map((s) => s.trim().split(' ').pop()).join('|'),
        sizes: im.getAttribute('sizes'),
        nat: im.naturalWidth,
        aff: Math.round(b.width),
        attrW: im.getAttribute('width'), attrH: im.getAttribute('height'),
      };
    });
    console.log(slug.padEnd(24), 'srcset=' + String(d.srcset).padEnd(18), 'nat=' + String(d.nat).padStart(5), 'affiche=' + String(d.aff).padStart(4), 'attr=' + d.attrW + 'x' + d.attrH);
    await p.close();
  }
  await ctx.close();
}
await nav.close();
