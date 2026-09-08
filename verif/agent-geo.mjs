/* Diff geometrique element par element, maquette VS site, sur les 18 routes. */
import { chromium } from 'playwright';
const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 900);

const SONDE = () => {
  const out = [];
  const racine = document.getElementById('app') || document.body;
  const marcher = (el) => {
    for (const k of el.children) {
      const t = k.tagName.toLowerCase();
      if (t === 'script' || t === 'style' || t === 'link' || t === 'noscript' || t === 'source') continue;
      const r = k.getBoundingClientRect();
      const c = getComputedStyle(k);
      out.push([t, (k.getAttribute('class') || '').trim(),
                Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height),
                c.backgroundColor, c.color, c.fontFamily.split(',')[0].replace(/"/g, ''), c.fontSize,
                c.display, c.position]);
      marcher(k);
    }
  };
  marcher(racine);
  return { els: out, h: document.documentElement.scrollHeight };
};

const stab = async (p) => {
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    // fige le ruban defilant pour que la geometrie soit comparable
    for (const el of document.querySelectorAll('.ruban__piste')) el.style.animationPlayState = 'paused';
  });
  await p.waitForTimeout(200);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
const pm = await ctx.newPage();
await pm.goto(MAQ, { waitUntil: 'load' });
const routes = await pm.evaluate(() => Object.keys(JSON.parse(document.getElementById('routes').textContent)).sort());

let total = 0;
for (const r of routes) {
  await pm.evaluate((rr) => { const a = document.createElement('a'); a.href = rr; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); }, r);
  await stab(pm);
  const m = await pm.evaluate(SONDE);
  const ps = await ctx.newPage();
  await ps.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
  await stab(ps);
  const s = await ps.evaluate(SONDE);
  await ps.close();

  const diffs = [];
  if (m.els.length !== s.els.length) diffs.push(`NB ELEMENTS maq=${m.els.length} site=${s.els.length}`);
  const n = Math.min(m.els.length, s.els.length);
  for (let i = 0; i < n; i++) {
    const a = m.els[i], c = s.els[i];
    const ch = [];
    const noms = ['tag', 'class', 'x', 'y', 'w', 'h', 'bg', 'color', 'font', 'size', 'display', 'position'];
    for (let j = 0; j < a.length; j++) {
      if (a[j] === c[j]) continue;
      if (j >= 2 && j <= 5 && Math.abs(a[j] - c[j]) <= 1) continue;
      ch.push(`${noms[j]} maq=${a[j]} site=${c[j]}`);
    }
    if (ch.length) diffs.push(`[${i}] <${a[0]} class="${a[1].slice(0, 60)}"> ${ch.join(' ; ')}`);
  }
  if (m.h !== s.h) diffs.push(`scrollHeight maq=${m.h} site=${s.h}`);
  total += diffs.length;
  if (diffs.length) {
    console.log(`\n### ${r}  (${W}px) — ${diffs.length} ecart(s)`);
    for (const d of diffs.slice(0, 25)) console.log('   ' + d);
    if (diffs.length > 25) console.log(`   ... et ${diffs.length - 25} de plus`);
  }
}
console.log(`\n[${W}px] total ecarts : ${total}`);
await b.close();
