import { webkit, chromium, devices } from 'playwright';

const pagesTest = ['/', '/about/', '/contact/', '/training/',
                   '/import/electric-vehicles/', '/export/niger-seed-noug/'];

/* ---------- 1. WebKit : le moteur de Safari, donc de l'iPhone ------------ */
const w = await webkit.launch();
for (const [opts, nom] of [[{ viewport: { width: 1440, height: 900 } }, 'Safari bureau'],
                           [{ ...devices['iPhone 12'] }, 'Safari iPhone']]) {
  const ctx = await w.newContext(opts);
  const soucis = [];
  for (const u of pagesTest) {
    const p = await ctx.newPage();
    const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 90)));
    await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready;
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))); });
    const m = await p.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      police: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/["']/g, ''),
      imgKO: [...document.querySelectorAll('img')].filter((i) => !i.complete || i.naturalWidth === 0).length,
      nbImg: document.querySelectorAll('img').length,
      chasse: getComputedStyle(document.querySelector('.t-label') || document.body).fontStretch,
    }));
    if (m.over) soucis.push(`${u} debordement ${m.over}px`);
    if (m.police !== 'Archivo') soucis.push(`${u} police ${m.police}`);
    if (m.imgKO) soucis.push(`${u} ${m.imgKO}/${m.nbImg} images non chargees`);
    if (err.length) soucis.push(`${u} erreur : ${err[0]}`);
    await p.close();
  }
  console.log(`${nom.padEnd(16)} ${soucis.length ? soucis.join(' | ') : 'aucun souci sur ' + pagesTest.length + ' pages'}`);
  await ctx.close();
}

/* ---------- 2. le tableau de departs sous Safari ------------------------- */
{
  const p = await (await w.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const a = await p.evaluate(() => document.getElementById('board-card')?.getAttribute('href'));
  await p.waitForTimeout(5000);
  const c = await p.evaluate(() => document.getElementById('board-card')?.getAttribute('href'));
  console.log(`tableau Safari   ${a !== c ? 'tourne' : 'FIGE'}  ${a} -> ${c}`);
  await p.close();
}
await w.close();

/* ---------- 3. le clavier : menu, piege de focus, echappement ----------- */
const b = await chromium.launch();
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const nom = () => p.evaluate(() => {
    const e = document.activeElement;
    return e ? e.tagName.toLowerCase() + '.' + (String(e.className).split(' ')[0] || '') +
               ' "' + (e.textContent || '').trim().slice(0, 18) + '"' : 'aucun';
  });
  const parcours = [];
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); parcours.push(await nom()); }
  console.log('\nquatre premiers arrets au clavier :');
  parcours.forEach((x, i) => console.log(`  ${i + 1}. ${x}`));

  await p.click('#nav-open');
  await p.waitForTimeout(400);
  const dansMenu = await p.evaluate(() => document.getElementById('nav').contains(document.activeElement));
  // le piege de focus doit ramener dans le menu apres le dernier element
  for (let i = 0; i < 30; i++) await p.keyboard.press('Tab');
  const encoreDedans = await p.evaluate(() => document.getElementById('nav').contains(document.activeElement));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const ferme = await p.evaluate(() => document.getElementById('nav').dataset.open === 'false');
  const rendu = await p.evaluate(() => document.activeElement.id === 'nav-open');
  console.log(`menu au clavier : focus entre ${dansMenu ? 'oui' : 'NON'} | piege apres 30 Tab ${encoreDedans ? 'oui' : 'NON'} | Echap ferme ${ferme ? 'oui' : 'NON'} | focus rendu ${rendu ? 'oui' : 'NON'}`);
  await p.close();
}

/* ---------- 4. le formulaire ------------------------------------------- */
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:4321/training/', { waitUntil: 'networkidle' });
  const vide = await p.evaluate(() => { document.getElementById('enrol').requestSubmit();
    return document.getElementById('enrol').checkValidity(); });
  await p.fill('#n', 'Test'); await p.fill('#e', 'test@example.com'); await p.fill('#p', '+251900000000');
  const rempli = await p.evaluate(() => document.getElementById('enrol').checkValidity());
  let mailto = null;
  p.on('framenavigated', (f) => { if (f.url().startsWith('mailto:')) mailto = f.url().slice(0, 60); });
  await p.evaluate(() => document.getElementById('enrol').requestSubmit());
  await p.waitForTimeout(600);
  const message = await p.evaluate(() => document.getElementById('status')?.textContent?.slice(0, 60));
  console.log(`\nformulaire : vide -> valide ${vide ? 'OUI (probleme)' : 'non'} | rempli -> valide ${rempli ? 'oui' : 'NON'}`);
  console.log(`             message apres envoi : "${message || 'aucun'}"`);
  await p.close();
}
await b.close();
