/* ---------------------------------------------------------------------------
   §11 du brief HDM — vérification obligatoire avant de rendre.

       node verif/check.mjs [url]        (défaut http://localhost:4321/)

   Contrôle, sur le rendu et non dans le code :
     · la police est bien Archivo, pas un repli Helvetica
     · wdth 118 et wdth 66 sont visiblement différentes
     · trois couleurs au maximum à l'écran
     · toutes les images ont le même ratio et le même étalonnage
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
  await page.evaluate(() => document.fonts.ready);

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
      for (const [k, w] of [['borderTopColor', s.borderTopWidth],
                            ['borderBottomColor', s.borderBottomWidth],
                            ['borderLeftColor', s.borderLeftWidth],
                            ['borderRightColor', s.borderRightWidth]]) {
        if (parseFloat(w) > 0 && bleu(s[k])) out.push(el.tagName + '.' + (el.className || '') + ' ' + k);
      }
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
      narrow: imgs.filter((i) => {
        const col = i.closest('.shell')?.clientWidth ?? document.documentElement.clientWidth;
        return i.getBoundingClientRect().width < col * 0.9;
      }).length,
    };
  });
  check('étalonnage unique sur les images', media.filters.length <= 1,
        `${media.total} image(s), ${media.filters.length} filtre(s)`);
  check('angles vifs sur les images', media.radii.every((r) => parseFloat(r) === 0), media.radii.join(' '));
  check('aucune vignette étroite', media.narrow === 0, `${media.narrow} plus étroite(s) que la colonne`);

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

  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  /* La bascule a disparu : le corridor entrant est une bande permanente.
     On verifie que la bande peint bien la nuit et qu'elle tient AA dessus. */
  const band = await page.evaluate(() => {
    const el = document.querySelector('[data-flow="in"].reg-in');
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
    check('la bande peint l aplat bleu', parse(band.bg)[0] < 40 && parse(band.bg)[2] > 40, band.bg);
    const cIn = ratio(flat(parse(band.fg), parse(band.bg)), parse(band.bg));
    const mIn = ratio(flat(parse(band.muted), parse(band.bg)), parse(band.bg));
    check('AA papier / aplat bleu', cIn >= 4.5, cIn.toFixed(2));
    check('AA muted / aplat bleu', mIn >= 4.5, mIn.toFixed(2));
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
  await page.evaluate(() => document.fonts.ready);
  console.log('\nMOBILE (iPhone 12, émulation réelle)');
  const m = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check('largeur de rendu', m.vw <= 400, `${m.vw}px`);
  check('aucun débordement horizontal', m.over === 0, `${m.over}px`);
  await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });
  await ctx.close();
}

