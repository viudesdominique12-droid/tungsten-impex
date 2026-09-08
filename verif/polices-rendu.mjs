/* Fontes REELLEMENT posees par le moteur (CDP getPlatformFonts) + couverture
   unicode-range. Fichier temporaire. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const MAQ = 'file:///' + 'C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html'.replace(/ /g, '%20');
const SITE = 'http://localhost:4321';

const s = readFileSync('C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html', 'utf8');
const raw = s.match(/<script id="routes" type="application\/json">([\s\S]*?)<\/script>/)[1];
const ROUTES = Object.keys(JSON.parse(raw.replace(/<\\\//g, '</')));

const SELS = ['h1', '.t-display', '.t-h1', '.t-h2', '.t-h3', '.t-lead', '.t-body',
  '.t-label', '.accent-mot', '.donnee__v', '.citation blockquote', '.nav__head b',
  '.mark strong', 'footer .t-label', 'body'];

const b = await chromium.launch();

async function fontsRendues(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const out = {};
  for (const sel of SELS) {
    let nodeId;
    try {
      ({ nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }));
    } catch { nodeId = 0; }
    if (!nodeId) { out[sel] = null; continue; }
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    out[sel] = fonts.map((f) => f.familyName + '(' + f.glyphCount + ')').join(' + ');
  }
  // toutes les fontes posees sur la page entiere, par element de texte
  await cdp.detach();
  return out;
}

// balayage global : chaque noeud de texte -> fonte reellement posee
const BALAYAGE = `(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const res = [];
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style')) continue;
    res.push({ tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal !== undefined ? '' : (el.className || ''), txt: t.slice(0,60), fam: getComputedStyle(el).fontFamily });
  }
  return res;
})()`;

// caracteres hors unicode-range declaree
const PLAGE = [[0x0000, 0x00FF], [0x0131, 0x0131], [0x0152, 0x0153], [0x02BB, 0x02BC],
  [0x02C6, 0x02C6], [0x02DA, 0x02DA], [0x02DC, 0x02DC], [0x0304, 0x0304], [0x0308, 0x0308],
  [0x0329, 0x0329], [0x2000, 0x206F], [0x20AC, 0x20AC], [0x2122, 0x2122],
  [0x2191, 0x2191], [0x2193, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215],
  [0xFEFF, 0xFEFF], [0xFFFD, 0xFFFD]];
const dedans = (c) => PLAGE.some(([a, z]) => c >= a && c <= z);

async function surRoute(page, route, maquette) {
  if (maquette) {
    if (route !== '/') {
      await page.evaluate((r) => {
        const a = document.createElement('a'); a.href = r; document.body.append(a); a.click(); a.remove();
      }, route);
      await page.waitForTimeout(200);
    }
  } else {
    await page.goto(SITE + route, { waitUntil: 'networkidle' });
  }
  await page.evaluate(() => document.fonts.ready);
  const rendu = await fontsRendues(page);
  const noeuds = await page.evaluate(BALAYAGE);
  return { rendu, noeuds };
}

const pm = await b.newPage({ viewport: { width: 1280, height: 900 } });
await pm.goto(MAQ);
await pm.evaluate(() => document.fonts.ready);
const ps = await b.newPage({ viewport: { width: 1280, height: 900 } });

const horsPlage = new Map();
for (const r of ROUTES) {
  const M = await surRoute(pm, r, true);
  const S = await surRoute(ps, r, false);
  const diff = [];
  for (const sel of SELS) {
    if ((M.rendu[sel] || 'absent') !== (S.rendu[sel] || 'absent')) diff.push(sel + ' : MAQ=' + M.rendu[sel] + ' SIT=' + S.rendu[sel]);
  }
  console.log('=== ' + r);
  for (const sel of SELS) if (M.rendu[sel]) console.log('   ' + sel.padEnd(22) + M.rendu[sel]);
  if (diff.length) console.log('   !! DIFF ' + JSON.stringify(diff));
  else console.log('   (identique au site servi)');

  for (const n of M.noeuds) {
    for (const ch of n.txt) {
      const c = ch.codePointAt(0);
      if (!dedans(c)) {
        const k = 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
        if (!horsPlage.has(k)) horsPlage.set(k, { ch, exemples: [] });
        const e = horsPlage.get(k);
        if (e.exemples.length < 3) e.exemples.push(r + ' <' + n.tag + ' class="' + n.cls + '"> ' + n.txt);
      }
    }
  }
}
console.log('\n### caracteres HORS unicode-range declaree');
if (!horsPlage.size) console.log('   aucun');
for (const [k, v] of horsPlage) console.log('   ' + k + ' « ' + v.ch + ' »\n      ' + v.exemples.join('\n      '));

await b.close();
