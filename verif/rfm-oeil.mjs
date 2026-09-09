// RFM — l'oeil : sur-servir le mot-symbole se VOIT-il ? et le remede se voit-il ?
// A = etat actuel (ressource 340px). B = remede propose (ressource 232px).
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4321';
const d = (w) => 'data:image/webp;base64,' + fs.readFileSync(`verif/rfm-vues/mot-${w}.webp`).toString('base64');

const CAS = [
  { nom: 'tel-dpr2', opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { nom: 'tel-dpr3', opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
  { nom: 'pc-dpr1',  opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { nom: 'pc-dpr2',  opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
];

const nav = await chromium.launch();
for (const cas of CAS) {
  const ctx = await nav.newContext(cas.opts);
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });

  const boite = await p.evaluate(() => {
    const r = document.querySelector('.mark').getBoundingClientRect();
    const i = document.querySelector('.mark__mot').getBoundingClientRect();
    return { mark: { x: r.x, y: r.y, w: r.width, h: r.height }, mot: { x: i.x, y: i.y, w: i.width, h: i.height } };
  });

  // A : tel quel
  await p.locator('.hdr').screenshot({ path: `verif/rfm-vues/${cas.nom}-A-actuel.png` });
  await p.screenshot({ path: `verif/rfm-vues/${cas.nom}-A-loupe.png`,
    clip: { x: boite.mark.x - 4, y: boite.mark.y - 6, width: boite.mark.w + 20, height: boite.mark.h + 12 } });

  // B : remede — meme boite CSS, ressource 232px
  await p.evaluate((src) => {
    const i = document.querySelector('.mark__mot');
    i.removeAttribute('srcset'); i.removeAttribute('sizes');
    i.src = src;
  }, d(232));
  await p.waitForTimeout(300);
  await p.locator('.hdr').screenshot({ path: `verif/rfm-vues/${cas.nom}-B-remede.png` });
  await p.screenshot({ path: `verif/rfm-vues/${cas.nom}-B-loupe.png`,
    clip: { x: boite.mark.x - 4, y: boite.mark.y - 6, width: boite.mark.w + 20, height: boite.mark.h + 12 } });

  const info = await p.evaluate(() => {
    const i = document.querySelector('.mark__mot');
    const r = i.getBoundingClientRect();
    return { css: [+r.width.toFixed(1), +r.height.toFixed(1)], dpr: devicePixelRatio,
             demande: Math.round(r.width * devicePixelRatio) };
  });
  console.log(cas.nom, 'css=' + info.css.join('x'), 'dpr=' + info.dpr, 'demande=' + info.demande + 'px',
    '| A sert 340 (' + (340 / info.demande).toFixed(2) + 'x)',
    '| B sert 232 (' + (232 / info.demande).toFixed(2) + 'x)');
  await ctx.close();
}
await nav.close();