/* ------------------------------------------------ fiche import (sombre) -- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(new URL('/import/medical-equipment/', TARGET).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  console.log('\nFICHE IMPORT (medical-equipment) 1440x900');
  const r = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const q = document.querySelector('.t-quiet');
    const img = document.querySelector('.head img');
    return {
      bg: b.backgroundColor, fg: b.color,
      muted: q ? getComputedStyle(q).color : b.color,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlay: !!document.querySelector('.media--dark'),
      imgW: img ? Math.round(img.getBoundingClientRect().width) : 0,
      vw: document.documentElement.clientWidth,
      mono: [...document.querySelectorAll('*')].some((e) => /mono/i.test(getComputedStyle(e).fontFamily)),
    };
  });
  const rgbBg = parse(r.bg);
  check('page import sur l’aplat bleu', rgbBg[2] - rgbBg[0] > 60, r.bg);
  check('voile sombre sur l’image', r.overlay);
  check('AA texte / aplat bleu', ratio(flat(parse(r.fg), rgbBg), rgbBg) >= 4.5, ratio(flat(parse(r.fg), rgbBg), rgbBg).toFixed(2));
  const mDark = ratio(flat(parse(r.muted), rgbBg), rgbBg);
  check('AA muted / aplat bleu', mDark >= 4.5, mDark.toFixed(2));
  check('image de tête pleine largeur', r.imgW >= r.vw * 0.9, `${r.imgW}px / ${r.vw}px`);
  check('aucun débordement horizontal', r.over === 0, `${r.over}px`);
  const geo = await page.evaluate(() => {
    const f = document.querySelector('.head'), i = f.querySelector('img'),
          c = f.querySelector('.head__cap');
    const a = i.getBoundingClientRect(), b = c.getBoundingClientRect();
    return { in: b.top >= a.top - 1 && b.bottom <= a.bottom + 1,
             pos: getComputedStyle(f).position,
             d: `legende ${Math.round(b.top)}-${Math.round(b.bottom)}, image ${Math.round(a.top)}-${Math.round(a.bottom)}` };
  });
  check('la legende est DANS l image', geo.in, `${geo.pos} — ${geo.d}`);

  check('aucune monospace', !r.mono);

  /* Le titre est posé SUR une photo : aucun contraste calculé sur le fond de
     page ne le couvre. On échantillonne les pixels de l'image sous la légende
     et on composite le voile à son point le PLUS FAIBLE (pire cas). C'est ce
     contrôle qui manquait : le titre est sorti illisible alors que les 21
     autres passaient. */
  const legible = await page.evaluate(async () => {
    const img = document.querySelector('.head img');
    const cap = document.querySelector('.head__cap');
    const h1 = document.querySelector('.head__h');
    if (!img || !cap || !h1) return null;
    await img.decode();

    const ib = img.getBoundingClientRect();
    const tb = h1.getBoundingClientRect();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);

    // region de l'image reellement sous le titre (object-fit: cover)
    const sx = Math.max(0, Math.round(((tb.left - ib.left) / ib.width) * cv.width));
    const sy = Math.max(0, Math.round(((tb.top - ib.top) / ib.height) * cv.height));
    const sw = Math.max(1, Math.min(cv.width - sx, Math.round((tb.width / ib.width) * cv.width)));
    const sh = Math.max(1, Math.min(cv.height - sy, Math.round((tb.height / ib.height) * cv.height)));
    const d = cv.getContext('2d').getImageData(sx, sy, sw, sh).data;

    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
    const mean = [r/n, g/n, b/n];
    const fg = getComputedStyle(h1).color;
    return { mean, fg, filter: getComputedStyle(img).filter };
  });

  if (legible) {
    // le voile le plus faible au-dessus de la ligne de titre : alpha .45
    const scrim = [26, 29, 24];
    const worst = legible.mean.map((c, i) => c * (1 - 0.45) + scrim[i] * 0.45);
    const titleRatio = ratio(parse(legible.fg).slice(0, 3), worst);
    check('titre lisible SUR la photo (pire cas du voile)', titleRatio >= 4.5, titleRatio.toFixed(2));
  }

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
    const m = await page.evaluate(() => ({
      o: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // §5 — deux tailles d'image seulement : la bande et la pleine colonne.
      // Sous 360px sur un ecran de 1440, c'est une vignette.
      p: [...document.querySelectorAll('img')]
           .filter((i) => i.getBoundingClientRect().width < 360)
           .map((i) => i.getAttribute('src')),
      // La couleur ne travaille qu'en aplat. Aucun filet bleu, sur aucune page.
      f: (() => {
        const bleu = (v) => { const n = (v.match(/[\d.]+/g) || []).map(Number);
          return !(n.length > 3 && n[3] === 0) && n.length >= 3 && n[2] - n[0] > 60; };
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.getBoundingClientRect().right < 0) continue;
          const c = getComputedStyle(el);
          for (const [k, w] of [['borderTopColor', c.borderTopWidth],
                                ['borderBottomColor', c.borderBottomWidth],
                                ['borderLeftColor', c.borderLeftWidth],
                                ['borderRightColor', c.borderRightWidth]])
            if (parseFloat(w) > 0 && bleu(c[k])) out.push(el.tagName + '.' + (el.className || ''));
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
  check('aucune vignette sur aucune page', vign.length === 0, vign.join(' | '));
  check('aucun filet colore sur aucune page', filet.length === 0, filet.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\n${bad === 0 ? 'TOUT PASSE' : bad + ' ECHEC(S)'} — captures dans verif/\n`);
process.exit(bad === 0 ? 0 : 1);
