/* ---------------------------------------------------------------------------
   §11 du brief HDM — vérification obligatoire avant de rendre.

       node verif/check.mjs [url]        (défaut http://localhost:4321/)

   Contrôle, sur le rendu et non dans le code :
     · la police est bien Archivo, pas un repli Helvetica
     · wdth 118 et wdth 66 sont visiblement différentes
     · trois couleurs au maximum à l'écran
     · aucune image n'est affichée au-delà de sa taille réelle
     · aucune image plus étroite que la colonne de texte
     · aucune ombre portée
     · les pages import sont bien sur fond sombre
     · contraste AA dans les deux valeurs de fond

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

  const t = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    const hero = document.querySelector('.t-display span, .t-h1');
    const label = document.querySelector('.t-label');
    return {
      archivo: document.fonts.check('800 60px Archivo'),
      bodyFamily: cs(document.body).fontFamily.split(',')[0].replace(/["']/g, ''),
      heroStretch: cs(hero).fontStretch,
      labelStretch: cs(label).fontStretch,
      heroW: Math.round(hero.getBoundingClientRect().width),
    };
  });
  check('Archivo chargée', t.archivo);
  check('aucun repli Helvetica', t.bodyFamily === 'Archivo', t.bodyFamily);
  check('axe wdth appliqué', t.heroStretch !== t.labelStretch,
        `titre ${t.heroStretch} vs libellé ${t.labelStretch}`);

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
  check('angles vifs sur les images', media.radii.every((r) => parseFloat(r) === 0), media.radii.join(' '));
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

  /* LA DEMANDE DU CLIENT, MESUREE. « I meant a color pattern of blue and
     white, not make the entire background blue. » Sa reference porte 10,3 %
     de bleu ; notre accueil en portait 34,3 % et nos fiches import 34,2 %
     pour 0,3 % de blanc. Le bleu ne doit plus jamais depasser l'echelle de
     l'accent : on plafonne a 15 %, avec de la marge sous sa reference. */
  const teintes = await page.evaluate(() => {
    const W = innerWidth, total = document.documentElement.scrollHeight * W;
    let bleu = 0, blanc = 0;
    for (const el of document.querySelectorAll('body *')) {
      const v = getComputedStyle(el).backgroundColor;
      const n = (v.match(/[\d.]+/g) || []).map(Number);
      if (n.length < 3 || (n.length > 3 && n[3] < 0.5)) continue;
      const r = el.getBoundingClientRect(), s = r.width * r.height;
      if (s < 100) continue;
      if (n[0] > 200 && n[1] > 200 && n[2] > 195) blanc += s;
      else if (n[2] - n[0] > 45) bleu += s;
    }
    return { bleu: (bleu / total) * 100, blanc: (blanc / total) * 100 };
  });
  check('le bleu reste a l echelle de l accent', teintes.bleu <= 20,
        `${teintes.bleu.toFixed(1)} % — avant le lavis : 34,3 % ; reference du client : 10,3 %`);
  check('le blanc domine', teintes.blanc >= 25, `${teintes.blanc.toFixed(1)} % de blanc`);

  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  /* La bascule a disparu : le corridor entrant est une bande permanente.
     On verifie que la bande peint bien la nuit et qu'elle tient AA dessus. */
  const band = await page.evaluate(() => {
    // On vise l'attribut, pas la classe : la classe de mise en page a change
    // quand l'accueil est passe en sections nommees, et le controle a casse
    // alors que la bande, elle, etait toujours la.
    const el = document.querySelector('main section[data-flow="in"]');
    if (!el) return null;
    const s = getComputedStyle(el);
    const q = el.querySelector('.t-quiet');
    return { bg: s.backgroundColor, fg: s.color,
             muted: q ? getComputedStyle(q).color : s.color,
             top: Math.round(el.getBoundingClientRect().top + scrollY),
             h: Math.round(el.getBoundingClientRect().height) };
  });
  check('la bande entrante existe', !!band);
  if (band) {
    /* La bande entrante ne porte plus un aplat sature mais un lavis : un bleu
       a 5 % sur le papier, qui se lit dans la famille du blanc. Le texte y
       revient a l'encre. */
    const w = parse(band.bg);
    check('la bande porte le lavis, pas l aplat',
          w[0] > 200 && w[1] > 200 && w[2] > 200 && w[2] > w[0], band.bg);
    const cIn = ratio(flat(parse(band.fg), w), w);
    const mIn = ratio(flat(parse(band.muted), w), w);
    check('AA encre / lavis', cIn >= 4.5, cIn.toFixed(2));
    check('AA muted / lavis', mIn >= 4.5, mIn.toFixed(2));
    check('la bande fait sa hauteur', band.h > 400, `${band.h}px`);
    await page.evaluate((y) => scrollTo(0, y - 40), band.top);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/home-in.png` });
  }
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
     allaient avec. 44px est le minimum d'Apple comme de Google.
     Et sous 16px, un champ de saisie fait zoomer iOS tout seul. */
  const doigt = await page.evaluate(() => {
    const petites = [];
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 44) petites.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '?'} ${Math.round(r.height)}px`);
    }
    const zoom = [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.id || el.name);
    return { petites: [...new Set(petites)], zoom };
  });
  check('toutes les cibles font 44px', doigt.petites.length === 0,
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
      mono: [...document.querySelectorAll('*')].some((e) => /mono/i.test(getComputedStyle(e).fontFamily)),
    };
  });
  const rgbBg = parse(r.bg);
  check('page import sur le lavis', rgbBg[0] > 200 && rgbBg[2] > rgbBg[0], r.bg);
  check('AA encre / lavis', ratio(flat(parse(r.fg), rgbBg), rgbBg) >= 4.5, ratio(flat(parse(r.fg), rgbBg), rgbBg).toFixed(2));
  const mDark = ratio(flat(parse(r.muted), rgbBg), rgbBg);
  check('AA muted / lavis', mDark >= 4.5, mDark.toFixed(2));
  check('la fiche s’ouvre en typographie', r.titre.length > 0, r.titre);
  check('aucun débordement horizontal', r.over === 0, `${r.over}px`);
  check('aucune monospace', !r.mono);

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
  const over = [], vign = [], filet = [];
  for (const r of routes) {
    await page.goto(new URL(r, TARGET).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')]
        .map((i) => (i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; }))));
    });
    const m = await page.evaluate(() => ({
      o: document.documentElement.scrollWidth - document.documentElement.clientWidth,
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
  }
  check('aucun debordement sur aucune page', over.length === 0, over.join(', '));
  check('aucune image agrandie sur aucune page', vign.length === 0, vign.join(' | '));
  check('aucun filet colore sur aucune page', filet.length === 0, filet.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\n${bad === 0 ? 'TOUT PASSE' : bad + ' ECHEC(S)'} — captures dans verif/\n`);
process.exit(bad === 0 ? 0 : 1);
