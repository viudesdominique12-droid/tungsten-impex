import { chromium } from 'playwright';
const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const SONDE = () => {
  const w = document.querySelector('.form-wrap');
  if (!w) return { absent: true };
  const out = [];
  const marcher = (el, d) => {
    for (const k of el.children) {
      const t = k.tagName.toLowerCase();
      if (t === 'script' || t === 'style' || t === 'source') continue;
      const r = k.getBoundingClientRect(); const c = getComputedStyle(k);
      out.push({ d, t, cls: (k.getAttribute('class') || ''), id: k.id || '',
                 y: Math.round(r.y + scrollY), h: Math.round(r.height), w: Math.round(r.width),
                 disp: c.display, vis: c.visibility, mt: c.marginTop, mb: c.marginBottom,
                 pt: c.paddingTop, pb: c.paddingBottom, lh: c.lineHeight, fs: c.fontSize,
                 txt: (k.children.length ? '' : (k.textContent || '').trim().slice(0, 40)) });
      marcher(k, d + 1);
    }
  };
  marcher(w, 0);
  return { h: Math.round(w.getBoundingClientRect().height), els: out };
};
const stab = async (p) => { await p.evaluate(async () => { await document.fonts.ready; }); await p.waitForTimeout(300); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const pm = await ctx.newPage();
await pm.goto(MAQ, { waitUntil: 'load' });
await pm.evaluate(() => { const a = document.createElement('a'); a.href = '/training/'; document.body.append(a); a.click(); a.remove(); });
await stab(pm);
const M = await pm.evaluate(SONDE);
const ps = await ctx.newPage();
await ps.goto('http://localhost:4321/training/', { waitUntil: 'networkidle' });
await stab(ps);
const S = await ps.evaluate(SONDE);
console.log('form-wrap h  maq', M.h, ' site', S.h, ' nb', M.els.length, S.els.length);
for (let i = 0; i < Math.max(M.els.length, S.els.length); i++) {
  const a = M.els[i], c = S.els[i];
  if (!a || !c) { console.log(i, 'manquant', JSON.stringify(a || c)); continue; }
  const ch = [];
  for (const k of Object.keys(a)) if (String(a[k]) !== String(c[k])) ch.push(`${k} maq=${a[k]} site=${c[k]}`);
  if (ch.length) console.log(`[${i}] ${'  '.repeat(a.d)}<${a.t} class="${a.cls}" id="${a.id}"> ${ch.join(' ; ')}`);
}
await b.close();
