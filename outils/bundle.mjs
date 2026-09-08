/* ---------------------------------------------------------------------------
   Compilation du site en un seul fichier autonome, pour un lien partageable.

   Le site construit fait dix-huit pages, une feuille de style externe, une
   fonte de 90 Ko et soixante-dix-huit variantes d'images. Un lien hébergé doit
   tenir dans un document unique : on garde donc UNE variante par image — la
   plus large réellement demandée — on encode tout en data URI, et un routeur
   de vingt lignes rejoue la navigation interne.

   Ce n'est pas le site livré, c'est sa maquette navigable. Le site livré reste
   le contenu de dist/, avec ses srcset, son cache et ses fichiers séparés.
   --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const cache = new Map();

const dataURI = (chemin, mime) => {
  if (cache.has(chemin)) return cache.get(chemin);
  const b64 = readFileSync(join(DIST, chemin)).toString('base64');
  const uri = `data:${mime};base64,${b64}`;
  cache.set(chemin, uri);
  return uri;
};

/* ---- 1. les pages -------------------------------------------------------- */
const pages = [];
(function marcher(dir, base = '') {
  for (const e of readdirSync(join(DIST, dir), { withFileTypes: true })) {
    if (e.isDirectory()) marcher(join(dir, e.name), `${base}/${e.name}`);
    else if (e.name === 'index.html') pages.push({ route: `${base}/` || '/', fichier: join(dir, e.name) });
  }
})('');

/* ---- 2. les feuilles de style, fonte comprise ----------------------------
   TOUTES les pages, pas la premiere trouvee. Astro emet une feuille par
   ensemble de composants : depuis que l'accueil a ses propres sections, il
   reference une seconde feuille que lui seul porte. Le compilateur lisait
   `pages[0]`, qui se trouvait etre /about/, et la maquette est donc partie
   sans un seul style de section — le tableau de departs s'y affichait a plat,
   en deux blocs de texte superposes, tandis que le site, lui, etait juste. */
const feuilles = new Set();
for (const { fichier } of pages) {
  const h = readFileSync(join(DIST, fichier), 'utf8');
  for (const m of h.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)) {
    feuilles.add(m[1]);
  }
}
let css = '';
for (const f of feuilles) css += readFileSync(join(DIST, f), 'utf8') + '\n';
console.log(`${feuilles.size} feuille(s) de style inlinees`);
/* Toutes les fontes, et non une seule nommee en dur. Cette ligne ne
   connaissait qu'archivo-var.woff2 ; la refonte en charge quatre — Fraunces
   droit et italique, Instrument Sans, Plex Mono — et la maquette serait partie
   sans une seule, c'est-a-dire en Georgia et en Helvetica. Or toute la
   hierarchie de cette refonte repose sur ces trois familles : le client aurait
   ouvert le lien sur le defaut qu'on venait justement de corriger.

   Le compilateur prend donc ce que la feuille demande, quoi qu'elle demande. */
