/* ANGLE mise en page : captures a regarder + vides horizontaux. A supprimer. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const HOTE = 'http://localhost:4321';
const cible = process.argv[2] || 'lot1';

const LOTS = {
  lot1: [['/import/building-glass/', 'glass'], ['/import/solar-lanterns/', 'lanternes'],
         ['/export/sesame-seed/', 'sesame'], ['/import/human-medicine/', 'medicine']],
  lot2: [['/import/ceramics/', 'ceramics'], ['/import/medical-equipment/', 'medequip'],
         ['/export/red-kidney-beans/', 'beans'], ['/import/stationery-materials/', 'stationery']],
  lot3: [['/about/', 'about'], ['/contact/', 'contact'], ['/training/', 'training'],
         ['/import/electric-vehicles/', 'ev']],
};

const FORMATS = [
  { nom: 'pc', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { nom: 'tel', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

fs.mkdirSync('verif/mep-vues', { recursive: true });
const b = await chromium.launch();
const vides = {};
for (const f of FORMATS) {
  const ctx = await b.newContext(f);
  for (const [u, n] of LOTS[cible]) {
    const p = await ctx.newPage();
    await p.goto(HOTE + u, { waitUntil: 'networkidle' });
    await p.evaluate(async () => {
      await document.fonts.ready;
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    });
    await p.waitForTimeout(250);

    // vide horizontal dans la tete et dans chaque section
    vides[`${f.nom}|${n}`] = await p.evaluate(() => {
      const R = (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y + scrollY, w: b.width, h: b.height }; };
      const lignes = [];
      for (const s of document.querySelectorAll('section.section, header.tete, figure.pleine, div.portrait')) {
        const sh = s.querySelector('.shell') || s;
        const b = R(sh);
        const feuilles = [...sh.querySelectorAll('*')].filter((e) => !e.querySelector('*') || e.matches('img'));
        const bs = feuilles.map(R).filter((k) => k.w > 2 && k.h > 2);
        if (!bs.length) continue;
        lignes.push({
          sec: (s.className || '').split(' ').filter((c) => c !== 'section').slice(0, 2).join(' ') || s.dataset.type,
          type: s.dataset.type || '-', shellW: +b.w.toFixed(0), h: +R(s).h.toFixed(0),
          videD: +((b.x + b.w) - Math.max(...bs.map((k) => k.x + k.w))).toFixed(0),
          videG: +(Math.min(...bs.map((k) => k.x)) - b.x).toFixed(0),
        });
      }
      return lignes;
    });

    // page entiere + tranches d'ecran
    await p.screenshot({ path: `verif/mep-vues/${f.nom}-${n}-full.png`, fullPage: true });
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    const vh = f.viewport.height;
    for (let k = 0, y = 0; y < H && k < 8; k++, y += vh) {
      await p.evaluate((yy) => scrollTo(0, yy), y);
      await p.waitForTimeout(160);
      await p.screenshot({ path: `verif/mep-vues/${f.nom}-${n}-e${k}.png` });
    }
    await p.close();
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(`verif/mep-vides-${cible}.json`, JSON.stringify(vides, null, 1));
console.log('captures', cible);
