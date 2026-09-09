import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('.', import.meta.url));
// loupe 4x sur la zone de plus fort ecart, A au-dessus, B au-dessous
const jeux = [
  ['pc-lantern', 150, 90, 160, 110],
  ['pc-glass', 210, 120, 160, 110],
  ['tel-lantern', 210, 140, 200, 130],
];
for (const [n, x, y, w, h] of jeux) {
  const crops = [];
  for (const v of ['A-actuel', 'B-remede']) {
    crops.push(await sharp(`${OUT}/zlaid-${n}-${v}.png`)
      .extract({ left: x, top: y, width: w, height: h })
      .resize({ width: w*4, kernel: 'nearest' }).png().toBuffer());
  }
  await sharp({ create: { width: w*4, height: h*8 + 8, channels: 3, background: '#c00' } })
    .composite([{ input: crops[0], top: 0, left: 0 }, { input: crops[1], top: h*4 + 8, left: 0 }])
    .png().toFile(`${OUT}/zlaid-loupe-${n}.png`);
  console.log('loupe', n);
}
