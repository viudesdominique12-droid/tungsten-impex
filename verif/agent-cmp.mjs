import { readFileSync } from 'node:fs';
const D = JSON.parse(readFileSync('verif/agent-sols.json', 'utf8'));
const { routes, maquette: M, site: S } = D;

const ATTENDU = {
  nuit:   'rgb(10, 27, 60)',
  'nuit-2': 'rgb(18, 38, 77)',
  accent: 'rgb(27, 63, 166)',
  wash:   'rgb(220, 231, 244)',
  surface: 'rgb(251, 253, 255)',
};

console.log('===== 1. data-sol : couleur reellement peinte =====');
const manquants = [];
for (const r of routes) {
  const m = M[r].sols, s = S[r].sols;
  if (m.length !== s.length) console.log(`  !! ${r} nb [data-sol] maquette=${m.length} site=${s.length}`);
  for (let i = 0; i < Math.min(m.length, s.length); i++) {
    const a = m[i], b = s[i];
    const att = ATTENDU[a.sol];
    const pbs = [];
    if (a.bg !== b.bg) pbs.push(`bg maq=${a.bg} site=${b.bg}`);
    if (att && a.bg !== att) pbs.push(`bg maq=${a.bg} attendu=${att}`);
    if (a.vEncre !== b.vEncre) pbs.push(`--encre maq=${a.vEncre} site=${b.vEncre}`);
    if (a.vGris !== b.vGris) pbs.push(`--gris maq=${a.vGris} site=${b.vGris}`);
    if (a.vFilet !== b.vFilet) pbs.push(`--filet maq=${a.vFilet} site=${b.vFilet}`);
    if (a.color !== b.color) pbs.push(`color maq=${a.color} site=${b.color}`);
    if (pbs.length) { console.log(`  ${r} [${i}] sol=${a.sol} .${a.cls} -> ${pbs.join(' | ')}`); manquants.push(r); }
  }
}
if (!manquants.length) console.log('  aucun ecart de sol');

console.log('\n===== 2. sols : inventaire par valeur (maquette) =====');
const parSol = {};
for (const r of routes) for (const x of M[r].sols) {
  parSol[x.sol] = parSol[x.sol] || new Set();
  parSol[x.sol].add(x.bg);
}
for (const [k, v] of Object.entries(parSol)) console.log(`  ${k.padEnd(9)} -> ${[...v].join(' , ')}  (attendu ${ATTENDU[k] || '?'})`);

console.log('\n===== 3. [data-type] =====');
for (const r of routes) {
  const m = M[r].types, s = S[r].types;
  if (!m.length && !s.length) continue;
  console.log(`  ${r} maq=${m.map((x) => x.type).join('')} site=${s.map((x) => x.type).join('')}`);
  for (let i = 0; i < Math.max(m.length, s.length); i++) {
    const a = m[i], b = s[i];
    if (!a || !b) { console.log(`    !! index ${i} manquant d'un cote`); continue; }
    if (a.bg !== b.bg || a.sol !== b.sol)
      console.log(`    !! ${i} type=${a.type} sol maq=${a.sol}/${a.bg} site=${b.sol}/${b.bg}`);
  }
  const seq = m.map((x) => x.type);
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) console.log(`    !! deux voisines de meme type: ${seq[i]} en ${i}`);
}

console.log('\n===== 4. filets .index__l =====');
for (const r of routes) {
  const m = M[r].index, s = S[r].index;
  if (!m.length && !s.length) continue;
  const u = (arr) => [...new Set(arr.map((x) => x.top))];
  console.log(`  ${r} n=${m.length}/${s.length}`);
  console.log(`     maq  ${u(m).join(' | ')}`);
  console.log(`     site ${u(s).join(' | ')}`);
  const ca = [...new Set(m.map((x) => x.areas))], cb = [...new Set(s.map((x) => x.areas))];
  if (JSON.stringify(ca) !== JSON.stringify(cb)) console.log(`     !! areas maq=${ca} site=${cb}`);
  const co = [...new Set(m.map((x) => x.cols))], cs2 = [...new Set(s.map((x) => x.cols))];
  if (JSON.stringify(co) !== JSON.stringify(cs2)) console.log(`     !! cols maq=${co} site=${cs2}`);
}

console.log('\n===== 5. .carte rayon en goutte =====');
for (const r of routes) {
  const m = M[r].cartes, s = S[r].cartes;
  if (!m.length && !s.length) continue;
  const u = (a) => [...new Set(a.map((x) => x.radius + '  bg=' + x.bg))];
  console.log(`  ${r} n=${m.length}/${s.length}`);
  console.log(`     maq  ${u(m).join(' | ')}`);
  console.log(`     site ${u(s).join(' | ')}`);
}

console.log('\n===== 6. .edito__t collant =====');
for (const r of routes) {
  const m = M[r].edito, s = S[r].edito;
  if (!m.length && !s.length) continue;
  console.log(`  ${r} maq=${JSON.stringify(m)}`);
  console.log(`      site=${JSON.stringify(s)}`);
}

console.log('\n===== 7. .donnees / .ruban / .pleine / .citation =====');
for (const r of routes) {
  for (const k of ['donnees', 'ruban', 'pleine', 'citation']) {
    const a = JSON.stringify(M[r][k]), b = JSON.stringify(S[r][k]);
    if (a === b) continue;
    console.log(`  ${r} ${k}\n     maq  ${a}\n     site ${b}`);
  }
}

console.log('\n===== 8. part sombre =====');
for (const r of routes) {
  const f = (o) => ({ nuit: (o.surface.nuit / o.surface.total * 100), accent: (o.surface.accent / o.surface.total * 100), clair: (o.surface.clair / o.surface.total * 100) });
  const a = f(M[r]), b = f(S[r]);
  const sombreM = a.nuit + a.accent, sombreS = b.nuit + b.accent;
  console.log(`  ${r.padEnd(34)} maq nuit ${a.nuit.toFixed(1)}% acc ${a.accent.toFixed(1)}% clair ${a.clair.toFixed(1)}% | site nuit ${b.nuit.toFixed(1)}% acc ${b.accent.toFixed(1)}% clair ${b.clair.toFixed(1)}%  | sombre maq ${sombreM.toFixed(1)}% site ${sombreS.toFixed(1)}%  | H maq ${M[r].scrollH} site ${S[r].scrollH}`);
}

console.log('\n===== 9. body bg / --filet racine =====');
for (const r of routes) {
  if (M[r].bodyBg !== S[r].bodyBg || M[r].rootFilet !== S[r].rootFilet)
    console.log(`  ${r} bodyBg maq=${M[r].bodyBg} site=${S[r].bodyBg} | filet maq=${M[r].rootFilet} site=${S[r].rootFilet}`);
}
