import { chromium } from 'playwright';
const MAQ = 'file:///' + process.cwd().split(String.fromCharCode(92)).join('/').split(' ').join('%20') + '/verif/maquette.html';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

// --- A. quelle variante chaque artefact charge-t-il pour le hero ? ---
const p1 = await ctx.newPage();
console.log('--- SITE : currentSrc du hero ---');
for (const r of ['/', '/about/', '/contact/', '/training/', '/import/human-medicine/', '/import/electric-vehicles/']) {
  await p1.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
  const i = await p1.evaluate(() => { const e = document.images[0];
    return { cur: e.currentSrc.split('/').pop(), nat: e.naturalWidth + 'x' + e.naturalHeight,
             aff: Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) }; });
  console.log(r, JSON.stringify(i));
}

const p2 = await ctx.newPage();
await p2.goto(MAQ, { waitUntil: 'load' });
console.log('--- MAQUETTE : hero (data URI, on mesure la taille du blob) ---');
for (const r of ['/', '/about/', '/contact/', '/training/', '/import/human-medicine/', '/import/electric-vehicles/']) {
  await p2.evaluate((rr) => { const a = document.createElement('a'); a.href = rr; document.body.append(a); a.click(); a.remove(); }, r);
  await p2.waitForTimeout(500);
  const i = await p2.evaluate(() => { const e = document.images[0];
    return { octets: Math.round(e.src.length * 3 / 4 / 1024) + ' Ko',
             nat: e.naturalWidth + 'x' + e.naturalHeight,
             aff: Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) }; });
  console.log(r, JSON.stringify(i));
}

// --- B. /training/ : d'ou viennent les 19 px ? ---
const SONDE_FORM = () => {
  const s = [...document.querySelectorAll('section')].find((e) => e.className.includes('form-wrap'));
  if (!s) return null;
  const kids = (root, d = 0, out = []) => {
    for (const e of root.children) {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      out.push(`${'  '.repeat(d)}${e.tagName.toLowerCase()}.${e.className.toString().slice(0,28)} h=${Math.round(r.height)} w=${Math.round(r.width)} fs=${cs.fontSize} lh=${cs.lineHeight} ff=${cs.fontFamily.split(',')[0]}`);
      if (d < 3) kids(e, d + 1, out);
    }
    return out;
  };
  return { h: Math.round(s.getBoundingClientRect().height), arbre: kids(s) };
};
await p1.goto('http://localhost:4321/training/', { waitUntil: 'networkidle' });
await p1.evaluate(() => document.fonts.ready); await p1.waitForTimeout(500);
const fs_ = await p1.evaluate(SONDE_FORM);
await p2.evaluate(() => { const a = document.createElement('a'); a.href = '/training/'; document.body.append(a); a.click(); a.remove(); });
await p2.waitForTimeout(800);
const fm_ = await p2.evaluate(SONDE_FORM);
console.log('\n--- /training/ .form-wrap  site h=' + fs_.h + '  maq h=' + fm_.h + ' ---');
fs_.arbre.forEach((l, i) => { if (l !== fm_.arbre[i]) console.log('SITE ' + l + '\nMAQ  ' + fm_.arbre[i] + '\n'); });
await b.close();
