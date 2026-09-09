import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('.', import.meta.url));
for (const n of ['pc-glass','pc-lantern','pc-medic','tel-glass','tel-lantern','tel-medic']) {
  const A = sharp(`${OUT}/zlaid-${n}-A-actuel.png`).removeAlpha().raw();
  const Bi = sharp(`${OUT}/zlaid-${n}-B-remede.png`).removeAlpha().raw();
  const [a, b] = await Promise.all([A.toBuffer({ resolveWithObject: true }), Bi.toBuffer({ resolveWithObject: true })]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) { console.log(n, 'tailles differentes'); continue; }
  let diff = 0, max = 0, somme = 0;
  for (let i = 0; i < a.data.length; i += 3) {
    const d = Math.max(Math.abs(a.data[i]-b.data[i]), Math.abs(a.data[i+1]-b.data[i+1]), Math.abs(a.data[i+2]-b.data[i+2]));
    if (d > 2) diff++;
    if (d > max) max = d;
    somme += d;
  }
  const px = a.info.width*a.info.height;
  console.log(`${n.padEnd(12)} ${a.info.width}x${a.info.height}  pixels ecartes (>2/255) : ${diff} (${(100*diff/px).toFixed(2)}%)  max ${max}/255  moyen ${(somme/px).toFixed(2)}/255`);
}
