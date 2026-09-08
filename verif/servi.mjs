/* ---------------------------------------------------------------------------
   Verifie le document REELLEMENT SERVI a une adresse publiee, pas le fichier
   local qui a servi a le publier.

   Pourquoi ce fichier existe. Le tableau de departs est parti casse deux fois
   de suite chez le client alors que tous les controles passaient au vert. La
   premiere fois, le compilateur n'avait inline qu'une feuille de style sur
   deux. La seconde, le fichier local etait juste, mais l'adresse partagee
   servait une version epinglee plus ancienne — la cassee. Dans les deux cas,
   ce que je mesurais n'etait pas ce que le client ouvrait.

   Le seul controle qui ferme ce trou est celui-ci : relire l'artifact depuis
   le serveur, et mesurer sur ce que le serveur a rendu.

   Usage : node verif/servi.mjs <fichier-relu-depuis-le-serveur>
   --------------------------------------------------------------------------- */

import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';

const fichier = process.argv[2];
if (!fichier) {
  console.error('usage : node verif/servi.mjs <fichier relu depuis le serveur>');
  process.exit(2);
}

const html = readFileSync(fichier, 'utf8');
const navigateur = await chromium.launch();
const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(1500);

/* La forme, pas seulement le comportement. Un tableau a plat tourne aussi :
   c'est exactement ce qui avait laisse passer la version cassee. */
const m = await page.evaluate(() => {
  const carte = document.getElementById('board-card');
  if (!carte) return { absent: true };
  const r = carte.getBoundingClientRect();
  const faces = [...document.querySelectorAll('.board__face')];
  return {
    hauteur: Math.round(r.height),
    forme: getComputedStyle(carte).transformStyle,
    perspective: getComputedStyle(carte.parentElement).perspective,
    faces: faces.map((f) => `${getComputedStyle(f).position}/${getComputedStyle(f).backfaceVisibility}`),
    sections: document.querySelectorAll('main > *').length,
    images: `${[...document.images].filter((i) => i.naturalWidth > 0).length}/${document.images.length}`,
    fonte: document.fonts.check('16px Archivo'),
    debordement: Math.max(0, document.documentElement.scrollWidth - 1440),
    lienExterne: document.querySelectorAll('link[rel=stylesheet]').length,
    sourceRestante: document.querySelectorAll('picture source').length,
  };
});

const avant = await page.evaluate(() => document.querySelector('.board__face .board__n')?.textContent);
await page.waitForTimeout(1800);
const apres = await page.evaluate(() => document.querySelector('.board__face .board__n')?.textContent);

/* Ce que le client fait vraiment : il tape un produit. Le routeur de la
   maquette rejoue les scripts a la main ; s'il se trompe, la page suivante
   arrive vide ou sans styles, et rien dans les mesures ci-dessus ne le dit. */
await page.click('#board-card');
await page.waitForTimeout(600);
const suite = await page.evaluate(() => ({
  titre: document.querySelector('h1')?.textContent?.trim() ?? '',
  flow: document.body.getAttribute('data-flow'),
  fond: getComputedStyle(document.body).backgroundColor,
  blocs: document.querySelectorAll('main :is(section, dl, .carte, .onward)').length,
  hauteur: Math.round(document.getElementById('main').getBoundingClientRect().height),
  fonte: document.fonts.check('16px Archivo'),
}));

/* Et il le fait depuis un telephone. */
const tel = await (await navigateur.newContext({ ...devices['iPhone 12'] })).newPage();
await tel.setContent(html, { waitUntil: 'load' });
await tel.waitForTimeout(900);
const mobile = await tel.evaluate(() => {
  const petits = [...document.querySelectorAll('a, button')]
    .filter((e) => e.offsetParent !== null)
    .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44; }).length;
  return {
    debordement: Math.max(0, document.documentElement.scrollWidth - 390),
    petits,
    tableau: Math.round(document.getElementById('board-card')?.getBoundingClientRect().height ?? 0),
  };
});

await navigateur.close();

const griefs = [];
if (!suite.titre) griefs.push('la navigation vers une fiche produit ne rend rien');
if (suite.blocs < 3) griefs.push(`la fiche produit n'a que ${suite.blocs} bloc(s) de contenu`);
if (suite.hauteur < 1500) griefs.push(`la fiche produit ne fait que ${suite.hauteur}px de haut`);
if (!suite.fonte) griefs.push('la fonte ne survit pas a la navigation');
if (mobile.debordement) griefs.push(`${mobile.debordement}px de debordement sur iPhone`);
if (mobile.petits) griefs.push(`${mobile.petits} cible(s) tactile(s) sous 44px`);
if (mobile.tableau < 120) griefs.push(`le tableau est a plat sur iPhone : ${mobile.tableau}px`);
if (m.absent) griefs.push('le tableau est absent du document servi');
else {
  if (m.hauteur < 200) griefs.push(`le tableau est a plat : ${m.hauteur}px`);
  if (m.forme !== 'preserve-3d') griefs.push(`transform-style vaut ${m.forme}`);
  if (m.perspective === 'none') griefs.push('aucune perspective');
  if (!m.faces.every((f) => f === 'absolute/hidden')) griefs.push(`faces : ${m.faces.join(', ')}`);
  if (m.sections < 9) griefs.push(`${m.sections} sections au lieu de neuf`);
  if (!m.fonte) griefs.push('la fonte Archivo ne charge pas');
  if (m.debordement) griefs.push(`${m.debordement}px de debordement`);
  if (m.lienExterne) griefs.push(`${m.lienExterne} feuille(s) de style restee(s) en lien externe`);
  if (m.sourceRestante) griefs.push(`${m.sourceRestante} <source> non retire(s)`);
  if (avant === apres) griefs.push(`le tableau ne tourne pas (fige sur "${avant}")`);
}
if (erreurs.length) griefs.push(`erreurs : ${erreurs.join(' | ')}`);

console.log(`document servi : ${Math.round(Buffer.byteLength(html) / 1024)} Ko`);
if (!m.absent) {
  console.log(`  tableau   : ${m.hauteur}px, ${m.forme}, perspective ${m.perspective}`);
  console.log(`  faces     : ${m.faces.join('  ')}`);
  console.log(`  tourne    : ${avant} -> ${apres}`);
  console.log(`  page      : ${m.sections} sections, images ${m.images}, fonte ${m.fonte ? 'chargee' : 'ABSENTE'}, debordement ${m.debordement}`);
}
console.log(`  fiche     : "${suite.titre}"  flow=${suite.flow}  fond ${suite.fond}  ${suite.blocs} blocs  ${suite.hauteur}px  fonte ${suite.fonte ? 'ok' : 'PERDUE'}`);
console.log(`  iPhone    : tableau ${mobile.tableau}px, debordement ${mobile.debordement}, cibles sous 44px : ${mobile.petits}`);
console.log(griefs.length ? `\nCASSE :\n  . ${griefs.join('\n  . ')}` : '\nle document servi est juste.');
process.exit(griefs.length ? 1 : 0);
