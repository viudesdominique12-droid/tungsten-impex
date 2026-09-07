/* ---------------------------------------------------------------------------
   Assemble les 20 pages générées en UN seul fichier HTML autonome, à partager.

       node src/build.mjs && node src/bundle.mjs

   Il ne régénère rien : il lit les .html déjà produits, en extrait le <main>
   et la famille de couleurs, incorpore la CSS, le JS et toutes les images en
   data:URI, et ajoute un routeur par ancre. Ce que voit le destinataire est
   donc exactement le site réel, pas une maquette à part.

   Sortie : apercu-partageable.html
   --------------------------------------------------------------------------- */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------- les routes - */

const files = ['index.html', 'about.html', 'imports.html', 'exports.html', 'training.html', 'contact.html'];
for (const dir of ['imports', 'exports']) {
  for (const f of (await readdir(join(ROOT, dir))).sort()) files.push(`${dir}/${f}`);
}

const routeOf = (file) =>
  file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');

/* --------------------------------------------------------- images en data - */

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const dataCache = new Map();

async function asData(rel) {
  if (dataCache.has(rel)) return dataCache.get(rel);
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  const buf = await readFile(join(ROOT, rel));
  const uri = `data:${MIME[ext] || 'application/octet-stream'};base64,${buf.toString('base64')}`;
  dataCache.set(rel, uri);
  return uri;
}

/* Résout un chemin relatif écrit dans une page vers un chemin projet. */
const resolveFrom = (file, url) => posix.normalize(posix.join(posix.dirname(file), url)).replace(/^\.\//, '');

/* --------------------------------------------------------- réécriture ----- */

async function rewrite(html, file) {
  // images -> data:URI
  const imgs = [...html.matchAll(/(src|href)="((?:\.\.\/)*assets\/img\/[^"]+)"/g)];
  for (const m of imgs) {
    const rel = resolveFrom(file, m[2]);
    html = html.split(m[0]).join(`${m[1]}="${await asData(rel)}"`);
  }

  // liens internes -> ancres de route
  html = html.replace(/href="((?:\.\.\/)*[a-z0-9/-]+\.html)"/g, (_, u) => {
    const rel = resolveFrom(file, u);
    return `href="#${routeOf(rel)}"`;
  });

  // les apparitions au défilement n'ont pas de sens dans des routes masquées
  html = html.replace(/ data-in="\d+"/g, '');
  return html;
}

/* ------------------------------------------------------------- extraction - */

const pick = (s, re) => (s.match(re) || [])[1] || '';

const pages = [];
for (const file of files) {
  const raw = await readFile(join(ROOT, file), 'utf8');
  pages.push({
    file,
    route: routeOf(file),
    title: pick(raw, /<title>([^<]*)<\/title>/),
    vars: pick(raw, /<style>:root\{([^}]*)\}<\/style>/),
    main: await rewrite(pick(raw, /<main id="main">([\s\S]*?)<\/main>/), file),
  });
}

/* En-tête, menu et pied de page sont identiques partout : on les prend une fois. */
const first = await readFile(join(ROOT, 'index.html'), 'utf8');
const chrome = {
  header: await rewrite(pick(first, /(<header class="hdr">[\s\S]*?<\/header>)/), 'index.html'),
  nav: await rewrite(pick(first, /(<div class="nav" id="nav"[\s\S]*?)\n<main/), 'index.html'),
  footer: await rewrite(pick(first, /(<footer class="ftr">[\s\S]*?<\/footer>)/), 'index.html'),
};

const css = await readFile(join(ROOT, 'assets/css/site.css'), 'utf8');
const js = await readFile(join(ROOT, 'assets/js/site.js'), 'utf8');

/* La carte OpenStreetMap est un <iframe> : bloqué hors du site. On le remplace
   par un lien franc plutôt que de laisser un cadre vide. */
