/* ---------------------------------------------------------------------------
   §11 du brief HDM — vérification obligatoire avant de rendre.

       node verif/check.mjs [url]        (défaut http://localhost:4321/)

   Contrôle, sur le rendu et non dans le code :
     · les trois familles sont chargées, aucun repli système
     · un titre n'est pas le texte courant agrandi : ce n'est pas la même police
     · le répertoire de sections tient — deux voisines ne se ressemblent jamais,
       une section nuit revient au moins toutes les trois sections
     · aucun titre au-delà de --step-4 : les crans géants ne servent pas de
       remplissage
     · aucune image n'est affichée au-delà de sa taille réelle
     · aucune ombre portée, aucun filet coloré
     · contraste AA sur les sols clairs comme sur les sols nuit

   Playwright et pas `chrome --headless --screenshot` : sans émulation
   d'appareil, Chrome met en page à une largeur bien plus grande puis recadre.
   Le rendu paraît cassé alors qu'il ne l'est pas.
   --------------------------------------------------------------------------- */

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TARGET = process.argv[2] || 'http://localhost:4321/';
const OUT = fileURLToPath(new URL('.', import.meta.url));

let bad = 0;
const check = (label, pass, detail = '') => {
  if (!pass) bad++;
  console.log(`  ${pass ? 'ok  ' : 'ECHEC'} ${label}${detail ? ' — ' + detail : ''}`);
};

/* Contraste WCAG, composites alpha compris (les couleurs rendues sont rgb()). */
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/* rgba() doit être composité sur son fond AVANT de mesurer : sinon l'alpha est
   ignoré et un gris à 62 % est noté comme de l'encre pleine — faux positif. */
