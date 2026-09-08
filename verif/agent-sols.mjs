/* Audit ponctuel : repertoire de sections + sols, maquette VS site servi. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';

const SONDE = () => {
  const px = (v) => parseFloat(v) || 0;
  const cs = (el) => getComputedStyle(el);
  const varOf = (el, n) => cs(el).getPropertyValue(n).trim();
  const dump = (el) => {
    const c = cs(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').split(' ').slice(0, 2).join('.'),
      type: el.getAttribute('data-type') || null,
      sol: el.getAttribute('data-sol') || null,
      bg: c.backgroundColor,
      color: c.color,
      vSol: varOf(el, '--sol'),
      vEncre: varOf(el, '--encre'),
      vGris: varOf(el, '--gris'),
      vFilet: varOf(el, '--filet'),
      w: Math.round(r.width), h: Math.round(r.height),
    };
  };
  const out = {};
  out.sols = [...document.querySelectorAll('[data-sol]')].map(dump);
  out.types = [...document.querySelectorAll('[data-type]')].map(dump);

  const idx = [...document.querySelectorAll('.index__l')];
  out.index = idx.map((el) => {
    const c = cs(el);
    return { top: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor,
             bottom: c.borderBottomWidth + ' ' + c.borderBottomStyle + ' ' + c.borderBottomColor,
             display: c.display, cols: c.gridTemplateColumns, areas: c.gridTemplateAreas };
  });
  out.indexN = idx.length;

  const cartes = [...document.querySelectorAll('.carte')];
  out.cartes = cartes.map((el) => {
    const c = cs(el);
    return { radius: c.borderRadius, bg: c.backgroundColor, display: c.display,
             pad: c.paddingTop };
  });

  out.edito = [...document.querySelectorAll('.edito__t')].map((el) => {
    const c = cs(el);
    return { position: c.position, top: c.top,
             parentCols: cs(el.parentElement).gridTemplateColumns,
             parentDisplay: cs(el.parentElement).display };
  });

  out.donnees = [...document.querySelectorAll('.donnees')].map((el) => {
    const c = cs(el);
    const k = el.firstElementChild ? cs(el.firstElementChild) : null;
    return { display: c.display, cols: c.gridTemplateColumns,
             enfantBorder: k ? k.borderLeftWidth + ' ' + k.borderLeftStyle + ' ' + k.borderLeftColor : null };
  });

  out.ruban = [...document.querySelectorAll('.ruban__piste')].map((el) => {
    const c = cs(el);
    return { animation: c.animationName + ' ' + c.animationDuration, display: c.display, width: c.width };
  });

  out.pleine = [...document.querySelectorAll('.pleine')].map((el) => {
    const im = el.querySelector('img');
    const cap = el.querySelector('figcaption');
    return { imgH: im ? Math.round(im.getBoundingClientRect().height) : null,
             imgFit: im ? cs(im).objectFit : null,
             capPos: cap ? cs(cap).position : null,
             capBg: cap ? cs(cap).backgroundImage.slice(0, 60) : null };
  });

  out.citation = [...document.querySelectorAll('.citation blockquote')].map((el) => {
    const c = cs(el);
    return { family: c.fontFamily.split(',')[0], style: c.fontStyle, size: c.fontSize };
  });

  /* part de surface sombre */
  const W = innerWidth;
  const total = document.documentElement.scrollHeight * W;
  const fam = (v) => {
    const n = (v.match(/[\d.]+/g) || []).map(Number);
    if (n.length > 3 && n[3] < 0.5) return null;
    const [r, g, b] = n;
    if (r === undefined) return null;
    if (r > 200 && g > 200 && b > 195) return 'clair';
    if (r < 90 && g < 90 && b < 130) return 'nuit';
    if (b - r > 45) return 'accent';
    return 'autre';
  };
  const a = { clair: 0, nuit: 0, accent: 0, autre: 0 };
  for (const el of document.querySelectorAll('body *')) {
    const c = cs(el);
    if (c.visibility === 'hidden' || c.display === 'none' || el.hidden) continue;
    if (c.position === 'fixed') continue;
    const f = fam(c.backgroundColor);
    if (!f) continue;
    const r = el.getBoundingClientRect();
    const s = r.width * r.height;
    if (s < 100) continue;
    a[f] += s;
  }
  out.surface = { total: Math.round(total), ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.round(v)])) };
  out.scrollH = document.documentElement.scrollHeight;
  out.bodyBg = cs(document.body).backgroundColor;
  out.rootFilet = varOf(document.documentElement, '--filet');
  out.nbFontFace = 0;
  return out;
};

const stabiliser = async (p) => {
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(250);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });

/* --- routes depuis la maquette --- */
const pm = await ctx.newPage();
const erreurs = [];
pm.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
pm.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 200)); });
await pm.goto(MAQ, { waitUntil: 'load' });
const routes = await pm.evaluate(() => Object.keys(JSON.parse(document.getElementById('routes').textContent)).sort());
console.log('routes:', routes.length, routes.join(' '));

const resMaq = {};
for (const r of routes) {
  await pm.evaluate((rr) => {
    const a = document.createElement('a'); a.href = rr; a.style.display = 'none';
    document.body.append(a); a.click(); a.remove();
  }, r);
  await stabiliser(pm);
  resMaq[r] = await pm.evaluate(SONDE);
}
await pm.close();

const resSite = {};
for (const r of routes) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
  await stabiliser(p);
  resSite[r] = await p.evaluate(SONDE);
  await p.close();
}
await b.close();

writeFileSync('verif/agent-sols.json', JSON.stringify({ routes, maquette: resMaq, site: resSite, erreurs }, null, 1));
console.log('erreurs page maquette:', erreurs.length ? erreurs : 'aucune');
console.log('ecrit verif/agent-sols.json');
