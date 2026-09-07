/* ---------------------------------------------------------------------------
   Générateur du site Tungsten Import Export.

       node src/build.mjs

   Lit src/catalog.mjs (identité, couleurs, photos) + src/copy.json (les textes)
   et écrit les 20 pages. Ne jamais modifier les .html à la main.

   L'identité de maison vit dans :root de la feuille de style — elle ne varie
   jamais. Seule la MARQUE de la marchandise change, posée en style inline sur
   les éléments qui la portent. Voir l'en-tête de assets/css/site.css.
   --------------------------------------------------------------------------- */

import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOUSE, textOn } from './color.mjs';
import { company, founderLetter, imports, exports_, training } from './catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let COPY = {};
try {
  COPY = JSON.parse(await readFile(join(ROOT, 'src/copy.json'), 'utf8'));
} catch {
  console.warn('!! src/copy.json absent — les fiches produits sortiront vides.');
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const all = [...imports, ...exports_];
const copyOf = (slug) => COPY[slug] || { lead: '', facts: [], blocks: [], cta: '' };
const photoOf = (p) => `assets/img/products/${p.slug}.jpg`;

/* La marque d'une marchandise : l'aplat, plus la couleur de texte qui s'y lit. */
const markStyle = (p) => `--mark:${p.accent};--mark-text:${textOn(p.accent)}`;

const metaDesc = (s, max = 158) => {
  s = String(s || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return cut.slice(0, sp > 80 ? sp : max).replace(/[,;:—-]\s*$/, '') + '…';
};

/* --------------------------------------------------------------- icônes --- */

const SW = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const SOCIAL = {
  whatsapp: `<circle cx="12" cy="12" r="9.1"/><path d="M9 8.3c.3-.5.9-.6 1.3-.2l1 1c.3.3.3.8.1 1.1l-.4.6c-.2.3-.1.6.1.9.5.7 1.2 1.4 1.9 1.9.3.2.6.3.9.1l.6-.4c.3-.2.8-.2 1.1.1l1 1c.4.4.3 1-.2 1.3-1.6 1-3.5.3-5.2-1.3S8 9.9 9 8.3z"/>`,
  linkedin: `<rect x="3" y="3" width="18" height="18"/><path d="M7.3 10.6v6"/><circle cx="7.3" cy="7.7" r=".95"/><path d="M11.2 16.6v-6M11.2 13.4a2.2 2.2 0 0 1 4.4 0v3.2"/>`,
  facebook: `<rect x="3" y="3" width="18" height="18"/><path d="M14.9 8.1h-1.2c-.9 0-1.5.6-1.5 1.5v1.6h2.6l-.4 2.6h-2.2V21"/><path d="M9.7 11.2h2.5"/>`,
  telegram: `<path d="M21.4 4.3 2.9 11.6l5.8 2.1 2.2 5.8 2.9-4.4 4.6 3.3z"/><path d="M8.7 13.7 21.4 4.3"/>`,
  instagram: `<rect x="3" y="3" width="18" height="18"/><circle cx="12" cy="12" r="3.9"/><circle cx="17" cy="7" r=".95"/>`,
};
const social = (id) => `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true">${SOCIAL[id] || SOCIAL.linkedin}</svg>`;
const liveSocials = () => company.socials.filter((s) => s.url);

/* -------------------------------------------------------------- gabarit --- */

const head = ({ title, desc, base, image, themeColor }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${image ? `<meta property="og:image" content="${base}${image}">\n` : ''}<meta name="theme-color" content="${themeColor || HOUSE.ground}">
<link rel="icon" href="${base}assets/img/company/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/css/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>`;

const brandMark = (base) => `<a class="brand" href="${base}index.html">
      <img src="${base}assets/img/company/logo.jpg" alt="" width="28" height="28">
      <span class="brand__t"><b>Tungsten</b><span>Import Export</span></span>
    </a>`;

const header = (base) => `
<header class="hdr">
  <div class="shell hdr__in">
    ${brandMark(base)}
    <div class="hdr__r">
      <a class="hdr__tel" href="tel:${company.phoneHref}">${company.phone}</a>
      <button class="burger" id="nav-open" type="button" aria-expanded="false" aria-controls="nav">
        <i aria-hidden="true"></i> Menu
      </button>
    </div>
  </div>
</header>`;

const popup = (base, here) => {
  const cur = (h) => (h === here ? ' aria-current="page"' : '');
  const group = (label, index, items, folder) => `
        <div class="nav__grp">
          <a href="${base}${index}"${cur(index)}><b>${label}</b><span class="lab">${items.length} items</span></a>
          <ul>
${items.map((it) => {
  const href = `${folder}/${it.slug}.html`;
  return `            <li><a class="sub" href="${base}${href}"${cur(href)} style="${markStyle(it)}"><span class="mark" aria-hidden="true"></span>${esc(it.name)}</a></li>`;
}).join('\n')}
          </ul>
        </div>`;

  const main = [['index.html', 'Home'], ['about.html', 'About us'],
                ['training.html', 'Book to train with us'], ['contact.html', 'Contact us']];

  return `
<div class="nav" id="nav" data-open="false" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="shell nav__bar">
    ${brandMark(base)}
    <button class="nav__x" id="nav-close" type="button" aria-label="Close menu">&times;</button>
  </div>
  <div class="nav__body">
    <div class="shell">
      <div class="nav__grid">
        <nav class="nav__main" aria-label="Main">
${main.map(([h, l]) => `          <a href="${base}${h}"${cur(h)}>${l}</a>`).join('\n')}
        </nav>
        <div class="nav__cols">
${group('Imports', 'imports.html', imports, 'imports')}
${group('Exports', 'exports.html', exports_, 'exports')}
        </div>
      </div>
      <div class="nav__foot">
        <a href="tel:${company.phoneHref}">${company.phone}</a>
        <a href="mailto:${company.email}">${company.email}</a>
        <span>${esc(company.address.line1)}, ${esc(company.address.city)}</span>
      </div>
    </div>
  </div>
</div>`;
};

const footer = (base) => {
  const soc = liveSocials();
  return `
<footer class="ftr">
  <div class="shell">
    <div class="ftr__grid">
      <div>
        <span class="ftr__id"><img src="${base}assets/img/company/logo.jpg" alt="" width="30" height="30"><b>Tungsten Import Export</b></span>
        <p>Bridging local potential with global markets from Addis Ababa since ${company.founded}.</p>
${soc.length ? `        <div class="ftr__soc">
${soc.map((s) => `          <a href="${s.url}" aria-label="${esc(s.label)}" rel="noopener">${social(s.id)}</a>`).join('\n')}
        </div>` : ''}
      </div>
      <div>
        <h4>We import</h4>
        <ul>${imports.map((i) => `<li><a href="${base}imports/${i.slug}.html">${esc(i.name)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>We export</h4>
        <ul>${exports_.map((i) => `<li><a href="${base}exports/${i.slug}.html">${esc(i.name)}</a></li>`).join('')}</ul>
        <h4 style="margin-top:22px">Company</h4>
        <ul>
          <li><a href="${base}about.html">About us</a></li>
          <li><a href="${base}training.html">Training</a></li>
          <li><a href="${base}contact.html">Contact us</a></li>
        </ul>
      </div>
    </div>
    <div class="ftr__end">
      <span>&copy; ${new Date().getFullYear()} ${esc(company.name)}</span>
      <span>${esc(company.address.line1)}, ${esc(company.address.line2)}, ${esc(company.address.city)}</span>
    </div>
  </div>
</footer>
<script src="${base}assets/js/site.js"></script>
</body>
</html>`;
};

const page = (o, body) => head(o) + header(o.base) + popup(o.base, o.here) +
  `\n<main id="main">` + body + `\n</main>` + footer(o.base);

/* ------------------------------------------------------------ fragments --- */

const manifestRow = (p, folder, base, level = 3) => `
        <a class="man" href="${base}${folder}/${p.slug}.html" style="${markStyle(p)}">
          <span class="mark" aria-hidden="true"></span>
          <span class="man__b">
            <h${level}>${esc(p.name)}</h${level}>
            <p>${esc(copyOf(p.slug).lead)}</p>
          </span>
          <img class="man__ph" src="${base}${photoOf(p)}" alt="" width="118" height="76" loading="lazy">
        </a>`;

const enquire = (base, line) => `
  <section class="sec sec--rule">
    <div class="shell">
      <div class="doc" style="margin-bottom:26px">
        <span class="lab">Enquiries</span>
        <h2 style="font-size:var(--t-2);font-weight:400">${esc(line || 'Tell us what you need and we will come back to you.')}</h2>
      </div>
      <div class="fields">
        <div class="row"><span class="lab">Telephone</span><span class="val"><a href="tel:${company.phoneHref}">${company.phone}</a></span></div>
        <div class="row"><span class="lab">Email</span><span class="val"><a href="mailto:${company.email}">${company.email}</a></span></div>
        <div class="row"><span class="lab">Office</span><span class="val">${esc(company.address.line1)}, ${esc(company.address.line2)}, ${esc(company.address.city)}</span></div>
      </div>
    </div>
  </section>`;

/* ---------------------------------------------------------------- pages --- */

function home() {
  const o = {
    title: 'Tungsten Import Export — Addis Ababa, Ethiopia',
    desc: 'Ethiopian import and export house in Addis Ababa. Medicines, medical equipment, electric vehicles, glass, elevators and ceramics in — Ethiopian sesame, noug, kidney beans and soya out.',
    base: '', here: 'index.html', image: 'assets/img/company/pharma-warehouse.jpg', themeColor: '#9fcbe8',
  };

  const body = `
  <section class="hero">
    <div class="shell hero__in">
      <div class="hero__meta">
        <span>Tungsten Import Export</span>
        <span>Addis Ababa, Ethiopia</span>
        <span>Established ${company.founded} &middot; EFDA licensed</span>
      </div>
      <h1>Ethiopian oilseeds and pulses out. Medicines, vehicles and materials in.</h1>
      <p class="hero__sub">We have traded out of Addis Ababa since ${company.founded}, under a founder with thirty years in Ethiopian oilseeds and pulses.</p>
      <div class="hero__act">
        <a class="act act--ink" href="imports.html">What we import</a>
        <a class="act act--onGround" href="exports.html">What we export</a>
      </div>
    </div>
  </section>

  <img class="shot" src="assets/img/company/pharma-warehouse.jpg" width="1080" height="810"
       alt="Palletised medicine cartons in the Tungsten store in Addis Ababa">

  <section class="sec">
    <div class="shell">
      <div class="doc" style="margin-bottom:26px">
        <span class="lab">Inbound</span>
        <h2 style="font-size:var(--t-2);font-weight:400">${imports.length} lines brought into Ethiopia, cleared and delivered by us.</h2>
      </div>
      <div class="manifest">
${imports.map((p) => manifestRow(p, 'imports', '')).join('\n')}
      </div>
    </div>
  </section>

  <section class="sec sec--rule">
    <div class="shell">
      <div class="doc" style="margin-bottom:26px">
        <span class="lab">Outbound</span>
        <h2 style="font-size:var(--t-2);font-weight:400">Ethiopian oilseeds and pulses, sourced and shipped.</h2>
      </div>
      <div class="manifest">
${exports_.map((p) => manifestRow(p, 'exports', '')).join('\n')}
      </div>
    </div>
  </section>

  <section class="sec sec--rule">
    <div class="shell">
      <div class="letter">
        <img src="assets/img/company/founder.jpg" alt="At the Tungsten Import Export office in Addis Ababa" loading="lazy">
        <div class="letter__b">
          <span class="lab" style="margin-bottom:14px">From the founder</span>
          <p>${esc(founderLetter.paragraphs[0])}</p>
          <p style="margin-top:20px"><a class="act act--line" href="about.html">Read the full letter</a></p>
        </div>
      </div>
    </div>
  </section>

  <section class="sec sec--rule">
    <div class="shell">
      <div class="doc">
        <span class="lab">Training</span>
        <div>
          <h2 style="font-size:var(--t-2);font-weight:400;max-width:24ch">We run practical import and export training in Addis Ababa.</h2>
          <p style="margin-top:12px;color:var(--muted);max-width:52ch">Leave your details and roughly when you would like to begin. We will contact you as soon as a place opens.</p>
          <p style="margin-top:20px"><a class="act act--signal" href="training.html">Book to train with us</a></p>
        </div>
      </div>
    </div>
  </section>`;

  return page(o, body);
}

function indexPage({ items, folder, file, title, desc, h1, lead }) {
  const o = { title, desc, base: '', here: file };
  const body = `
  <section class="top">
    <div class="shell">
      <span class="lab" style="margin-bottom:12px">${items.length} product lines</span>
      <h1>${h1}</h1>
      <p>${lead}</p>
    </div>
  </section>
  <section class="sec" style="padding-top:0">
    <div class="shell">
      <div class="manifest">
${items.map((p) => manifestRow(p, folder, '', 2)).join('\n')}
      </div>
    </div>
  </section>
${enquire('')}`;
  return page(o, body);
}

function productPage(p, folder, siblings) {
  const base = '../';
  const c = copyOf(p.slug);
  const backHref = folder === 'imports' ? 'imports.html' : 'exports.html';
  const backLabel = folder === 'imports' ? 'Imports' : 'Exports';
  const direction = folder === 'imports' ? 'Inbound' : 'Outbound';

  const i = siblings.findIndex((s) => s.slug === p.slug);
  const prev = siblings[(i - 1 + siblings.length) % siblings.length];
  const next = siblings[(i + 1) % siblings.length];

  const o = {
    title: `${p.name} — ${company.name}`,
    desc: metaDesc(c.lead || p.name),
    base, here: `${folder}/${p.slug}.html`, image: photoOf(p), themeColor: p.accent,
  };

  const spec = c.facts && c.facts.length ? `
      <table class="spec">
        <caption>Specification</caption>
        <tbody>
${c.facts.map((f) => `          <tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}</td></tr>`).join('\n')}
        </tbody>
      </table>` : '';

  const prose = (c.blocks || []).map((b) => `        <section>
          <h2>${esc(b.title)}</h2>
          <p>${esc(b.body)}</p>
        </section>`).join('\n');

  /* Un bloc plein à la couleur de la marchandise. Le texte s'adapte : c'est ce
     qui permet de garder la teinte à pleine force au lieu de la diluer. */
  const hero = `
  <section class="phero" style="${markStyle(p)}">
    <div class="shell phero__in">
      <nav class="phero__meta" aria-label="Breadcrumb">
        <a href="${base}index.html">Tungsten</a>
        <a href="${base}${backHref}">${backLabel}</a>
        <span>${direction}</span>
      </nav>
      <h1>${esc(p.name)}</h1>
      <p class="phero__lead">${esc(c.lead)}</p>
${spec}
    </div>
  </section>`;

  /* Photographie assez grande → bande pleine largeur, à sa vraie valeur.
     Trop petite → panneau encadré à sa taille réelle, à côté du texte. */
  const middle = p.hero ? `
  <img class="shot" src="${base}${photoOf(p)}" alt="${esc(p.name)}" loading="lazy">

  <section class="sec">
    <div class="shell">
      <div class="prose">
${prose}
      </div>
    </div>
  </section>` : `
  <section class="sec">
    <div class="shell">
      <div class="plate">
        <figure>
          <img src="${base}${photoOf(p)}" alt="${esc(p.name)}" loading="lazy">
          <figcaption>${esc(p.name)}</figcaption>
        </figure>
        <div class="prose" style="grid-template-columns:1fr">
${prose}
        </div>
      </div>
    </div>
  </section>`;

  const onward = `
  <section class="sec sec--rule">
    <div class="shell">
      <span class="lab" style="margin-bottom:14px">More ${backLabel.toLowerCase()}</span>
      <div class="onward">
        <a href="${base}${folder}/${prev.slug}.html" style="${markStyle(prev)}"><span class="mark" aria-hidden="true"></span><span><span class="lab">Previous</span><b>${esc(prev.name)}</b></span></a>
        <a href="${base}${folder}/${next.slug}.html" style="${markStyle(next)}"><span class="mark" aria-hidden="true"></span><span><span class="lab">Next</span><b>${esc(next.name)}</b></span></a>
        <a href="${base}${backHref}"><span class="mark" aria-hidden="true"></span><span><span class="lab">All</span><b>${backLabel}</b></span></a>
      </div>
    </div>
  </section>`;

  return page(o, hero + middle + enquire(base, c.cta) + onward);
}

function about() {
  const o = {
    title: `About us — ${company.name}`,
    desc: 'Founded in 2007 in Addis Ababa to bridge local potential with global markets. Words from the founder, our mission, and how we work.',
    base: '', here: 'about.html', image: 'assets/img/company/founder.jpg',
  };
  const sign = founderLetter.name
    ? `<b>${esc(founderLetter.name)}</b>${esc(founderLetter.role)}`
    : `<b>${esc(founderLetter.role)}</b>${esc(company.name)}`;

  const body = `
  <section class="top">
    <div class="shell">
      <span class="lab" style="margin-bottom:12px">About us</span>
      <h1>Naturally strong. Built to endure.</h1>
      <p>Tungsten Import Export was founded in ${company.founded} in Addis Ababa, on the belief that trust is the real currency of trade.</p>
    </div>
  </section>

  <section class="sec" style="padding-top:clamp(18px,3vw,30px)">
    <div class="shell">
      <div class="letter">
        <img src="assets/img/company/founder.jpg" alt="At the Tungsten Import Export office in Addis Ababa">
        <div class="letter__b">
          <span class="lab" style="margin-bottom:14px">From the founder</span>
${founderLetter.paragraphs.map((t, n) => `          <p${n ? ' style="margin-top:18px"' : ''}>${esc(t)}</p>`).join('\n')}
          <p class="letter__sign">${sign}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="sec sec--rule">
    <div class="shell">
      <div class="doc" style="margin-bottom:24px">
        <span class="lab">Mission</span>
        <h2 style="font-size:var(--t-2);font-weight:400;max-width:26ch">To be a globally recognised import&ndash;export company that puts quality, service and worth first.</h2>
      </div>
      <div class="fields">
        <div class="row"><span class="lab">One big family</span><span class="val">We work like one big family towards a common goal — customer satisfaction. Effort here gets recognised.</span></div>
        <div class="row"><span class="lab">Hard work</span><span class="val">Our staff are creative and hands-on, and we hold ourselves to ethical conduct in every transaction.</span></div>
        <div class="row"><span class="lab">Quality first</span><span class="val">We source only what we would put our own name on. We do, on every consignment.</span></div>
        <div class="row"><span class="lab">Personal service</span><span class="val">You deal with people who know your file. No call centres, no being passed between departments.</span></div>
      </div>
    </div>
  </section>

  <section class="sec sec--rule">
    <div class="shell">
      <div class="doc" style="margin-bottom:24px">
        <span class="lab">Premises</span>
        <h2 style="font-size:var(--t-2);font-weight:400">Offices, a licensed pharmaceutical store and a quarantine area, on the 4th floor of Dembel City Center.</h2>
      </div>
      <div class="tiles">
        <img src="assets/img/company/office-floor.jpg" alt="The Tungsten Import Export office floor" loading="lazy">
        <img src="assets/img/company/pharma-warehouse.jpg" alt="Palletised pharmaceutical stock in the Tungsten store" loading="lazy">
        <img src="assets/img/company/quarantine.jpg" alt="The quarantine area of the pharmaceutical store" loading="lazy">
        <img src="assets/img/company/team-desk.jpg" alt="A member of the Tungsten team at work" loading="lazy">
        <img src="assets/img/company/records.jpg" alt="Trade and compliance records kept at the office" loading="lazy">
        <img src="assets/img/company/efda-office.jpg" alt="The EFDA licence displayed in the office" loading="lazy">
      </div>
    </div>
  </section>
${enquire('')}`;
  return page(o, body);
}

function trainingPage() {
  const o = {
    title: `Book to train with us — ${company.name}`,
    desc: 'Practical import and export training in Addis Ababa. Leave your contact details and when you would like to begin; we will contact you when a place opens.',
    base: '', here: 'training.html',
  };

  const body = `
  <section class="top">
    <div class="shell">
      <span class="lab" style="margin-bottom:12px">Training</span>
      <h1>Book to train with us</h1>
      <p>${esc(training.intro)}</p>
    </div>
  </section>

  <section class="sec" style="padding-top:clamp(16px,3vw,28px)">
    <div class="shell narrow">
      <form class="form" id="enrol" data-email="${company.email}" novalidate>

        <div class="row">
          <span class="lab" id="tl">Programme</span>
          <div class="picks" role="radiogroup" aria-labelledby="tl">
${training.tracks.map((t, n) => `            <label class="pick">
              <input type="radio" name="track" value="${esc(t.name)}"${n === 0 ? ' checked' : ''}>
              <span><b>${esc(t.name)}</b><small>${esc(t.body)}</small></span>
            </label>`).join('\n')}
          </div>
        </div>

        <div class="row">
          <span class="lab">Who you are</span>
          <div>
            <div class="pair">
              <div class="f">
                <label for="n">Full name <span class="req" aria-hidden="true">*</span></label>
                <input id="n" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="f">
                <label for="e">Email <span class="req" aria-hidden="true">*</span></label>
                <input id="e" name="email" type="email" autocomplete="email" required>
              </div>
            </div>
            <div class="pair" style="margin-top:14px">
              <div class="f">
                <label for="t">Phone <span class="req" aria-hidden="true">*</span></label>
                <input id="t" name="phone" type="tel" autocomplete="tel" placeholder="+251 …" required>
              </div>
              <div class="f">
                <label for="l">City and country</label>
                <input id="l" name="location" type="text" autocomplete="address-level2" placeholder="Addis Ababa, Ethiopia">
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <span class="lab">Timing</span>
          <div class="pair">
            <div class="f">
              <label for="s">Preferred start</label>
              <input id="s" name="start" type="month">
              <small>Leave blank if you can start whenever a place opens.</small>
            </div>
            <div class="f">
              <label for="x">Experience so far</label>
              <select id="x" name="experience">
                <option value="">Prefer not to say</option>
                <option>Complete beginner</option>
                <option>Some exposure to trade</option>
                <option>Already trading</option>
              </select>
            </div>
          </div>
        </div>

        <div class="row">
          <span class="lab">Anything else</span>
          <div class="f">
            <label for="m">Message</label>
            <textarea id="m" name="message" placeholder="Optional — what you hope to get out of the training."></textarea>
          </div>
        </div>

        <div class="row">
          <span class="lab">Send</span>
          <div>
            <button class="act act--signal" type="submit">Send my enquiry</button>
            <p class="note">${esc(training.note)}</p>
            <p class="status" id="enrol-status" role="status" aria-live="polite"></p>
          </div>
        </div>
      </form>
    </div>
  </section>
${enquire('', 'Rather talk to someone? Call during office hours.')}`;
  return page(o, body);
}

function contact() {
  const o = {
    title: `Contact us — ${company.name}`,
    desc: `Tungsten Import Export, ${company.address.line1}, ${company.address.line2}, ${company.address.city}. Phone ${company.phone}, email ${company.email}.`,
    base: '', here: 'contact.html',
  };
  const soc = liveSocials();
  const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(company.mapQuery);
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${company.mapBbox}&layer=mapnik&marker=${company.mapMarker}`;

  const body = `
  <section class="top">
    <div class="shell">
      <span class="lab" style="margin-bottom:12px">Contact us</span>
      <h1>Come and find us.</h1>
      <p>We are on the 4th floor of Dembel City Center on Africa Avenue, in the centre of Addis Ababa.</p>
    </div>
  </section>

  <section class="sec" style="padding-top:clamp(16px,3vw,28px)">
    <div class="shell">
      <div class="contact">
        <div>
          <div class="fields">
            <div class="row"><span class="lab">Position</span><span class="val">${esc(company.address.line1)}<br>${esc(company.address.line2)}<br>${esc(company.address.city)}, ${esc(company.address.country)}<br><a href="${maps}" rel="noopener">Open in Google Maps</a></span></div>
            <div class="row"><span class="lab">Telephone</span><span class="val"><a href="tel:${company.phoneHref}">${company.phone}</a></span></div>
            <div class="row"><span class="lab">Email</span><span class="val"><a href="mailto:${company.email}">${company.email}</a></span></div>
${soc.length ? `            <div class="row"><span class="lab">Socials</span><span class="val"><span class="socials">
${soc.map((s) => `              <a href="${s.url}" rel="noopener">${social(s.id)} ${esc(s.label)}</a>`).join('\n')}
            </span></span></div>` : ''}
            <div class="row"><span class="lab">Training</span><span class="val"><a href="training.html">Book a place on the next intake</a></span></div>
          </div>
        </div>
        <div>
          <iframe class="map" src="${osm}" title="Map showing Dembel City Center, Africa Avenue, Addis Ababa" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    </div>
  </section>`;
  return page(o, body);
}

/* ------------------------------------------------------------------ run --- */

const written = [];
async function put(rel, html) {
  const dest = join(ROOT, rel);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, html, 'utf8');
  written.push(rel);
}

await rm(join(ROOT, 'imports'), { recursive: true, force: true });
await rm(join(ROOT, 'exports'), { recursive: true, force: true });

await put('index.html', home());
await put('about.html', about());
await put('training.html', trainingPage());
await put('contact.html', contact());

await put('imports.html', indexPage({
  items: imports, folder: 'imports', file: 'imports.html',
  title: `What we import — ${company.name}`,
  desc: 'Medicines, medical equipment, electric vehicles, building glass, elevators, calcium hypochlorite, plastic raw materials, solar lanterns, stationery and ceramics, imported into Ethiopia.',
  h1: 'What we import',
  lead: 'Everything below is brought into Ethiopia by us, cleared by us and delivered by us.',
}));

await put('exports.html', indexPage({
  items: exports_, folder: 'exports', file: 'exports.html',
  title: `What we export — ${company.name}`,
  desc: 'Ethiopian niger seed (noug), sesame seed, red kidney beans and soya bean, exported worldwide by Tungsten Import Export.',
  h1: 'What we export',
  lead: 'Ethiopian oilseeds and pulses, sourced and shipped with three decades of experience behind them.',
}));

for (const p of imports) await put(`imports/${p.slug}.html`, productPage(p, 'imports', imports));
for (const p of exports_) await put(`exports/${p.slug}.html`, productPage(p, 'exports', exports_));

const missing = all.filter((p) => !COPY[p.slug]).map((p) => p.slug);
console.log(`${written.length} pages écrites.`);
if (missing.length) console.warn(`!! textes manquants : ${missing.join(', ')}`);