const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const flat = (fg, bg) => {
  const a = fg.length > 3 ? fg[3] : 1;
  const f = fg.slice(0, 3), b = bg.slice(0, 3);
  return f.map((c, i) => c * a + b[i] * (1 - a));
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

/* ------------------------------------------------------- page d'accueil -- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });

  console.log('\nACCUEIL 1440x900');

  /* TROIS FAMILLES, ET LE TITRE N'EST PAS LE CORPS AGRANDI.

     C'etait tout le probleme de la version precedente : une seule police, donc
     rien pour distinguer un titre d'un paragraphe sinon la taille — d'ou les
     titres demesures que le client a vus comme du remplissage. Une serif pour
     les titres, une grotesque pour le texte, une mono pour les micro-libelles :
     la hierarchie tient sans qu'aucun cran ait a grossir. */
  const t = await page.evaluate(() => {
    const prem = (el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '');
    const titre = document.querySelector('h1');
    const label = document.querySelector('.t-label');
    return {
      fraunces: document.fonts.check('520 60px Fraunces'),
      instrument: document.fonts.check('400 17px "Instrument Sans"'),
      mono: document.fonts.check('400 11px "Plex Mono"'),
      bodyFamily: prem(document.body),
      titreFamily: prem(titre),
      labelFamily: prem(label),
    };
  });
  check('Fraunces chargée', t.fraunces);
  check('Instrument Sans chargée', t.instrument);
  check('Plex Mono chargée', t.mono);
  check('aucun repli système', t.bodyFamily === 'Instrument Sans', t.bodyFamily);
  check('le titre n est pas le corps agrandi', t.titreFamily !== t.bodyFamily,
        `${t.titreFamily} vs ${t.bodyFamily}`);
  check('le micro-libelle est en mono', t.labelFamily === 'Plex Mono', t.labelFamily);

  /* §10 — aucune ombre portée nulle part. */
  const shadows = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((e) => { const s = getComputedStyle(e).boxShadow; return s && s !== 'none'; })
      .map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 24)).slice(0, 5));
  check('aucune ombre portée', shadows.length === 0, shadows.join(', '));

  /* Aucun filet colore, nulle part. Un trait d'accent sous un en-tete ou
     au-dessus d'une section est le tic de gabarit le plus reconnaissable ;
     la couleur ne travaille qu'en aplat plein. On releve donc toutes les
     bordures et tous les traits de soulignement peints a l'ecran. */
  const filets = await page.evaluate(() => {
    const bleu = (v) => {
      const n = (v.match(/[\d.]+/g) || []).map(Number);
      if (n.length > 3 && n[3] === 0) return false;
      return n.length >= 3 && n[2] - n[0] > 60;
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.getBoundingClientRect().right < 0) continue;
      const s = getComputedStyle(el);
      const cotes = [['borderTopColor', s.borderTopWidth],
                     ['borderBottomColor', s.borderBottomWidth],
                     ['borderLeftColor', s.borderLeftWidth],
                     ['borderRightColor', s.borderRightWidth]];
      const peints = cotes.filter(([, w]) => parseFloat(w) > 0);
      if (peints.length <= 2)
        for (const [k] of peints)
          if (bleu(s[k])) out.push(el.tagName + '.' + (el.className || '') + ' ' + k);
      if (s.textDecorationLine !== 'none' && bleu(s.textDecorationColor)
          && s.textDecorationColor !== s.color)
        out.push(el.tagName + '.' + (el.className || '') + ' underline');
    }
    return [...new Set(out)].slice(0, 6);
  });
  check('aucun filet colore', filets.length === 0, filets.join(' | '));

  /* §3 — trois couleurs à l'écran. On relève les teintes réellement peintes. */
  const palette = await page.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      for (const v of [s.color, s.backgroundColor]) {
        if (!v || v.includes('rgba(0, 0, 0, 0)')) continue;
        seen.set(v, (seen.get(v) || 0) + 1);
      }
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  });
  // Les composites alpha de --muted et --rule derivent de l'encre : on compte
  // les familles, pas chaque nuance.
  const families = new Set(palette.map(([v]) => {
    const [r, g, b] = parse(v);
    if (r > 200 && g > 200 && b > 190) return 'paper';
    // le bleu d'accent : bleu franc ou bleu clair, b nettement au-dessus de r
    if (b - r > 60) return 'bleu';
    return 'ink';
  }));
  check('trois familles de couleur au plus', families.size <= 3,
        [...families].join(' / '));

  /* §5 — étalonnage unique sur toutes les images. */
  const media = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    return {
      total: imgs.length,
      filters: [...new Set(imgs.map((i) => getComputedStyle(i).filter))],
      radii: [...new Set(imgs.map((i) => getComputedStyle(i).borderRadius))],
      // Les images en colonne portent la goutte ; les bandes pleine largeur,
      // qui touchent les deux bords, n'en portent pas. Ce sont deux regles, et
      // il faut les mesurer separement.
      colonne: [...new Set([...document.querySelectorAll('.media img')]
                  .map((i) => getComputedStyle(i).borderRadius))],
      bandes: [...new Set([...document.querySelectorAll('.pleine img')]
                  .map((i) => getComputedStyle(i).borderRadius))],
      // Ni agrandissement, ni dimension manquante dans le HTML.
      agrandies: imgs.filter((i) => i.naturalWidth
                    && i.getBoundingClientRect().width > i.naturalWidth + 1)
                  .map((i) => (i.currentSrc || i.src).split('/').pop()),
      sansDim: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height'))
                  .map((i) => (i.currentSrc || i.src).split('/').pop()),
    };
  });
  check('étalonnage unique sur les images', media.filters.length <= 1,
        `${media.total} image(s), ${media.filters.length} filtre(s)`);
  /* Le rayon en goutte : trois coins ronds, un coin vif. Les bandes photo
     pleine largeur n'en prennent pas — elles touchent les deux bords. */
  const goutte = media.colonne.every((r) => new Set(r.split(' ')).size > 1);
  check('le rayon en goutte sur les images en colonne', goutte,
        media.colonne.length ? media.colonne.join(' | ') : 'aucune image en colonne ici');
  check('aucun rayon sur les bandes pleine largeur',
        media.bandes.every((r) => parseFloat(r) === 0),
        media.bandes.join(' | ') || 'aucune bande ici');
  check('aucune image agrandie', media.agrandies.length === 0, media.agrandies.join(' '));
  check('dimensions dans le HTML', media.sansDim.length === 0, media.sansDim.join(' '));

  /* Contraste AA sur le fond clair. */
  const con = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const q = document.querySelector('.t-quiet');
    return { bg: b.backgroundColor, fg: b.color, muted: q ? getComputedStyle(q).color : b.color };
  });
  check('AA encre / fond clair', ratio(flat(parse(con.fg), parse(con.bg)), parse(con.bg)) >= 4.5,
        ratio(flat(parse(con.fg), parse(con.bg)), parse(con.bg)).toFixed(2));
  const mLight = ratio(flat(parse(con.muted), parse(con.bg)), parse(con.bg));
  check('AA muted / fond clair', mLight >= 4.5, mLight.toFixed(2));

  /* Le tableau de departs. Trois proprietes, relevees sur une meme fenetre :
     il tourne ; il tourne meme sous un curseur immobile — la premiere version
     le figeait au survol et il avait l'air casse, alors qu'il occupe le centre
     du premier ecran ; et les deux fonds apparaissent. Ce dernier point ne se
     mesure pas a un instant : le manifeste enchaine parfois trois imports. */
  const bb = await page.evaluate(() => {
    const r = document.getElementById('board').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(bb.x, bb.y);        // curseur pose, puis immobile
  await page.waitForTimeout(300);

  const vus = new Set();
  const liens = new Set();
  for (let k = 0; k < 26; k++) {
    const e = await page.evaluate(() => {
      const c = document.getElementById('board-card');
      const f = [...document.querySelectorAll('.board__face')]
        .find((x) => x.getBoundingClientRect().height > 0 && !x.className.includes('--b')
                     || x.className.includes('--b'));
      return { href: c.getAttribute('href'),
               fonds: [...document.querySelectorAll('.board__face')]
                        .map((x) => getComputedStyle(x).backgroundColor) };
    });
    liens.add(e.href); e.fonds.forEach((f) => vus.add(f));
    await page.waitForTimeout(700);
  }
  await page.mouse.move(4, 4);
  check('le tableau tourne sous un curseur immobile', liens.size >= 3,
        `${liens.size} lignes vues en 18 s`);
  check('les deux fonds du tableau', vus.size >= 2, [...vus].join(' / '));

  const forme = await page.evaluate(() => {
    const c = document.getElementById('board-card');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const f = [...document.querySelectorAll('.board__face')].map((x) => {
      const s = getComputedStyle(x);
      return { pos: s.position, back: s.backfaceVisibility };
    });
    return { h: Math.round(r.height), w: Math.round(r.width),
             style3d: getComputedStyle(c).transformStyle,
             persp: getComputedStyle(c.parentElement).perspective,
             faces: f };
  });
  check('le tableau a une forme, pas seulement un comportement',
        !!forme && forme.h >= 200 && forme.style3d === 'preserve-3d' &&
        forme.persp !== 'none' && forme.faces.every((x) => x.pos === 'absolute'
                                                        && x.back === 'hidden'),
        forme ? `${forme.w}x${forme.h}, ${forme.style3d}, perspective ${forme.persp}, ` +
                `faces ${forme.faces.map((x) => x.pos).join('+')}` : 'panneau absent');


  /* LE REPERTOIRE DE SECTIONS, MESURE.

     La demande precedente du client — « a color pattern of blue and white, not
     make the entire background blue » — se controlait par une part de surface
     bleue plafonnee. Elle ne dit plus rien du site actuel : ce qu'il reproche
     maintenant, c'est qu'il est « vide et rempli a la fois », faute de paliers
     intermediaires. La famille nuit N'EST PAS le bleu d'aplat d'avant, c'est le
     rythme ; la plafonner reviendrait a redemander le defaut qu'on corrige.

     Ce qui se mesure desormais, c'est le repertoire lui-meme. Chaque section
     declare son type — A heros, B bande de donnees, C ruban, D bande photo,
     E editorial, F cartes, G citation, H index — et trois proprietes doivent
     tenir : jamais deux voisines du meme type, une section nuit au moins
     toutes les trois, et au moins cinq types distincts sur la page. */
  const rep = await page.evaluate(() =>
    [...document.querySelectorAll('main [data-type]')].map((el) => ({
      type: el.dataset.type,
      sol: el.dataset.sol || 'clair',
    })));

  const voisines = rep.filter((x, i) => i > 0 && rep[i - 1].type === x.type)
                      .map((x) => x.type);
  check('deux sections voisines ne se ressemblent jamais', voisines.length === 0,
        `${rep.length} sections : ${rep.map((x) => x.type).join(' ')}`);

  const types = new Set(rep.map((x) => x.type));
  check('au moins cinq types de section', types.size >= 5,
        `${types.size} types — ${[...types].join(' ')}`);

  /* Le plus long intervalle sans sol sombre. Le ruban en accent compte : c'est
     une bande soutenue pleine largeur, elle coupe la suite claire comme le
     ferait une nuit. */
  let ecart = 0, pire = 0;
  for (const x of rep) {
    if (x.sol === 'nuit' || x.sol === 'nuit-2' || x.sol === 'accent') ecart = 0;
    else pire = Math.max(pire, ++ecart);
  }
  check('une section sombre au moins toutes les trois', pire <= 3,
        `plus long intervalle clair : ${pire} sections`);

  const sombres = rep.filter((x) => x.sol === 'nuit' || x.sol === 'nuit-2').length;
  check('la page porte des sections nuit', sombres >= 2, `${sombres} sections nuit`);

  /* --step-4 et --step-5 sont reserves a un contenu qui merite cette taille.
     Le cran 5 (jusqu'a 6,8rem, soit 109px) n'est employe nulle part : le titre
     d'accueil fait deux phrases entieres, il occuperait plus d'un ecran. Aucun
     texte de la page ne doit donc depasser le cran 4, plafonne a 67px. */
  const geants = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.children.length === 0 && el.textContent.trim()
                      && parseFloat(getComputedStyle(el).fontSize) > 70)
      .map((el) => `${el.tagName} ${Math.round(parseFloat(getComputedStyle(el).fontSize))}px`));
  check('aucun titre au-dela du cran 4', geants.length === 0, geants.slice(0, 3).join(' | '));

  /* Contraste AA sur les sols nuit, ou vit maintenant une section sur trois. */
  const nuit = await page.evaluate(() => {
    const el = document.querySelector('main [data-sol="nuit"]');
    if (!el) return null;
    const s = getComputedStyle(el);
    const q = el.querySelector('.t-quiet');
    return { bg: s.backgroundColor, fg: s.color,
             muted: q ? getComputedStyle(q).color : s.color };
  });
  check('une section nuit existe', !!nuit);
  if (nuit) {
    const b = parse(nuit.bg);
    const cN = ratio(flat(parse(nuit.fg), b), b);
    const mN = ratio(flat(parse(nuit.muted), b), b);
    check('AA encre / nuit', cN >= 4.5, cN.toFixed(2));
    check('AA muted / nuit', mN >= 4.5, mN.toFixed(2));
  }

  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  /* Le corridor entrant n'est plus un fond : depuis la refonte, la direction
     d'une marchandise se lit au fil d'Ariane et au code de section, pas a la
     valeur du papier. Le controle porte donc sur le ruban, qui est le seul
     element pleine largeur du haut de page et le seul qui bouge en continu. */
  const ruban = await page.evaluate(() => {
    const el = document.querySelector('[data-type="C"] .ruban__piste');
    if (!el) return null;
    const s = getComputedStyle(el);
    return { anim: s.animationName, duree: s.animationDuration,
             lots: el.children.length, large: Math.round(el.getBoundingClientRect().width) };
  });
  check('le ruban defile', !!ruban && ruban.anim === 'defile' && ruban.lots === 2,
        ruban ? `${ruban.anim}, ${ruban.duree}, ${ruban.lots} lots, ${ruban.large}px` : 'absent');

  await ctx.close();
}

