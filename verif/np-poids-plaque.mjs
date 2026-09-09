// np- : angle sceptique sur le POIDS de la plaque produit.
// On mesure, pour les 14 fiches et les 2 formats, l'octet reellement servi
// pour l'image de .plaque.intro__img, sa largeur reelle, et la place qu'elle
// occupe a l'ecran. Aucune modification du site.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const FICHES = [
  '/export/niger-seed-noug/', '/export/sesame-seed/', '/export/red-kidney-beans/', '/export/soya-bean/',
  '/import/electric-vehicles/', '/import/medical-equipment/', '/import/human-medicine/',
  '/import/building-glass/', '/import/elevator-and-escalator/', '/import/calcium-hypochlorite/',
  '/import/plastic-raw-materials/', '/import/solar-lanterns/', '/import/stationery-materials/',
  '/import/ceramics/',
];

const FORMATS = {
  pc:  { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  tel: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const nav = await chromium.launch();
const resultats = [];

for (const [nomFmt, opts] of Object.entries(FORMATS)) {
  const ctx = await nav.newContext({ ...opts, userAgent: opts.isMobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : undefined });

  for (const route of FICHES) {
    const page = await ctx.newPage();
    // On note chaque reponse : URL -> octets du corps reellement recu.
    const octets = new Map();
    let totalPage = 0, totalImages = 0;
    page.on('response', async (rep) => {
      try {
        const buf = await rep.body();
        const url = rep.url();
        octets.set(url, buf.length);
        totalPage += buf.length;
        const ct = (rep.headers()['content-type'] || '');
        if (ct.startsWith('image/')) totalImages += buf.length;
      } catch {}
    });

    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const info = await page.evaluate(() => {
      const img = document.querySelector('.plaque.intro__img img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return {
        src: img.currentSrc || img.src,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        cssW: Math.round(r.width * 10) / 10,
        cssH: Math.round(r.height * 10) / 10,
        fit: cs.objectFit,
        sizes: img.getAttribute('sizes') || '',
        srcset: (img.getAttribute('srcset') || '').split(',').map(s => s.trim().split(' ').pop()).join('|'),
      };
    });

    if (info) {
      const abs = info.src.startsWith('http') ? info.src : BASE + info.src;
      info.octets = octets.get(abs) ?? null;
      info.ko = info.octets == null ? null : Math.round(info.octets / 102.4) / 10;
      // octets par pixel de l'image reellement servie
      info.octetsParPx = info.octets == null ? null
        : Math.round((info.octets / (info.naturalW * info.naturalH)) * 1000) / 1000;
      info.dpr = opts.deviceScaleFactor;
      info.demandeCssPx = Math.round(info.cssW * opts.deviceScaleFactor);
      info.ratioServiDemande = Math.round((info.naturalW / info.demandeCssPx) * 100) / 100;
    }

    resultats.push({
      format: nomFmt, route,
      pageKo: Math.round(totalPage / 102.4) / 10,
      imagesKo: Math.round(totalImages / 102.4) / 10,
      plaque: info,
    });
    await page.close();
  }
  await ctx.close();
}

await nav.close();
writeFileSync(new URL('./np-mesures.json', import.meta.url), JSON.stringify(resultats, null, 1));

// Tableau lisible, trie par poids de plaque decroissant, par format.
for (const fmt of ['pc', 'tel']) {
  console.log('\n=== FORMAT ' + fmt.toUpperCase() + ' ===');
  console.log('route'.padEnd(36), 'servi'.padStart(6), 'Ko'.padStart(7), 'o/px'.padStart(6),
              'cssW'.padStart(6), 'dem'.padStart(5), 'srv/dem'.padStart(8), 'pageKo'.padStart(7), 'imgKo'.padStart(7));
  const lignes = resultats.filter(r => r.format === fmt && r.plaque)
    .sort((a, b) => (b.plaque.ko ?? 0) - (a.plaque.ko ?? 0));
  for (const r of lignes) {
    const p = r.plaque;
    console.log(
      r.route.padEnd(36),
      String(p.naturalW + 'x' + p.naturalH).padStart(6),
      String(p.ko).padStart(7),
      String(p.octetsParPx).padStart(6),
      String(p.cssW).padStart(6),
      String(p.demandeCssPx).padStart(5),
      String(p.ratioServiDemande).padStart(8),
      String(r.pageKo).padStart(7),
      String(r.imagesKo).padStart(7),
    );
  }
}