const fontes = new Set();
css = css.replace(/url\((["']?)([^)"']*[.]woff2)\1\)/g, (_, __, u) => {
  fontes.add(u);
  return `url(${dataURI(u.replace(/^\//, ''), 'font/woff2')})`;
});
console.log(`${fontes.size} fonte(s) inlinees : ` +
            [...fontes].map((f) => f.split('/').pop()).join(', '));

/* ---- 3. une page -> {titre, attributs du body, balisage} ----------------- */
let posees = 0, images = 0;
const routes = {};

for (const { route, fichier } of pages) {
  let h = readFileSync(join(DIST, fichier), 'utf8');

  const titre = (h.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1];
  const attrs = (h.match(/<body([^>]*)>/) || [, ''])[1];
  let corps = (h.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ''])[1];

  // les styles propres a la page (Astro en met en ligne certains)
  for (const m of h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += m[1] + '\n';
  corps = corps.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');

  /* Les <source> du <picture> pointent vers des fichiers separes : la maquette
     n'en a pas. On les retire et on garde le <img> de secours, qu'on encode. */
  corps = corps.replace(/<source[ ][^>]*>/g, '');

  /* Une seule variante par image : la plus large demandee. Le srcset et le
     sizes disparaissent avec elle. */
  corps = corps.replace(/<img\b[^>]*>/g, (tag) => {
    const ss = (tag.match(/srcset="([^"]+)"/) || [])[1];
    let choisi = (tag.match(/\bsrc="([^"]+)"/) || [])[1];
    if (ss) {
      let max = 0;
      for (const part of ss.split(',')) {
        const [u, w] = part.trim().split(/\s+/);
        const n = parseInt(w) || 0;
        if (n >= max) { max = n; choisi = u; }
      }
    }
    if (!choisi) return tag;
    images++;
    const uri = dataURI(choisi.replace(/^\//, ''), 'image/webp');
    return tag
      .replace(/\ssrcset="[^"]*"/, '')
      .replace(/\ssizes="[^"]*"/, '')
      .replace(/\bsrc="[^"]*"/, `src="${uri}"`)
      .replace(/\sloading="lazy"/, '');
  });

  /* La carte OpenStreetMap est un cadre distant, et la politique de securite
     d'une page publiee le bloque. Sur le site, ce cadre n'existe pas tant
     qu'on n'a pas clique : c'est un script qui l'insere. Il suffit donc de lui
     retirer sa prise — sans id="map", le script s'arrete a sa premiere ligne et
     le bouton redevient ce qu'il est sans JavaScript : un lien vers la carte en
     ligne. La maquette montre alors exactement l'etat que le site montre avant
     le clic, au lieu d'un cadre vide.

     L'ancienne regle visait <iframe class="map">, un balisage qui n'existe plus
     dans le document servi depuis que la carte est differee : elle ne
     remplacait donc plus rien. */
  corps = corps.replace(/(<div class="map")\s+id="map"/g, '$1');

  routes[route] = { titre, attrs, corps };
  posees++;
}

/* ---- 4. le document unique ---------------------------------------------- */
const json = JSON.stringify(routes).replace(/<\/script/gi, '<\\/script');

const sortie = `<title>Tungsten Import Export</title>
<style>
${css}
</style>
<div id="app"></div>
<script id="routes" type="application/json">${json}</script>
<script>
(() => {
  const R = JSON.parse(document.getElementById('routes').textContent);
  const app = document.getElementById('app');
  let minuteries = [];

  const poser = (route, ancre) => {
    const p = R[route] || R['/'];
    minuteries.forEach((id) => { clearInterval(id); clearTimeout(id); }); minuteries = [];
    document.title = p.titre;
    // Les attributs du corps sont recopies tels quels, quels qu'ils soient.
    // La version precedente ne connaissait que data-flow, un attribut que la
    // refonte a retire : coder un nom en dur, c'est se preparer a le perdre.
    for (const a of [...document.body.attributes])
      if (a.name !== 'class') document.body.removeAttribute(a.name);
    for (const m of p.attrs.matchAll(/([a-zA-Z-]+)="([^"]*)"/g))
      document.body.setAttribute(m[1], m[2]);
    app.innerHTML = p.corps;

    // Les scripts insérés par innerHTML ne s'exécutent pas : on les recrée,
    // et on retient leurs minuteries pour les arrêter à la navigation suivante.
    const vraiInterval = window.setInterval, vraiTimeout = window.setTimeout;
    window.setInterval = (...a) => { const id = vraiInterval(...a); minuteries.push(id); return id; };
    window.setTimeout = (...a) => { const id = vraiTimeout(...a); minuteries.push(id); return id; };
    for (const vieux of [...app.querySelectorAll('script')]) {
      const s = document.createElement('script');
      // Enferme dans une portee de fonction : les scripts d'Astro declarent
      // leurs donnees en const au premier niveau, et les rejouer tels quels a
      // chaque navigation redeclarait le meme identifiant global.
      const NL = String.fromCharCode(10);
      s.textContent = '(function(){' + NL + vieux.textContent + NL + '})();';
      vieux.replaceWith(s);
    }
    window.setInterval = vraiInterval; window.setTimeout = vraiTimeout;

    const cible = ancre && document.getElementById(ancre);
    if (cible) cible.scrollIntoView();
    else scrollTo(0, 0);
  };

  addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/')) return;          // tel:, mailto:, https:
    e.preventDefault();
    const [chemin, ancre] = href.split('#');
    poser(chemin || '/', ancre);
  });

  poser('/');
})();
</script>
`;

/* Garde-fou. La derniere fois, un echappement perdu avait laisse les <source>
   du <picture> en place : ils pointaient vers des fichiers absents, le
   navigateur les preferait au <img>, et la maquette est partie sans une seule
   image. Le compilateur verifie donc son propre resultat. */
const feuillesOubliees = (sortie.match(/rel=.stylesheet/g) || []).length;
const restants = (sortie.match(/<source/g) || []).length;
const nonEncodees = (sortie.match(/<img[^>]*src=\\"\/_astro/g) || []).length;
/* Toute reference a un fichier que la maquette n'emporte pas. Une fonte
   oubliee ne casse rien de VISIBLE au compilateur — la page s'affiche, en
   Georgia — et c'est exactement le genre de defaut qui part chez le client
   sans que personne le voie partir. Deux fois deja. */
const fontesPerdues = (sortie.match(/url\([^)]*[.]woff2/g) || []).length;
const nbFontFace = (sortie.match(/@font-face/g) || []).length;
const carteVive = (sortie.match(/id="map"/g) || []).length;
if (restants || nonEncodees || feuillesOubliees || fontesPerdues
    || nbFontFace < 4 || carteVive) {
  console.error(`ARRET : ${restants} <source> restants, ${nonEncodees} images non encodees, ` +
                `${feuillesOubliees} feuille(s) de style en lien externe, ` +
                `${fontesPerdues} fonte(s) non encodee(s), ${nbFontFace} @font-face (4 attendues), ` +
                `${carteVive} carte(s) encore branchee(s).`);
  process.exit(1);
}

writeFileSync('verif/maquette.html', sortie);
const ko = Math.round(Buffer.byteLength(sortie) / 1024);
console.log(`${posees} pages, ${images} images posees, ${cache.size} fichiers encodes`);
console.log(`maquette : ${(ko / 1024).toFixed(2)} Mo  (plafond 16 Mo)`);
console.log('routes :', Object.keys(routes).sort().join(' '));
