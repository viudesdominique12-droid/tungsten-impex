import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('https://viudesdominique12-droid.github.io/zaziwe-labs/', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1200);
const t = await p.evaluate(() => {
  const vus = new Map();
  for (const el of document.querySelectorAll('body *')) {
    const bg = getComputedStyle(el).backgroundColor;
    const n = (bg.match(/[\d.]+/g) || []).map(Number);
    if (n.length < 3 || (n.length > 3 && n[3] < .5)) continue;
    const [r, g, bl] = n;
    // teintes claires a dominante bleue : le lavis qu'on cherche
    if (r > 200 && bl > r + 4 && bl < 255) {
      const a = el.getBoundingClientRect();
      vus.set(bg, (vus.get(bg) || 0) + Math.round(a.width * a.height));
    }
  }
  const fonce = new Map();
  for (const el of document.querySelectorAll('body *')) {
    const bg = getComputedStyle(el).backgroundColor;
    const n = (bg.match(/[\d.]+/g) || []).map(Number);
    if (n.length < 3) continue;
    if (n[2] - n[0] > 45 && n[0] < 120) {
      const a = el.getBoundingClientRect();
      fonce.set(bg, (fonce.get(bg) || 0) + Math.round(a.width * a.height));
    }
  }
  return { clairs: [...vus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
           fonces: [...fonce.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
           corps: getComputedStyle(document.body).backgroundColor };
});
console.log('fond du corps          :', t.corps);
console.log('lavis bleus clairs     :', t.clairs.map(([c, a]) => `${c}  (${Math.round(a/1000)}k px2)`).join('\n                         '));
console.log('bleus soutenus         :', t.fonces.map(([c, a]) => `${c}  (${Math.round(a/1000)}k px2)`).join('\n                         '));
await b.close();
