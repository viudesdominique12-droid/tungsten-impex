/* naturalWidth est corrige par la densite quand l'image vient d'un srcset en w.
   On mesure donc les VRAIS pixels via createImageBitmap. */
import { chromium } from 'playwright';
const MAQ = 'file:///' + process.cwd().split(String.fromCharCode(92)).join('/').split(' ').join('%20') + '/verif/maquette.html';
const R = ['/', '/about/', '/contact/', '/training/', '/import/human-medicine/', '/import/electric-vehicles/'];
const VRAI = async () => {
  const out = [];
  for (const e of document.images) {
    const r = e.getBoundingClientRect();
    let bm = null;
    try { const b = await fetch(e.currentSrc).then((x) => x.blob()); bm = await createImageBitmap(b); } catch (_) {}
    out.push({
      fichier: e.currentSrc.startsWith('data:') ? 'data:' + Math.round(e.currentSrc.length * 3 / 4 / 1024) + 'Ko' : e.currentSrc.split('/').pop(),
      pixels: bm ? bm.width + 'x' + bm.height : '?',
      declare: e.naturalWidth + 'x' + e.naturalHeight,
      affiche: Math.round(r.width) + 'x' + Math.round(r.height),
      alt: e.alt.slice(0, 30),
    });
  }
  return out;
};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p1 = await ctx.newPage(), p2 = await ctx.newPage();
await p2.goto(MAQ, { waitUntil: 'load' });
for (const r of R) {
  await p1.goto('http://localhost:4321' + r, { waitUntil: 'networkidle' });
  await p1.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 500) { scrollTo(0, y); await new Promise(z => setTimeout(z, 25)); } scrollTo(0, 0); });
  await p1.waitForTimeout(600);
  const S = await p1.evaluate(VRAI);
  await p2.evaluate((rr) => { const a = document.createElement('a'); a.href = rr; document.body.append(a); a.click(); a.remove(); }, r);
  await p2.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 500) { scrollTo(0, y); await new Promise(z => setTimeout(z, 25)); } scrollTo(0, 0); });
  await p2.waitForTimeout(600);
  const M = await p2.evaluate(VRAI);
  console.log('\n=== ' + r);
  S.forEach((s, i) => {
    const m = M[i] || {};
    const flag = s.pixels !== m.pixels ? '  <<< PIXELS DIFFERENTS' : '';
    console.log(`  [${i}] ${s.alt}\n      site: ${s.pixels} px reels (${s.fichier}) affiche ${s.affiche}\n      maq : ${m.pixels} px reels (${m.fichier}) affiche ${m.affiche}${flag}`);
  });
}
await b.close();
