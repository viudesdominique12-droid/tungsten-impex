import { chromium } from 'playwright';
const b = await chromium.launch();
const URL = 'http://localhost:4321/';

const lire = (p) => p.evaluate(() => document.getElementById('board-card')?.getAttribute('href'));
const centre = (p) => p.evaluate(() => {
  const r = document.getElementById('board').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});

const essai = async (nom, opts, avant, attente = 9000) => {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, ...opts })).newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  if (avant) await avant(p);
  const a = await lire(p);
  await p.waitForTimeout(attente);
  const c = await lire(p);
  console.log(`${nom.padEnd(46)} ${a === c ? 'FIGE  ' : 'tourne'}   ${a} -> ${c}`);
  await p.close();
  return a !== c;
};

await essai('curseur ailleurs', {}, null);

await essai('curseur pose puis immobile', {}, async (p) => {
  const c = await centre(p); await p.mouse.move(c.x, c.y); await p.waitForTimeout(300);
});

await essai('curseur qui bouge sans arret dessus', {}, async (p) => {
  const c = await centre(p);
  for (let k = 0; k < 60; k++) { await p.mouse.move(c.x + (k % 20), c.y + (k % 10)); await p.waitForTimeout(140); }
}, 0);

await essai('mouvement reduit', { reducedMotion: 'reduce' }, null);

/* la premiere bascule doit venir vite */
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  const t0 = Date.now(); const a = await lire(p);
  let quand = null;
  for (let k = 0; k < 60; k++) {
    await p.waitForTimeout(120);
    if ((await lire(p)) !== a) { quand = Date.now() - t0; break; }
  }
  console.log(`${'delai avant la premiere bascule'.padEnd(46)} ${quand ? quand + ' ms' : 'jamais'}`);
  await p.close();
}
await b.close();
