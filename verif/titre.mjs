import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const m = await p.evaluate(() => {
  const h = document.querySelector('.hero__h');
  const cs = getComputedStyle(h);
  const lh = parseFloat(cs.lineHeight);
  const phrases = [...h.querySelectorAll('.line')].map((l) =>
    Math.round(l.getBoundingClientRect().height / lh));
  const say = document.querySelector('.hero__say').getBoundingClientRect();
  const img = document.querySelector('.hero__img img').getBoundingClientRect();
  const bd = document.getElementById('board').getBoundingClientRect();
  return { corps: cs.fontSize, lignes: phrases, total: phrases.reduce((a, c) => a + c, 0),
           colonne: Math.round(say.width), image: Math.round(img.width) + 'x' + Math.round(img.height),
           panneauBas: Math.round(bd.bottom),
           over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
console.log(`corps ${m.corps}  colonne ${m.colonne}px  lignes par phrase ${m.lignes.join(' + ')} = ${m.total}`);
console.log(`image ${m.image}  bas du panneau ${m.panneauBas}px  debordement ${m.over}px`);
await b.close();