/* ------------------------------------------------------------- mobile --- */
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  console.log('\nMOBILE (iPhone 12, émulation réelle)');
  const m = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check('largeur de rendu', m.vw <= 400, `${m.vw}px`);
  check('aucun débordement horizontal', m.over === 0, `${m.over}px`);

  /* AU DOIGT, PAS AU CURSEUR. Audit mesure avant correction : de quarante a
     cinquante et une cibles de moins de 44px par page — le numero du bandeau
     en faisait 20, le bouton Menu 27. Consequence directe du retrait des
     filets : en enlevant les traits j'avais enleve les rembourrages qui
     allaient avec. 48px est un cran au-dessus du minimum d'Apple et de Google.
     Et sous 16px, un champ de saisie fait zoomer iOS tout seul. */
  const doigt = await page.evaluate(() => {
    const petites = [];
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 48) petites.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '?'} ${Math.round(r.height)}px`);
    }
    const zoom = [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.id || el.name);
    return { petites: [...new Set(petites)], zoom };
  });
  check('toutes les cibles font 48px', doigt.petites.length === 0,
        doigt.petites.slice(0, 4).join(' | '));
  check('aucun champ ne fait zoomer iOS', doigt.zoom.length === 0, doigt.zoom.join(' '));
  await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });
  await ctx.close();
}

/* ------------------------------------------------ fiche import (sombre) -- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(new URL('/import/medical-equipment/', TARGET).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });

  console.log('\nFICHE IMPORT (medical-equipment) 1440x900');
  const r = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const q = document.querySelector('.t-quiet');
    return {
      bg: b.backgroundColor, fg: b.color,
      muted: q ? getComputedStyle(q).color : b.color,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titre: document.querySelector('h1')?.textContent?.trim() ?? '',
      sens: document.querySelector('.tete__sens')?.textContent?.trim() ?? '',
      mono: [...document.querySelectorAll('.t-label')]
              .some((e) => /plex mono/i.test(getComputedStyle(e).fontFamily)),
    };
  });
  const rgbBg = parse(r.bg);
  /* La direction ne se lit plus a la valeur du papier — les dix fiches import
     etaient un aplat de bout en bout, et c'est ce que le client appelait
     « heavy on the eyes ». Elle est ecrite : au fil d'Ariane, et au code de
     section de la tete. */
  check('le corps de la fiche est sur le sol clair', rgbBg[0] > 200, r.bg);
  check('la fiche dit sa direction', /into ethiopia/i.test(r.sens), r.sens);
  check('AA encre / sol clair', ratio(flat(parse(r.fg), rgbBg), rgbBg) >= 4.5, ratio(flat(parse(r.fg), rgbBg), rgbBg).toFixed(2));
  const mDark = ratio(flat(parse(r.muted), rgbBg), rgbBg);
  check('AA muted / sol clair', mDark >= 4.5, mDark.toFixed(2));
  check('la fiche s’ouvre en typographie', r.titre.length > 0, r.titre);
  check('aucun débordement horizontal', r.over === 0, `${r.over}px`);
  /* La mono n'est plus un accident : elle porte tous les micro-libelles du
     site. Le controle est donc inverse — c'est son ABSENCE qui serait un
     defaut. */
  check('les micro-libelles sont en mono', r.mono);

  await page.screenshot({ path: `${OUT}/import.png` });
  await ctx.close();
}

/* ------------------------------------------------ balayage de TOUTES les pages */
/* Le debordement de 40px sur /about/, /training/ et /contact/ est passe parce que
   ce fichier ne testait que deux pages sur dix-huit. Il les balaie toutes. */
{
  const { readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const routes = [];
  (function walk(d, base) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), base + e.name + '/');
      else if (e.name === 'index.html') routes.push(base);
    }
  })('dist', '/');

  console.log(`
