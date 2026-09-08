/* 2e passe : navigation corrigee (on va TOUJOURS sur la route, / compris),
   italique reelle vs oblique synthetique, et le caractere hors plage.
   Fichier temporaire. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const MAQ = 'file:///' + 'C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html'.replace(/ /g, '%20');
const SITE = 'http://localhost:4321';

const b = await chromium.launch();

async function platform(page, sel) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const r = {};
  for (const s of sel) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: s });
    if (!nodeId) { r[s] = 'ABSENT'; continue; }
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    r[s] = fonts.length ? fonts.map((f) => f.familyName + '(' + f.glyphCount + ')').join(' + ') : 'AUCUNE';
  }
  await cdp.detach();
  return r;
}

const ITAL = () => {
  const acc = document.querySelector('.accent-mot');
  if (!acc) return { absent: true };
  const r0 = acc.getBoundingClientRect();
  const av = { w: r0.width, style: getComputedStyle(acc).fontStyle };
  // font-synthesis: none -> si aucune vraie italique n'existe, le mot redevient droit
  acc.style.fontSynthesis = 'none';
  acc.style.setProperty('font-synthesis-style', 'none');
  const r1 = acc.getBoundingClientRect();
  const apres = { w: r1.width };
  // reference : le meme mot force en droit
  acc.style.fontStyle = 'normal';
  const r2 = acc.getBoundingClientRect();
  const droit = { w: r2.width };
  acc.style.fontStyle = '';
  acc.style.fontSynthesis = '';
  acc.style.removeProperty('font-synthesis-style');
  return { mot: acc.textContent.trim(), av, apres, droit,
           vraieItalique: Math.abs(av.w - apres.w) < 0.5 && Math.abs(av.w - droit.w) > 0.5 };
};

async function ouvrir(route, maquette) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  if (maquette) {
    await p.goto(MAQ);
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate((r) => {
      const a = document.createElement('a'); a.href = r; document.body.append(a); a.click(); a.remove();
    }, route);
    await p.waitForTimeout(300);
  } else {
    await p.goto(SITE + route, { waitUntil: 'networkidle' });
  }
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  return p;
}

const SELS = ['h1', '.accent-mot', '.t-display', '.t-h1', '.t-h2', '.t-label', '.donnee__v',
  '.citation blockquote', '.depart__h', '.ruban span', '.donnee__k'];

for (const route of ['/', '/about/', '/training/', '/contact/']) {
  console.log('\n===================== ' + route);
  for (const [nom, maq] of [['MAQUETTE', true], ['SITE    ', false]]) {
    const p = await ouvrir(route, maq);
    const url = await p.evaluate(() => document.title);
    const pf = await platform(p, SELS);
    const it = await p.evaluate(ITAL);
    console.log('  ' + nom + '  titre=' + JSON.stringify(url));
    for (const s of SELS) if (pf[s] !== 'ABSENT') console.log('      ' + s.padEnd(22) + pf[s]);
    console.log('      ITALIQUE ' + JSON.stringify(it));
    await p.close();
  }
}

/* le caractere hors plage */
console.log('\n===================== U+014D dans /export/soya-bean/');
for (const [nom, maq] of [['MAQUETTE', true], ['SITE    ', false]]) {
  const p = await ouvrir('/export/soya-bean/', maq);
  const info = await p.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter((e) =>
      [...e.childNodes].some((n) => n.nodeType === 3 && /\u014D/.test(n.nodeValue)));
    return els.map((e) => ({ tag: e.tagName, cls: e.className, txt: e.textContent.trim().slice(0, 60),
                             fam: getComputedStyle(e).fontFamily }));
  });
  console.log('  ' + nom + ' ' + JSON.stringify(info));
  if (info.length) {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'dd' });
    for (const id of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id });
      const noms = fonts.map((f) => f.familyName + '(' + f.glyphCount + ')').join(' + ');
      if (fonts.length > 1) console.log('      dd multi-fonte -> ' + noms);
    }
    await cdp.detach();
  }
  await p.close();
}

await b.close();
