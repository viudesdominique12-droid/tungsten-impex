import { readFileSync } from 'node:fs';
const { site, maq } = JSON.parse(readFileSync('verif/parite-tmp/fin.json', 'utf8'));
console.log('route | i | site naturel | maq naturel | affiche | facteur upscale maq');
let n = 0;
for (const r of Object.keys(site)) {
  site[r].imgDim.forEach((v, i) => {
    const w = maq[r].imgDim[i];
    if (v === w) return;
    const [sn, aff] = v.split('->'); const [mn] = w.split('->');
    const affW = parseInt(aff);
    const f = (affW / parseInt(mn)).toFixed(2);
    const fs = (affW / parseInt(sn)).toFixed(2);
    n++;
    console.log(`${r} | [${i}] | ${sn} (x${fs}) | ${mn} (x${f}) | ${aff}`);
  });
}
console.log(`\n${n} image(s) degradees`);
