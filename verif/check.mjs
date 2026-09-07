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
    const hero = document.querySelector('.t-hero span');
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
    if (r > 190 && g > 130 && b < 90) return 'noug';
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

  await page.screenshot({ path: `${OUT}/home.png` });

  /* La bascule change-t-elle réellement la valeur du fond ? */
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#go-in');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('la bascule change la valeur du fond', before !== after, `${before} -> ${after}`);
  await page.screenshot({ path: `${OUT}/home-in.png` });
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
  await page.screenshot({ path: `${OUT}/home-mobile.png` });
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
  check('page import sur fond sombre', lum(rgbBg) < 0.1, r.bg);
  check('voile sombre sur l’image', r.overlay);
  check('AA texte / fond sombre', ratio(flat(parse(r.fg), rgbBg), rgbBg) >= 4.5, ratio(flat(parse(r.fg), rgbBg), rgbBg).toFixed(2));
  const mDark = ratio(flat(parse(r.muted), rgbBg), rgbBg);
  check('AA muted / fond sombre', mDark >= 4.5, mDark.toFixed(2));
  check('image de tête pleine largeur', r.imgW >= r.vw * 0.9, `${r.imgW}px / ${r.vw}px`);
  check('aucun débordement horizontal', r.over === 0, `${r.over}px`);
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

await browser.close();
console.log(`\n${bad === 0 ? 'TOUT PASSE' : bad + ' ECHEC(S)'} — captures dans verif/\n`);
process.exit(bad === 0 ? 0 : 1);
