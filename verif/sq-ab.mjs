/* SCEPTIQUE — les 4,7 Ko de plus achetent-ils quelque chose a l'oeil ?
   A = la ressource servie aujourd'hui (340px), B = celle du remede (232px),
   les deux rendues a la taille reelle du telephone : 96,6 x 25 CSS, DPR 2. */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

const SRC = 'src/img/company/mot-symbole.png';
for (const w of [340, 232]) {
  const b = await sharp(SRC).resize({ width: w }).webp({ quality: 80 }).toBuffer();
  writeFileSync(`verif/sq-tmp-${w}.webp`, b);
  console.log(w + 'px = ' + b.length + ' o');
}

const html = `<!doctype html><meta charset=utf-8>
<style>
 body{margin:0;background:#F1F3F8;font:12px/1 monospace;color:#0A1B3C}
 .l{padding:14px 16px}
 img{height:25px;width:auto;display:block;image-rendering:auto}
 .z{margin-top:6px}
 .z img{height:100px;image-rendering:pixelated}
 hr{border:0;border-top:1px solid rgba(10,26,51,.15)}
</style>
<div class=l>A — servi aujourd'hui : 340px (12 572 o)
 <img src="sq-tmp-340.webp"></div><hr>
<div class=l>B — remede : 232px (7 824 o)
 <img src="sq-tmp-232.webp"></div><hr>
<div class="l z">A agrandi 4x (pixels reels du rendu 25px)
 <img src="sq-tmp-340.webp"></div><hr>
<div class="l z">B agrandi 4x
 <img src="sq-tmp-232.webp"></div>`;
writeFileSync('verif/sq-ab.html', html);

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 560 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(pathToFileURL('verif/sq-ab.html').href,
  { waitUntil: 'networkidle' });
await page.screenshot({ path: 'verif/sq-ab-tel.png', fullPage: true });
await nav.close();
console.log('capture ecrite');
