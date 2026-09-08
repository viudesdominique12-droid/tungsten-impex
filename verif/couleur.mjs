import { chromium } from 'playwright';

/* Part du bleu dans la surface peinte, page par page. Le client compare notre
   site au sien : sa reference porte 10,3 % de bleu. C'est la cible. */
const analyse = async (p, nom) => {
  const m = await p.evaluate(() => {
    const W = innerWidth;
    const total = document.documentElement.scrollHeight * W;
    const fam = (v) => {
      const n = (v.match(/[\d.]+/g) || []).map(Number);
      if (n.length > 3 && n[3] < 0.5) return null;
      const [r, g, b] = n;
      if (r === undefined) return null;
      if (r > 200 && g > 200 && b > 195) return 'blanc';
      if (b - r > 45) return 'bleu';
      if (r < 90 && g < 90 && b < 110) return 'encre';
      return 'autre';
    };
    const a = { blanc: 0, bleu: 0, encre: 0, autre: 0 };
    const porteurs = {};
    for (const el of document.querySelectorAll('body *')) {
      const f = fam(getComputedStyle(el).backgroundColor);
      if (!f) continue;
      const r = el.getBoundingClientRect();
      const s = r.width * r.height;
      if (s < 100) continue;
      a[f] += s;
      if (f === 'bleu') {
        const k = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
        porteurs[k] = Math.max(porteurs[k] || 0, Math.round(s));
      }
    }
    return { total, a, porteurs };
  });
  const pc = (v) => ((v / m.total) * 100).toFixed(1) + ' %';
  const top = Object.entries(m.porteurs).sort((x, y) => y[1] - x[1]).slice(0, 3);
  console.log(`${nom.padEnd(16)} blanc ${pc(m.a.blanc).padStart(7)}   bleu ${pc(m.a.bleu).padStart(7)}` +
              `   encre ${pc(m.a.encre).padStart(7)}   ${top.map(([k, v]) => `${k} ${Math.round(v / 1000)}k`).join('  ')}`);
  return (m.a.bleu / m.total) * 100;
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const pages = [['/', 'accueil'], ['/import/electric-vehicles/', 'fiche import'],
               ['/export/niger-seed-noug/', 'fiche export'], ['/about/', 'a propos'],
               ['/contact/', 'contact'], ['/training/', 'formation']];
let pire = 0;
for (const [u, nom] of pages) {
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  pire = Math.max(pire, await analyse(p, nom));
  await p.close();
}
console.log(`\npart de bleu la plus forte : ${pire.toFixed(1)} %   (reference du client : 10,3 %)`);
await b.close();
