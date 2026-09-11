/* ---------------------------------------------------------------------------
   AUCUNE IMAGE N'EST AFFICHEE AU-DELA DE SA TAILLE REELLE.

   C'est la regle absolue du site, et pendant tout ce temps ce controle ne la
   verifiait pas. Il comparait la largeur affichee a `naturalWidth`.

   `naturalWidth` N'EST PAS LA TAILLE DU FICHIER quand l'image vient d'un
   srcset. La specification HTML corrige les dimensions intrinseques par la
   « densite courante » de la variante choisie — densite = largeur du fichier
   divisee par la largeur annoncee dans `sizes`. Mesure faite sur la fiche des
   haricots, telephone de 390px, densite d'ecran 3 :

       fichier reellement servi   447 x 337   (verifie octet par octet)
       naturalWidth / Height      358 x 270
       largeur affichee           313 css

   447 / 358,8 = 1,246 ; 447 / 1,246 = 358. Le navigateur rendait donc le
   fichier a la largeur de `sizes`, et le rapport affiche/naturalWidth valait
   0,87 — « aucune image agrandie », repondait le controle. Il ne mesurait pas
   l'agrandissement : il mesurait l'honnetete de l'attribut `sizes`, qui vaut
   forcement 1 quand `sizes` est juste. Un controle qui ne peut pas echouer.

   La vraie taille se lit en decodant le fichier soi-meme : createImageBitmap
   sur le contenu de currentSrc rend les pixels, sans correction de densite.

   Et puisqu'on y est, on mesure les DEUX chiffres qui comptent, parce qu'ils
   ne disent pas la meme chose :

     l'agrandissement en CSS — affiche / fichier. C'est lui que borne la regle
     du site a 1,4x : au-dela, l'etirement se voit sur n'importe quel ecran.

     le manque en pixels d'ecran — affiche x densite / fichier. C'est lui que
     le client voit comme « pas de bonne qualite » sur son telephone. Il ne se
     corrige pas en CSS : il se corrige avec un fichier plus grand, ou il
     s'atenue par l'affutage (voir outils/poser-photos.mjs).
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';

const routes = ['/', '/about/', '/contact/', '/training/',
  '/export/red-kidney-beans/', '/export/niger-seed-noug/', '/export/soya-bean/',
  '/export/sesame-seed/', '/import/ceramics/', '/import/building-glass/',
  '/import/electric-vehicles/', '/import/calcium-hypochlorite/',
  '/import/stationery-materials/', '/import/medical-equipment/',
  '/import/human-medicine/', '/import/solar-lanterns/',
  '/import/plastic-raw-materials/', '/import/elevator-and-escalator/'];

/* La borne du site. Elle est ecrite dans tokens.css pour la bande pleine
   largeur ; elle vaut pour toutes les images. */
const BORNE = 1.4;

const mesurer = async (p, densite) => p.evaluate(async () => {
  for (const i of document.querySelectorAll('img')) i.loading = 'eager';
  await Promise.all([...document.querySelectorAll('img')]
    .map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  const out = [];
  for (const i of document.querySelectorAll('img')) {
    const r = i.getBoundingClientRect();
    if (!r.width) continue;
    let vrai = 0;
    try {
      const bmp = await createImageBitmap(await (await fetch(i.currentSrc)).blob());
      vrai = bmp.width; bmp.close?.();
    } catch { vrai = i.naturalWidth; }
    out.push({
      src: i.currentSrc.split('/').pop(),
      vrai,
      affiche: Math.round(r.width),
      cadre: i.closest('.pleine') ? 'bande' : i.closest('.plaque') ? 'plaque' : 'colonne',
    });
  }
  return out;
});

const b = await chromium.launch();
let pireCss = 0; let pireEcran = 0;
const fautes = [];
const manques = [];

/* Trois ecrans, parce qu'ils ne racontent pas la meme histoire :

     1440 densite 1 — l'ecran de bureau ordinaire. C'est la que l'etirement CSS
                      se mesure, et c'est lui que borne la regle des 1,4x.
     1440 densite 2 — le portable d'aujourd'hui, et le cas qu'on ne mesurait
                      jamais. Un MacBook, un Windows a 150 % : la bande pleine
                      largeur y demande 2880 pixels d'ecran a un fichier qui en
                      a 1080.
      390 densite 3 — le telephone du client. */
const ECRANS = [
  ['ordinateur 1440px, densite 1', { width: 1440, height: 900 }, 1],
  ['portable   1440px, densite 2', { width: 1440, height: 900 }, 2],
  ['iPhone      390px, densite 3', { width: 390, height: 844 }, 3],
];

for (const [nom, vue, densite] of ECRANS) {
  const ctx = await b.newContext({ viewport: vue, deviceScaleFactor: densite });
  const p = await ctx.newPage();
  console.log('');
  console.log('================ ' + nom + ' ================');
  for (const r of routes) {
    await p.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
    const rows = await mesurer(p, densite);
    if (!rows.length) continue;
    console.log('\n' + r);
    for (const x of rows) {
      const css = x.affiche / x.vrai;
      const ecran = (x.affiche * densite) / x.vrai;
      if (css > pireCss) pireCss = css;
      if (ecran > pireEcran) pireEcran = ecran;
      if (css > BORNE) fautes.push(`${r} ${x.src} ${css.toFixed(2)}x`);
      if (ecran > 1.6) manques.push({ r, src: x.src, ecran, cadre: x.cadre, ecrit: nom });
      const drapeau = css > BORNE ? '  !! AU-DELA DE 1,4x' : '';
      console.log(`  ${x.src.slice(0, 44).padEnd(46)} ${x.cadre.padEnd(8)}`
        + ` fichier ${String(x.vrai).padStart(5)}px -> affiche ${String(x.affiche).padStart(4)}css`
        + `   css ${css.toFixed(2)}x   ecran ${ecran.toFixed(2)}x${drapeau}`);
    }
  }
  await ctx.close();
}
await b.close();

console.log(`\n${'='.repeat(72)}`);
console.log(`agrandissement CSS maximal      : ${pireCss.toFixed(2)}x   (borne du site : ${BORNE}x)`);
console.log(`manque en pixels d ecran maxi   : ${pireEcran.toFixed(2)}x`);

if (manques.length) {
  /* Ce n'est pas une faute : c'est la liste des fichiers trop petits, celle
     qu'on envoie au client. On la trie par gravite et on ne garde qu'une
     ligne par fichier. */
  const vus = new Map();
  for (const m of manques) if (!vus.has(m.src) || vus.get(m.src).ecran < m.ecran) vus.set(m.src, m);
  console.log(`\n${vus.size} fichiers sous la definition que l ecran demande (au-dela de 1,6x) :`);
  for (const m of [...vus.values()].sort((a, c) => c.ecran - a.ecran)) {
    console.log(`  ${m.ecran.toFixed(2)}x  ${m.src.slice(0, 50).padEnd(52)} ${m.cadre.padEnd(8)} ${m.ecrit}`);
  }
  console.log('  — se corrige avec des fichiers plus grands, pas en CSS. Attenue par l affutage.');
}

if (fautes.length) {
  console.error(`\nARRET : ${fautes.length} image(s) etirees au-dela de ${BORNE}x en CSS :`);
  for (const f of fautes) console.error('  ' + f);
  process.exit(1);
}
console.log('\naucune image etiree au-dela de la borne du site.');
