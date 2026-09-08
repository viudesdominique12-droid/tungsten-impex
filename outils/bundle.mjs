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

/* ---- 2. la feuille de style, fonte comprise ------------------------------ */
const premier = readFileSync(join(DIST, pages[0].fichier), 'utf8');
let css = '';
for (const m of premier.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)) {
  css += readFileSync(join(DIST, m[1]), 'utf8') + '\n';
}
css = css.replace(/url\((["']?)([^)"']*archivo-var\.woff2)\1\)/g,
  (_, __, u) => `url(${dataURI(u.replace(/^\//, ''), 'font/woff2')})`);

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

  /* La carte OpenStreetMap est un cadre distant : la politique de securite
     d'une page publiee le bloque. On le remplace par ce qu'il servait a dire,
     plutot que de laisser un cadre vide. */
  corps = corps.replace(/<iframe\b[^>]*class="map"[^>]*><\/iframe>/g,
    '<p class="t-note t-quiet" style="padding:24px 0">Carte interactive : ' +
    'active sur le site livré, désactivée dans cette maquette partagée.</p>');

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
    minuteries.forEach(clearInterval); minuteries = [];
    document.title = p.titre;
    document.body.removeAttribute('data-flow');
    const f = /data-flow="([^"]+)"/.exec(p.attrs);
    if (f) document.body.setAttribute('data-flow', f[1]);
    app.innerHTML = p.corps;

    // Les scripts insérés par innerHTML ne s'exécutent pas : on les recrée,
    // et on retient leurs minuteries pour les arrêter à la navigation suivante.
    const vraiInterval = window.setInterval;
    window.setInterval = (...a) => { const id = vraiInterval(...a); minuteries.push(id); return id; };
    for (const vieux of [...app.querySelectorAll('script')]) {
      const s = document.createElement('script');
      // Enferme dans une portee de fonction : les scripts d'Astro declarent
      // leurs donnees en const au premier niveau, et les rejouer tels quels a
      // chaque navigation redeclarait le meme identifiant global.
      const NL = String.fromCharCode(10);
      s.textContent = '(function(){' + NL + vieux.textContent + NL + '})();';
      vieux.replaceWith(s);
    }
    window.setInterval = vraiInterval;

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

writeFileSync('verif/maquette.html', sortie);
const ko = Math.round(Buffer.byteLength(sortie) / 1024);
console.log(`${posees} pages, ${images} images posees, ${cache.size} fichiers encodes`);
console.log(`maquette : ${(ko / 1024).toFixed(2)} Mo  (plafond 16 Mo)`);
console.log('routes :', Object.keys(routes).sort().join(' '));
