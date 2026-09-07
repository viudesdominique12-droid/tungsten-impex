/* ---------------------------------------------------------------------------
   Vérification du §9 du brief HDM. Obligatoire avant de rendre une page.

       node verif/check.mjs [url]        (defaut http://localhost:4321/)

   Rend la page pour de vrai et contrôle :
     1. Archivo et Newsreader chargées — pas un repli Helvetica/Times,
        et l'axe wdth s'applique (les deux mots du corridor ont des largeurs
        visiblement différentes).
     2. Aucun débordement horizontal.
     3. La bascule Out/In fonctionne et le fond change réellement de valeur.
     4. Rendu à 375 px avec une VRAIE émulation d'appareil.

   Pourquoi Playwright et pas `chrome --headless --screenshot` : sans émulation,
   Chrome met en page à une largeur bien plus grande puis recadre l'image. Le
   rendu paraît cassé alors qu'il ne l'est pas — ça m'est arrivé, et j'ai failli
   corriger un bug inexistant.
   --------------------------------------------------------------------------- */

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TARGET = process.argv[2] || 'http://localhost:4321/';
const OUT = fileURLToPath(new URL('.', import.meta.url));

const ok = (b) => (b ? 'ok  ' : 'ECHEC');
let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`  ${ok(pass)} ${label}${detail ? ' — ' + detail : ''}`);
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

/* ---------------------------------------------------------------- bureau -- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  console.log('\nBUREAU 1440x900');

  const fonts = await page.evaluate(() => ({
    archivo: document.fonts.check('700 100px Archivo'),
    newsreader: document.fonts.check('400 20px Newsreader'),
    titre: getComputedStyle(document.getElementById('btn-out')).fontFamily.split(',')[0].replace(/["']/g, ''),
    corps: getComputedStyle(document.querySelector('.lead')).fontFamily.split(',')[0].replace(/["']/g, ''),
  }));
  check('Archivo chargée', fonts.archivo);
  check('Newsreader chargée', fonts.newsreader);
  check('titres en Archivo', fonts.titre === 'Archivo', fonts.titre);
  check('texte en Newsreader', fonts.corps === 'Newsreader', fonts.corps);

  const w = await page.evaluate(() => {
    const o = document.getElementById('btn-out').getBoundingClientRect().width;
    const i = document.getElementById('btn-in').getBoundingClientRect().width;
    return { o: Math.round(o), i: Math.round(i), ratio: +(o / i).toFixed(2) };
  });
  check("l'axe wdth s'applique", w.ratio > 1.6, `Out ${w.o}px vs In ${w.i}px, ratio ${w.ratio}`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('aucun débordement horizontal', over === 0, `${over}px`);

  await page.screenshot({ path: `${OUT}/pw-desktop-out.png`, fullPage: false });

  // la bascule change-t-elle vraiment la valeur du fond ?
  const bgOut = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#btn-in');
  await page.waitForTimeout(1200);
  const bgIn = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const pressed = await page.evaluate(() => ({
    out: document.getElementById('btn-out').getAttribute('aria-pressed'),
    in: document.getElementById('btn-in').getAttribute('aria-pressed'),
  }));
  check('la bascule change le fond', bgOut !== bgIn, `${bgOut} -> ${bgIn}`);
  check('aria-pressed suit', pressed.out === 'false' && pressed.in === 'true');

  await page.screenshot({ path: `${OUT}/pw-desktop-in.png`, fullPage: false });
  await ctx.close();
}

/* ---------------------------------------------------------------- mobile -- */
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  console.log('\nMOBILE (iPhone 12, émulation réelle)');
  const m = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    inVisible: document.getElementById('btn-in').getBoundingClientRect().right <= document.documentElement.clientWidth,
    leadLines: (() => {
      const l = [...document.querySelectorAll('.lead')].find((e) => getComputedStyle(e).display !== 'none');
      return Math.round(l.getBoundingClientRect().height / parseFloat(getComputedStyle(l).lineHeight));
    })(),
  }));
  check('largeur de rendu', m.vw <= 400, `${m.vw}px`);
  check('aucun débordement horizontal', m.over === 0, `${m.over}px`);
  check('le mot In reste dans le cadre', m.inVisible);
  check("l'accroche se répartit sur plusieurs lignes", m.leadLines >= 2, `${m.leadLines} lignes`);

  await page.screenshot({ path: `${OUT}/pw-mobile-out.png`, fullPage: false });
  await page.click('#btn-in');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/pw-mobile-in.png`, fullPage: false });
  await ctx.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'TOUT PASSE' : failures + ' ECHEC(S)'} — captures dans verif/\n`);
process.exit(failures === 0 ? 0 : 1);
