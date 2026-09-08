import { readFileSync } from 'node:fs';
const h = readFileSync('verif/maquette.html', 'utf8');
const m = h.match(/<script id="routes" type="application\/json">([\s\S]*?)<\/script>/);
const R = JSON.parse(m[1].split('<\/script').join('</script'));
console.log(JSON.stringify(Object.keys(R).sort(), null, 1));
