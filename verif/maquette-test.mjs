import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const html = readFileSync('verif/maquette.html', 'utf8');
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const err = [];
p.on('pageerror', (e) => err.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });

/* Le document est publie tel quel dans un corps fourni par l'hote : on le
   reproduit a l'identique, sans doctype ni <head> propres. */
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`,
                   { waitUntil: 'load' });
await p.waitForTimeout(1200);

const etat = async () => p.evaluate(() => ({
  titre: document.title,
  flow: document.body.getAttribute('data-flow'),
  h1: document.querySelector('h1')?.textContent.trim().slice(0, 40),
  fond: getComputedStyle(document.body).backgroundColor,
  imgs: [...document.querySelectorAll('img')].map((i) => ({
    ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width),
  })),
  fonte: document.fonts.check('500 52px Archivo'),
  over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));

console.log('erreurs :', err.length ? err.slice(0, 3).join(' | ') : 'aucune');
let e = await etat();
console.log(`accueil   : "${e.h1}"  fonte Archivo ${e.fonte ? 'chargee' : 'ABSENTE'}  images ${e.imgs.filter(i=>i.ok).length}/${e.imgs.length}  debordement ${e.over}`);

/* le tableau tourne-t-il ? */
const t0 = await p.evaluate(() => document.getElementById('board-card')?.getAttribute('href'));
await p.waitForTimeout(4200);
const t1 = await p.evaluate(() => document.getElementById('board-card')?.getAttribute('href'));
console.log(`tableau   : ${t0} -> ${t1}  ${t0 !== t1 ? 'tourne' : 'IMMOBILE'}`);

/* La forme, pas seulement le comportement. La maquette est partie une fois
   avec un tableau a plat — faces statiques, aucune perspective — parce que sa
   feuille de style manquait. Elle tournait pourtant, et changeait de fond. */
const forme = await p.evaluate(() => {
  const c = document.getElementById('board-card');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { h: Math.round(r.height), style3d: getComputedStyle(c).transformStyle,
           persp: getComputedStyle(c.parentElement).perspective,
           faces: [...document.querySelectorAll('.board__face')]
                    .map((x) => getComputedStyle(x).position) };
});
const bonne = forme && forme.h >= 200 && forme.style3d === 'preserve-3d' &&
              forme.persp !== 'none' && forme.faces.every((x) => x === 'absolute');
console.log(`forme     : ${bonne ? 'juste' : 'CASSEE'}  ` +
            `${forme ? forme.h + 'px, ' + forme.style3d + ', perspective ' + forme.persp : 'absent'}`);
if (!bonne) { console.error('ARRET : le tableau est a plat dans la maquette.'); process.exit(1); }

/* navigation vers une fiche import */
await p.evaluate(() => [...document.querySelectorAll('a')]
  .find((a) => a.getAttribute('href') === '/import/electric-vehicles/')?.click());
await p.waitForTimeout(700);
e = await etat();
console.log(`fiche in  : "${e.h1}"  flow=${e.flow}  fond ${e.fond}  images ${e.imgs.filter(i=>i.ok).length}/${e.imgs.length}`);
await p.screenshot({ path: 'verif/maquette-in.png' });

/* retour a l accueil par le logotype */
await p.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/')?.click());
await p.waitForTimeout(700);
e = await etat();
console.log(`retour    : "${e.h1}"  flow=${e.flow ?? 'aucun'}  fond ${e.fond}`);

/* une page claire */
await p.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/about/')?.click());
await p.waitForTimeout(900);
e = await etat();
console.log(`a propos  : "${e.h1}"  images ${e.imgs.filter(i=>i.ok).length}/${e.imgs.length}  debordement ${e.over}`);
await p.screenshot({ path: 'verif/maquette-about.png', fullPage: true });

await p.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/')?.click());
await p.waitForTimeout(900);
await p.screenshot({ path: 'verif/maquette-accueil.png' });
console.log('erreurs finales :', err.length ? err.slice(0, 3).join(' | ') : 'aucune');
await b.close();