BALAYAGE — ${routes.length} pages`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const over = [], vign = [], filet = [], sombre = [];
  for (const r of routes) {
    await page.goto(new URL(r, TARGET).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')]
        .map((i) => (i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; }))));
    });
    const m = await page.evaluate(() => ({
      o: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      /* La nuit donne le rythme, elle ne tient pas le sol. Sur la premiere
         version de cette refonte, les deux plus hautes sections de l'accueil
         etaient sombres et la page montait a 59 % de surface peinte en nuit :
         plus un rythme, un fond — precisement ce que le client avait deja
         refuse quand il etait bleu. Le pied de page en pese deja un cinquieme
         a lui seul, d'ou le plafond a la moitie.
         Ce qui est cache ne peint pas : le menu plein ecran et la barre
         d'appel couvrent chacun une fenetre entiere, en permanence. */
      n: (() => {
        const total = document.documentElement.scrollHeight * innerWidth;
        let nuit = 0;
        for (const el of document.querySelectorAll('body *')) {
          const c = getComputedStyle(el);
          if (c.visibility === 'hidden' || c.display === 'none' || el.hidden) continue;
          if (c.position === 'fixed') continue;
          const v = (c.backgroundColor.match(/[\d.]+/g) || []).map(Number);
          if (v.length < 3 || (v.length > 3 && v[3] < 0.5)) continue;
          if (v[0] < 90 && v[1] < 90 && v[2] < 130) {
            const r = el.getBoundingClientRect();
            if (r.width * r.height >= 100) nuit += r.width * r.height;
          }
        }
        return Math.round((nuit / total) * 100);
      })(),
      // §5 — deux tailles d'image seulement : la bande et la pleine colonne.
      // Sous 360px sur un ecran de 1440, c'est une vignette.
      // Aucune image affichee au-dela de sa taille reelle, sur aucune page.
      p: [...document.querySelectorAll('img')]
           .filter((i) => i.naturalWidth && i.getBoundingClientRect().width > i.naturalWidth + 1)
           .map((i) => (i.currentSrc || i.src).split('/').pop()),
      // La couleur ne travaille qu'en aplat. Aucun filet bleu, sur aucune page.
      f: (() => {
        const bleu = (v) => { const n = (v.match(/[\d.]+/g) || []).map(Number);
          return !(n.length > 3 && n[3] === 0) && n.length >= 3 && n[2] - n[0] > 60; };
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.getBoundingClientRect().right < 0) continue;
          const c = getComputedStyle(el);
          const cotes = [['borderTopColor', c.borderTopWidth],
                         ['borderBottomColor', c.borderBottomWidth],
                         ['borderLeftColor', c.borderLeftWidth],
                         ['borderRightColor', c.borderRightWidth]];
          // Un filet est un trait sur UN SEUL cote. Une bordure sur les quatre
          // est la forme d'un objet — un bouton, un champ — pas un separateur.
          const peints = cotes.filter(([, w]) => parseFloat(w) > 0);
          if (peints.length <= 2)
            for (const [k] of peints)
              if (bleu(c[k])) out.push(el.tagName + '.' + (el.className || ''));
          if (c.textDecorationLine !== 'none' && bleu(c.textDecorationColor)
              && c.textDecorationColor !== c.color)
            out.push(el.tagName + '.' + (el.className || '') + ':underline');
        }
        return [...new Set(out)].slice(0, 3);
      })(),
    }));
    if (m.o !== 0) over.push(`${r} (${m.o}px)`);
    if (m.p.length) vign.push(`${r} ${m.p.join(' ')}`);
    if (m.f.length) filet.push(`${r} ${m.f.join(' ')}`);
    if (m.n > 50) sombre.push(`${r} ${m.n} %`);
  }
  check('aucun debordement sur aucune page', over.length === 0, over.join(', '));
  check('aucune image agrandie sur aucune page', vign.length === 0, vign.join(' | '));
  check('aucun filet colore sur aucune page', filet.length === 0, filet.join(' | '));
  check('la nuit rythme, elle ne tient pas le sol', sombre.length === 0,
        sombre.slice(0, 4).join(' | ') || 'aucune page au-dela de 50 %');
  await ctx.close();
}

await browser.close();
console.log(`\n${bad === 0 ? 'TOUT PASSE' : bad + ' ECHEC(S)'} — captures dans verif/\n`);
process.exit(bad === 0 ? 0 : 1);
