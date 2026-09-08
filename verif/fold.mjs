import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices['iPhone 12'] })).newPage();
await p.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p.evaluate(() => document.fonts.ready);
const m = await p.evaluate(() => {
  const h = document.querySelector('.hero__h').getBoundingClientRect();
  const bd = document.getElementById('board').getBoundingClientRect();
  const cs = getComputedStyle(document.querySelector('.hero__h'));
  return { corps: cs.fontSize, titreH: Math.round(h.height),
           lignes: Math.round(h.height / parseFloat(cs.lineHeight)),
           hautPanneau: Math.round(bd.top), basPanneau: Math.round(bd.bottom),
           ecran: innerHeight };
});
console.log(`corps ${m.corps}  titre ${m.titreH}px (~${m.lignes} lignes)`);
console.log(`panneau ${m.hautPanneau} -> ${m.basPanneau}   ecran ${m.ecran}px`);
console.log(m.hautPanneau < m.ecran ? '  le panneau affleure la ligne de flottaison'
                                    : '  le panneau est HORS de la premiere vue');
await b.close();
