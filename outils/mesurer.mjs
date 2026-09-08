import sharp from 'sharp';
import { readdirSync } from 'node:fs';

/* On mesure avant de corriger. Pour chaque fichier : le point noir et le point
   blanc de chaque canal (centiles 1 et 99 sur une version reduite, pour ne pas
   se faire piloter par quelques pixels brules), la luminance moyenne et la
   saturation moyenne. La dominante se lit a l'ecart entre les points blancs. */
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

const lignes = [];
for (const dir of ['company', 'products']) {
  for (const f of readdirSync(`src/img/${dir}`).filter((n) => n.endsWith('.jpg'))) {
    const { data, info } = await sharp(`src/img/${dir}/${f}`)
      .resize(200, null, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = [[], [], []];
    let lum = 0, sat = 0, n = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      ch[0].push(r); ch[1].push(g); ch[2].push(b);
      lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sat += mx === 0 ? 0 : (mx - mn) / mx;
      n++;
    }
    ch.forEach((c) => c.sort((a, b) => a - b));
    const p1 = ch.map((c) => pct(c, 0.01));
    const p99 = ch.map((c) => pct(c, 0.99));
    const ecart = Math.max(...p99) - Math.min(...p99);
    lignes.push({ dir, f, p1, p99, lum: lum / n, sat: sat / n, ecart, etendue: Math.min(...p99.map((v, i) => v - p1[i])) });
  }
}
console.log('fichier'.padEnd(32) + 'point noir RVB   point blanc RVB   lum   sat   ecart-blanc  etendue');
for (const l of lignes.sort((a, b) => b.ecart - a.ecart)) {
  const flag = l.ecart >= 25 ? '  <<< dominante' : (l.lum > 170 && l.sat < 0.22 ? '  <<< plat et pale' : '');
  console.log(
    `${(l.dir[0] + '/' + l.f).padEnd(32)}${l.p1.map(v=>String(v).padStart(4)).join('')}   ${l.p99.map(v=>String(v).padStart(4)).join('')}` +
    `  ${String(Math.round(l.lum)).padStart(4)}  ${l.sat.toFixed(2)}   ${String(l.ecart).padStart(4)}        ${String(l.etendue).padStart(4)}${flag}`);
}
