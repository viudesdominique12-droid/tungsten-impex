import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });

/* On releve les instants de bascule depuis la page elle-meme : un sondage
   depuis Playwright ajouterait sa propre granularite a la mesure. */
const marques = await p.evaluate(() => new Promise((ok) => {
  const c = document.getElementById('board-card');
  const t = [], t0 = performance.now();
  new MutationObserver(() => t.push(Math.round(performance.now() - t0)))
    .observe(c, { attributes: true, attributeFilter: ['href'] });
  setTimeout(() => ok(t), 14000);
}));
const ecarts = marques.slice(1).map((v, i) => v - marques[i]);
const moy = ecarts.reduce((a, c) => a + c, 0) / ecarts.length;
console.log('bascules en 14 s :', marques.length);
console.log('premiere a        :', marques[0], 'ms');
console.log('ecarts            :', ecarts.join(', '), 'ms');
console.log('cadence moyenne   :', Math.round(moy), 'ms');
const tr = await p.evaluate(() => getComputedStyle(document.getElementById('board-card')).transitionDuration);
console.log('duree de rotation :', tr);
await b.close();