const contact = pages.find((p) => p.route === '/contact');
if (contact) {
  contact.main = contact.main.replace(
    /<iframe class="map"[\s\S]*?<\/iframe>/,
    `<a class="map map--flat" href="https://www.google.com/maps/search/?api=1&amp;query=Dembel%20City%20Center%2C%20Africa%20Avenue%2C%20Addis%20Ababa%2C%20Ethiopia" rel="noopener">
             <b>Dembel City Center</b>
             <span>Africa Avenue, 4th Floor FF-002<br>Addis Ababa, Ethiopia</span>
             <em>Open in Google Maps &rarr;</em>
           </a>`
  );
}

/* ------------------------------------------------------------- assemblage - */

const out = `<title>Tungsten Import Export</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Public+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${css}

/* --- propres au fichier unique --- */
.route { display: none; }
.route.is-on { display: block; }
.map--flat {
  display: flex; flex-direction: column; gap: 8px; justify-content: center;
  padding: 30px; text-decoration: none; height: 360px;
  background: var(--surface); border: 1px solid var(--line);
}
.map--flat b { font-family: var(--display); font-weight: 500; font-size: 1.3rem; }
.map--flat span { color: var(--muted); font-size: var(--t-sm); }
.map--flat em { font-style: normal; margin-top: 6px; font-family: var(--mono);
                font-size: var(--t-xs); letter-spacing: .12em; text-transform: uppercase;
                color: var(--accent-on-bg); }
.map--flat:hover { border-color: var(--ink); }
.shared-note {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 150;
  background: var(--ink); color: var(--bg);
  padding: 10px 18px; font: 400 var(--t-xs)/1 var(--mono);
  letter-spacing: .13em; text-transform: uppercase;
}
.shared-note button {
  background: none; border: 0; color: inherit; opacity: .6; cursor: pointer;
  font: inherit; padding: 0 0 0 12px;
}
.shared-note button:hover { opacity: 1; }
</style>

<a class="skip" href="#main">Skip to content</a>
${chrome.header}
${chrome.nav}
<main id="main">
${pages.map((p) => `<div class="route" data-route="${p.route}" data-title="${p.title.replace(/"/g, '&quot;')}" style="${p.vars}">
${p.main}
</div>`).join('\n')}
</main>
${chrome.footer}

<div class="shared-note" id="note">Aperçu partageable — les 20 pages<button type="button" aria-label="Masquer">&times;</button></div>

<script>
/* ------------------------------------------------- routeur par ancre ----- */
(function () {
  var routes = [].slice.call(document.querySelectorAll('.route'));
  var byRoute = {};
  routes.forEach(function (r) { byRoute[r.dataset.route] = r; });

  function show(route) {
    var el = byRoute[route] || byRoute['/'];
    routes.forEach(function (r) { r.classList.toggle('is-on', r === el); });

    // la famille de couleurs de la page devient celle du document entier,
    // pour que le fond, l'en-tête et le menu suivent
    document.documentElement.style.cssText = el.getAttribute('style') || '';
    document.title = el.dataset.title || 'Tungsten Import Export';

    // surligne l'entrée courante du menu
    var here = '#' + (byRoute[route] ? route : '/');
    [].forEach.call(document.querySelectorAll('#nav a[href]'), function (a) {
      if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    window.scrollTo(0, 0);
  }

  function fromHash() {
    var h = location.hash.replace(/^#/, '');
    return h.indexOf('/') === 0 ? h : '/';
  }

  window.addEventListener('hashchange', function () {
    show(fromHash());
    var nav = document.getElementById('nav');
    if (nav && nav.getAttribute('data-open') === 'true') {
      document.getElementById('nav-close').click();
    }
  });

  show(fromHash());
})();

/* --------------------------------------- comportement du site (inchangé) - */
${js}

/* ------------------------------------------------------------- bandeau --- */
(function () {
  var n = document.getElementById('note');
  if (!n) return;
  n.querySelector('button').addEventListener('click', function () { n.remove(); });
  setTimeout(function () { if (n.parentNode) n.remove(); }, 9000);
})();
</script>`;

const dest = join(ROOT, 'apercu-partageable.html');
await writeFile(dest, out, 'utf8');
console.log(`apercu-partageable.html — ${pages.length} pages, ${(Buffer.byteLength(out) / 1048576).toFixed(2)} Mo`);
console.log(`images incorporees : ${dataCache.size}`);
