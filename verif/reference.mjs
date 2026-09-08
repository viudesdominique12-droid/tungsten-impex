import { chromium } from 'playwright';

const analyse = async (p, nom) => {
  const m = await p.evaluate(() => {
    const H = innerHeight, W = innerWidth;
    const total = document.documentElement.scrollHeight * W;
    const fam = (v) => {
      const n = (v.match(/[\d.]+/g) || []).map(Number);
      if (n.length > 3 && n[3] < .5) return null;
      const [r, g, b] = n;
      if (r === undefined) return null;
      if (r > 200 && g > 200 && b > 195) return 'blanc';
      if (b - r > 45) return 'bleu';
      if (r < 90 && g < 90 && b < 110) return 'encre';
      return 'autre';
    };
    const aires = { blanc: 0, bleu: 0, encre: 0, autre: 0 };
    const porteurs = {};
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      const f = fam(s.backgroundColor);
      if (!f) continue;
      const r = el.getBoundingClientRect();
      const a = r.width * (r.height);
      if (a < 100) continue;
      aires[f] += a;
      if (f === 'bleu') {
        const cle = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
        porteurs[cle] = Math.max(porteurs[cle] || 0, Math.round(a));
      }
    }
    return { total, aires, porteurs, hauteur: document.documentElement.scrollHeight };
  });
  const pc = (v) => ((v / m.total) * 100).toFixed(1) + ' %';
  console.log(`\n=== ${nom} — page de ${m.hauteur}px ===`);
  console.log(`  blanc ${pc(m.aires.blanc).padStart(7)}   bleu ${pc(m.aires.bleu).padStart(7)}   encre ${pc(m.aires.encre).padStart(7)}`);
  const top = Object.entries(m.porteurs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('  ce qui porte le bleu :', top.length ? top.map(([k, v]) => `${k} (${Math.round(v / 1000)}k px2)`).join(', ') : 'rien');
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('https://viudesdominique12-droid.github.io/zaziwe-labs/', { waitUntil: 'networkidle', timeout: 60000 });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1200);
await analyse(p, 'ZAZIWE LABS (reference du client)');
await p.screenshot({ path: 'verif/ref-zaziwe.png', fullPage: true });

const q = await ctx.newPage();
await q.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await q.evaluate(async () => { await document.fonts.ready;
  for (const i of document.querySelectorAll('img')) i.loading = 'eager';
  await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))); });
await analyse(q, 'TUNGSTEN accueil (etat actuel)');
const r = await ctx.newPage();
await r.goto('http://localhost:4321/import/electric-vehicles/', { waitUntil: 'networkidle' });
await r.evaluate(() => document.fonts.ready);
await analyse(r, 'TUNGSTEN fiche import (etat actuel)');
await b.close();
