/* SCEPTIQUE — combien pese vraiment la ressource si on suit le remede ?
   Le defaut annonce 12,3 Ko « payes pour rien ». L'economie reelle,
   c'est 340px moins 232px, pas 12,3 Ko. On mesure. */
import sharp from 'sharp';
const SRC = 'src/img/company/mot-symbole.png';
const EMB = 'src/img/company/embleme.png';

async function pese(f, w) {
  // memes reglages que la sortie d'Astro (webp par defaut, qualite 80)
  const b = await sharp(f).resize({ width: w }).webp({ quality: 80 }).toBuffer();
  return b.length;
}

console.log('--- mot-symbole 852x220 -> webp q80');
for (const w of [116, 170, 193, 232, 340]) {
  const o = await pese(SRC, w);
  console.log(String(w).padStart(4) + 'px  ' + String(o).padStart(6) + ' o  ' + (o/1024).toFixed(1) + ' Ko');
}
console.log('--- embleme 256x256 -> webp q80');
for (const w of [44, 72, 88]) {
  const o = await pese(EMB, w);
  console.log(String(w).padStart(4) + 'px  ' + String(o).padStart(6) + ' o  ' + (o/1024).toFixed(1) + ' Ko');
}
