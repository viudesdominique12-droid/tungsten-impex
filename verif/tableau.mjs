import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);

const lire = () => p.evaluate(() => {
  const c = document.getElementById('board-card');
  const visible = [...c.querySelectorAll('.board__face')]
    .find((f) => getComputedStyle(f).backfaceVisibility === 'hidden' &&
                 f.getBoundingClientRect().width > 0);
  const faces = [...c.querySelectorAll('.board__face')].map((f) => ({
    flow: f.dataset.flow,
    bg: getComputedStyle(f).backgroundColor,
    nom: f.querySelector('.board__n')?.textContent ?? '',
    dir: f.querySelector('.board__dir')?.textContent ?? '',
  }));
  return { transform: getComputedStyle(c).transform, href: c.getAttribute('href'),
           flow: c.dataset.dir, faces, h: Math.round(c.getBoundingClientRect().height) };
});

const etats = [];
etats.push(await lire());
for (let i = 0; i < 3; i++) { await p.waitForTimeout(3800); etats.push(await lire()); }

console.log('erreurs de page :', erreurs.length ? erreurs.join(' | ') : 'aucune');
console.log('hauteur du panneau :', etats[0].h + 'px\n');
etats.forEach((e, i) => {
  const f = e.faces.find((x) => x.nom);
  console.log(`t${i}  href ${String(e.href).padEnd(34)} flow ${String(e.flow).padEnd(4)}` +
              ` faces: ${e.faces.map((x) => `${x.dir || '-'}/${x.flow}/${x.bg}`).join('  ')}`);
});
const tourne = new Set(etats.map((e) => e.href)).size;
const fonds = new Set(etats.flatMap((e) => e.faces.map((x) => x.bg)));
console.log(`\nliens distincts sur 4 bascules : ${tourne}`);
console.log('fonds rencontres :', [...fonds].join(' , '));

/* capture des deux etats : une sortie et une entree */
await p.evaluate(() => scrollTo(0, 0));
for (let i = 0; i < 8; i++) {
  const e = await lire();
  const f = e.faces.find((x) => x.nom && x.flow === 'out');
  if (f && e.flow === 'out') { await p.screenshot({ path: 'verif/tableau-out.png' }); break; }
  await p.waitForTimeout(3700);
}
for (let i = 0; i < 8; i++) {
  const e = await lire();
  if (e.flow === 'in') { await p.screenshot({ path: 'verif/tableau-in.png' }); break; }
  await p.waitForTimeout(3700);
}
await b.close();
