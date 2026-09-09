// RFM — refuter/confirmer : le mot-symbole de l'en-tete est-il sur-servi ?
// Mesure la ressource reellement servie, la boite CSS, et le poids en octets.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const ROUTES = [
  '/', '/about/', '/contact/', '/training/',
  '/export/niger-seed-noug/', '/export/sesame-seed/', '/export/red-kidney-beans/', '/export/soya-bean/',
  '/import/electric-vehicles/', '/import/medical-equipment/', '/import/human-medicine/',
  '/import/building-glass/', '/import/elevator-and-escalator/', '/import/calcium-hypochlorite/',
  '/import/plastic-raw-materials/', '/import/solar-lanterns/', '/import/stationery-materials/',
  '/import/ceramics/',
];

const FORMATS = {
  tel: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  pc:  { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const nav = await chromium.launch();
for (const [nom, opts] of Object.entries(FORMATS)) {
  const ctx = await nav.newContext(opts);
  const octets = new Map();          // url -> taille transferee
  ctx.on('response', async (r) => {
    const u = r.url();
    if (!/\.(png|webp|avif|jpe?g|svg)/i.test(u)) return;
    try {
      const b = await r.body();
      octets.set(u, b.length);
    } catch {}
  });
  const p = await ctx.newPage();

  const lignes = [];
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    const m = await p.evaluate(async () => {
      const out = {};
      for (const sel of ['.mark__mot', '.mark__verrou']) {
        const i = document.querySelector(sel);
        if (!i) { out[sel] = null; continue; }
        await i.decode().catch(() => {});
        const t = new Image(); t.src = i.currentSrc; await t.decode().catch(() => {});
        const r = i.getBoundingClientRect();
        out[sel] = {
          src: i.currentSrc,
          srcset: i.getAttribute('srcset'),
          attrs: [i.getAttribute('width'), i.getAttribute('height')],
          servi: [t.naturalWidth, t.naturalHeight],
          css: [+r.width.toFixed(1), +r.height.toFixed(1)],
          demande: Math.round(r.width * devicePixelRatio),
          dpr: devicePixelRatio,
        };
      }
      return out;
    });
    lignes.push({ route, ...m });
  }

  // resume : les mesures sont-elles identiques sur les 18 routes ?
  const cle = (l) => JSON.stringify([l['.mark__mot']?.servi, l['.mark__mot']?.css, l['.mark__verrou']?.servi, l['.mark__verrou']?.css]);
  const uniques = new Map();
  for (const l of lignes) { const k = cle(l); if (!uniques.has(k)) uniques.set(k, []); uniques.get(k).push(l.route); }

  console.log('\n===== FORMAT ' + nom + ' =====');
  for (const [k, routes] of uniques) {
    const ex = lignes.find((l) => cle(l) === k);
    console.log('routes (' + routes.length + '/18) :', routes.slice(0, 3).join(' ') + (routes.length > 3 ? ' ...' : ''));
    for (const sel of ['.mark__mot', '.mark__verrou']) {
      const d = ex[sel]; if (!d) { console.log('  ' + sel + ' ABSENT'); continue; }
      const o = octets.get(d.src);
      const ratio = (d.servi[0] / d.demande).toFixed(2);
      console.log('  ' + sel.padEnd(14),
        'attrs=' + d.attrs.join('x'),
        '| servi=' + d.servi.join('x'),
        '| css=' + d.css.join('x'),
        '| demande=' + d.demande + 'px (dpr ' + d.dpr + ')',
        '| servi/demande=' + ratio + 'x',
        '| octets=' + (o == null ? '?' : (o / 1024).toFixed(1) + 'Ko'));
      console.log('      src    =', d.src.slice(0, 160));
      console.log('      srcset =', (d.srcset || '').slice(0, 220));
    }
  }
  await ctx.close();
}
await nav.close();
