import { chromium, devices } from 'playwright';

const PAGES = ['/', '/import/electric-vehicles/', '/export/niger-seed-noug/',
               '/about/', '/contact/', '/training/'];

const audit = async (ctx, nom, largeur) => {
  console.log(`\n================ ${nom} (${largeur}px) ================`);
  let poidsTotal = 0;
  for (const u of PAGES) {
    const p = await ctx.newPage();
    let octets = 0, imgOctets = 0;
    p.on('response', (r) => {
      const l = Number(r.headers()['content-length'] || 0);
      octets += l;
      if (/image|webp/.test(r.headers()['content-type'] || '')) imgOctets += l;
    });
    await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
    await p.evaluate(async () => {
      await document.fonts.ready;
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    });
    await p.waitForTimeout(400);

    const m = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const dpr = devicePixelRatio;

      // cibles tactiles : tout ce qui se touche doit faire 44px
      const petites = [];
      for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 44) petites.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '?'} ${Math.round(r.height)}px "${(el.textContent || '').trim().slice(0, 22)}"`);
      }

      // corps de texte trop petits
      const minus = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
        const f = parseFloat(getComputedStyle(el).fontSize);
        if (f < 13) minus.add(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] || '?'} ${f}px`);
      }

      // champs de saisie : sous 16px iOS zoome tout seul
      const zoom = [...document.querySelectorAll('input, select, textarea')]
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.id || el.name);

      // images : sert-on du 1240px a un ecran de 390 ?
      const img = [...document.querySelectorAll('img')].map((i) => {
        const r = i.getBoundingClientRect();
        const servi = i.currentSrc.match(/_Z?[A-Za-z0-9]+\.webp/) ? i.naturalWidth : i.naturalWidth;
        return { servi, affiche: Math.round(r.width), besoin: Math.round(r.width * dpr),
                 gaspillage: servi > r.width * dpr * 1.15 };
      });

      // longueur de ligne du texte courant
      const corps = [...document.querySelectorAll('p')].filter((e) => e.textContent.trim().length > 80);
      const signes = corps.length
        ? Math.round(corps[0].getBoundingClientRect().width / (parseFloat(getComputedStyle(corps[0]).fontSize) * 0.5))
        : 0;

      return {
        vw, dpr,
        over: document.documentElement.scrollWidth - vw,
        hauteur: document.body.scrollHeight,
        petites: [...new Set(petites)].slice(0, 4),
        nbPetites: new Set(petites).size,
        minus: [...minus].slice(0, 3),
        zoom,
        img, signes,
        premierEcran: (() => {
          const h = innerHeight;
          const el = document.elementFromPoint(vw / 2, h - 10);
          return el ? el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] : '?';
        })(),
      };
    });

    poidsTotal += octets;
    const gasp = m.img.filter((i) => i.gaspillage);
    console.log(`${u.padEnd(28)} ${Math.round(octets / 1024)} Ko (${Math.round(imgOctets / 1024)} img)  ` +
                `haut ${m.hauteur}px  debord ${m.over}  ligne ~${m.signes} signes`);
    if (m.nbPetites) console.log(`   cibles < 44px : ${m.nbPetites} — ${m.petites.join(' | ')}`);
    if (m.minus.length) console.log(`   texte < 13px  : ${m.minus.join(' | ')}`);
    if (m.zoom.length) console.log(`   champs < 16px : ${m.zoom.join(' ')} (iOS zoome)`);
    if (gasp.length) console.log(`   images trop grandes servies : ${gasp.map((i) => `${i.servi}px pour ${i.besoin} necessaires`).join(', ')}`);
    await p.close();
  }
  console.log(`  poids cumule des six pages : ${Math.round(poidsTotal / 1024)} Ko`);
};

const b = await chromium.launch();
await audit(await b.newContext({ ...devices['iPhone 12'] }), 'iPhone 12', 390);
await audit(await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2,
                                 isMobile: true, hasTouch: true,
                                 userAgent: devices['Pixel 5'].userAgent }), 'Android 360', 360);
await b.close();
