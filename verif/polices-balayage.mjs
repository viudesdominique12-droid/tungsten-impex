/* Balayage exhaustif : pour CHAQUE element porteur de texte, la fonte
   reellement posee par le moteur vs la famille demandee par la CSS.
   Detecte aussi le gras et l'italique synthetiques. Fichier temporaire. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const MAQ = 'file:///' + 'C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html'.replace(/ /g, '%20');
const SITE = 'http://localhost:4321';
const s = readFileSync('C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html', 'utf8');
const raw = s.match(/<script id="routes" type="application\/json">([\s\S]*?)<\/script>/)[1];
const ROUTES = Object.keys(JSON.parse(raw.replace(/<\\\//g, '</')));

const ATTENDU = { 'Fraunces': 'Fraunces', 'Instrument Sans': 'Instrument Sans', 'Plex Mono': 'IBM Plex Mono' };
// plages de poids reellement declarees par les @font-face
const POIDS = { 'Fraunces': [100, 900], 'Instrument Sans': [400, 700], 'Plex Mono': [400, 400] };

const b = await chromium.launch();

async function auditer(page) {
  await page.evaluate(() => {
    let i = 0;
    document.querySelectorAll('[data-fq]').forEach((e) => e.removeAttribute('data-fq'));
    for (const e of document.querySelectorAll('body *')) {
      if (e.closest('script,style,noscript,svg')) continue;
      const direct = [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (!direct) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      e.setAttribute('data-fq', String(++i));
    }
  });
  const meta = await page.evaluate(() => {
    const out = {};
    for (const e of document.querySelectorAll('[data-fq]')) {
      const cs = getComputedStyle(e);
      out[e.getAttribute('data-fq')] = {
        tag: e.tagName.toLowerCase(),
        cls: typeof e.className === 'string' ? e.className : '',
        txt: [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim().slice(0, 50),
        fam: cs.fontFamily, w: cs.fontWeight, st: cs.fontStyle, sz: cs.fontSize,
      };
    }
    return out;
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-fq]' });
  const res = [];
  for (const id of nodeIds) {
    const { attributes } = await cdp.send('DOM.getAttributes', { nodeId: id });
    const k = attributes[attributes.indexOf('data-fq') + 1];
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id });
    res.push({ ...meta[k], fonts: fonts.map((f) => ({ n: f.familyName, g: f.glyphCount })) });
  }
  await cdp.detach();
  return res;
}

function juger(e) {
  const prem = (e.fam.split(',')[0] || '').replace(/^["']|["']$/g, '').trim();
  const att = ATTENDU[prem];
  if (!att) return null;               // pile qui ne commence pas par une des trois
  const total = e.fonts.reduce((a, f) => a + f.g, 0) || 1;
  const bonnes = e.fonts.filter((f) => f.n === att).reduce((a, f) => a + f.g, 0);
  const etrangeres = e.fonts.filter((f) => f.n !== att);
  const pb = [];
  if (etrangeres.length) {
    pb.push('fallback ' + etrangeres.map((f) => f.n + '(' + f.g + '/' + total + ')').join(','));
  }
  const [lo, hi] = POIDS[prem];
  const w = parseInt(e.w, 10);
  if (w > hi + 0.5) pb.push('poids ' + w + ' hors face declaree ' + lo + '-' + hi + ' -> gras synthetique');
  return pb.length ? { ...e, att, pb } : null;
}

async function ouvrir(route, maq, page) {
  if (maq) {
    await page.evaluate((r) => {
      const a = document.createElement('a'); a.href = r; document.body.append(a); a.click(); a.remove();
    }, route);
    await page.waitForTimeout(220);
  } else {
    await page.goto(SITE + route, { waitUntil: 'networkidle' });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
}

for (const vp of [{ width: 1280, height: 900, nom: 'bureau' }, { width: 390, height: 844, nom: 'mobile' }]) {
  console.log('\n############ ' + vp.nom + ' ' + vp.width + 'x' + vp.height);
  const pm = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
  await pm.goto(MAQ); await pm.evaluate(() => document.fonts.ready);
  const ps = await b.newPage({ viewport: { width: vp.width, height: vp.height } });

  for (const r of ROUTES) {
    await ouvrir(r, true, pm);
    await ouvrir(r, false, ps);
    const M = (await auditer(pm)).map(juger).filter(Boolean);
    const S = (await auditer(ps)).map(juger).filter(Boolean);
    const cle = (x) => x.tag + '.' + x.cls + '|' + x.txt + '|' + x.pb.join(';');
    const sSet = new Set(S.map(cle));
    if (!M.length && !S.length) continue;
    console.log('--- ' + r);
    for (const x of M) {
      console.log('   ' + (sSet.has(cle(x)) ? '[les deux] ' : '[MAQUETTE SEULE] ')
        + '<' + x.tag + ' class="' + x.cls + '"> ' + x.sz + '/' + x.w + '/' + x.st
        + ' « ' + x.txt + ' » -> ' + x.pb.join(' + '));
    }
    const mSet = new Set(M.map(cle));
    for (const x of S) if (!mSet.has(cle(x))) {
      console.log('   [SITE SEUL] <' + x.tag + ' class="' + x.cls + '"> ' + x.sz + '/' + x.w
        + ' « ' + x.txt + ' » -> ' + x.pb.join(' + '));
    }
  }
  await pm.close(); await ps.close();
}
await b.close();
