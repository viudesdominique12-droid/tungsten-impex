/* ANGLE : la qualite REELLEMENT servie. Script jetable, a supprimer. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const ROUTES = ['/', '/about/', '/contact/', '/training/',
  ...['niger-seed-noug','sesame-seed','red-kidney-beans','soya-bean'].map(s=>`/export/${s}/`),
  ...['electric-vehicles','medical-equipment','human-medicine','building-glass','elevator-and-escalator','calcium-hypochlorite','plastic-raw-materials','solar-lanterns','stationery-materials','ceramics'].map(s=>`/import/${s}/`)];

const FORMATS = [
  { nom:'pc',  viewport:{width:1440,height:900}, deviceScaleFactor:1 },
  { nom:'tel', viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true },
];

const b = await chromium.launch();
const out = [];
for (const f of FORMATS) {
  for (const r of ROUTES) {
    const ctx = await b.newContext({ viewport:f.viewport, deviceScaleFactor:f.deviceScaleFactor, isMobile:f.isMobile, hasTouch:f.hasTouch });
    const p = await ctx.newPage();
    const octets = new Map();
    p.on('response', async (res) => {
      try {
        const h = res.headers();
        let n = Number(h['content-length'] || 0);
        if (!n) { try { n = (await res.body()).length; } catch { n = 0; } }
        octets.set(res.url(), { n, type: h['content-type'] || '' });
      } catch {}
    });
    await p.goto(BASE + r, { waitUntil:'networkidle' });
    // forcer le chargement des images differees, comme un visiteur qui defile
    await p.evaluate(async () => {
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      window.scrollTo(0, document.body.scrollHeight);
    });
    await p.waitForTimeout(1200);
    await p.evaluate(() => window.scrollTo(0,0));
    await p.waitForTimeout(400);

    const images = await p.evaluate(() => {
      const dpr = window.devicePixelRatio;
      const sel = (el) => {
        const fig = el.closest('figure');
        const cls = fig ? '.' + [...fig.classList].join('.') : '';
        return (cls || 'img') + ' img';
      };
      return [...document.images].map((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        const cssW = r.width, cssH = r.height;
        const natW = i.naturalWidth, natH = i.naturalHeight;
        // largeur d'image reellement necessaire compte tenu de object-fit
        let besoinCss = cssW;
        if (cs.objectFit === 'cover' && natW && natH && cssW && cssH) {
          const s = Math.max(cssW/natW, cssH/natH);
          besoinCss = natW * s;
        }
        return {
          sel: sel(i), alt: i.alt.slice(0,40),
          src: i.currentSrc.replace(location.origin,''),
          natW, natH, cssW:+cssW.toFixed(1), cssH:+cssH.toFixed(1),
          fit: cs.objectFit, dpr,
          besoinDev: +(besoinCss*dpr).toFixed(0),
          sizes: (i.getAttribute('sizes')||i.closest('picture')?.querySelector('source')?.getAttribute('sizes')||''),
          srcset: (i.closest('picture')?.querySelector('source')?.getAttribute('srcset')||i.getAttribute('srcset')||'').split(',').map(s=>s.trim().split(' ').pop()).join('|'),
          lazy: i.loading,
        };
      });
    });

    let img=0, tot=0;
    for (const [,v] of octets) { tot+=v.n; if (/image|avif|webp|jpe?g|png|svg/.test(v.type)) img+=v.n; }
    out.push({ format:f.nom, route:r, poidsTotalKo:+(tot/1024).toFixed(1), poidsImagesKo:+(img/1024).toFixed(1), images });
    await ctx.close();
  }
}
await b.close();
writeFileSync('verif/qi-servi.json', JSON.stringify(out,null,1));

// resume lisible
for (const e of out) {
  console.log(`\n### ${e.format} ${e.route}  page ${e.poidsTotalKo} Ko / images ${e.poidsImagesKo} Ko`);
  for (const i of e.images) {
    if (!i.cssW) continue;
    const manque = i.besoinDev > i.natW ? ` MANQUE x${(i.besoinDev/i.natW).toFixed(2)}` : '';
    console.log(`  ${i.sel.padEnd(26)} css ${String(i.cssW).padStart(6)}x${String(i.cssH).padEnd(6)} nat ${i.natW}x${i.natH} fit=${i.fit} besoin ${i.besoinDev}px${manque}`);
    console.log(`      src=${i.src}  sizes="${i.sizes}"  variantes=${i.srcset}`);
  }
}
