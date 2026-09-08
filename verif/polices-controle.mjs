/* Controle du controle : le balayage voit-il quelque chose ? Et le « o macron »
   de nattō tombe-t-il vraiment en fonte de secours ? Fichier temporaire. */
import { chromium } from 'playwright';

const MAQ = 'file:///' + 'C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html'.replace(/ /g, '%20');
const SITE = 'http://localhost:4321';
const b = await chromium.launch();

async function compte(page) {
  return page.evaluate(() => {
    let n = 0, avecTexte = 0;
    for (const e of document.querySelectorAll('body *')) {
      if (e.closest('script,style,noscript,svg')) continue;
      n++;
      const direct = [...e.childNodes].some((x) => x.nodeType === 3 && x.nodeValue.trim());
      if (!direct) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      avecTexte++;
    }
    return { n, avecTexte };
  });
}

async function fontesDe(page, sel) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
  const out = [];
  for (const id of nodeIds) {
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id });
    out.push(fonts.map((f) => f.familyName + '(' + f.glyphCount + ')').join(' + '));
  }
  await cdp.detach();
  return out;
}

/* Sonde temoin : on injecte un mot que la plage NE COUVRE PAS (kanji) et un mot
   qu'elle couvre, dans le meme style que .t-body. Si le balayage est capable de
   voir un fallback, il doit le voir ici. */
const TEMOIN = () => {
  const p = document.createElement('p');
  p.className = 't-body';
  p.id = 'temoin-fallback';
  p.textContent = 'abc \u65E5\u672C\u8A9E def';           // latin + japonais
  document.body.append(p);
  const q = document.createElement('p');
  q.className = 't-body';
  q.id = 'temoin-macron';
  q.textContent = 'natt\u014D natt\u014D natt\u014D';      // o macron, hors plage
  document.body.append(q);
  const r = document.createElement('p');
  r.className = 't-body';
  r.id = 'temoin-o';
  r.textContent = 'natto natto natto';                     // o simple, dans la plage
  document.body.append(r);
  return {
    macron: document.getElementById('temoin-macron').getBoundingClientRect().width,
    simple: document.getElementById('temoin-o').getBoundingClientRect().width,
  };
};

for (const [nom, url, maq] of [['MAQUETTE', MAQ, true], ['SITE    ', SITE + '/export/soya-bean/', false]]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(url);
  await p.evaluate(() => document.fonts.ready);
  if (maq) {
    await p.evaluate(() => { const a = document.createElement('a'); a.href = '/export/soya-bean/'; document.body.append(a); a.click(); a.remove(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.fonts.ready);
  }
  console.log('\n### ' + nom);
  console.log('  elements balayes :', JSON.stringify(await compte(p)));
  const larg = await p.evaluate(TEMOIN);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  console.log('  temoin japonais  :', (await fontesDe(p, '#temoin-fallback')).join(' | '));
  console.log('  temoin natto\u014D    :', (await fontesDe(p, '#temoin-macron')).join(' | '));
  console.log('  temoin natto     :', (await fontesDe(p, '#temoin-o')).join(' | '));
  console.log('  largeurs macron/simple :', JSON.stringify(larg), 'ecart =', (larg.macron - larg.simple).toFixed(2), 'px');
  // le vrai dd de la page
  const dd = await p.evaluate(() => {
    const e = [...document.querySelectorAll('dd')].find((x) => /\u014D/.test(x.textContent));
    if (!e) return null;
    e.id = 'dd-macron';
    return { txt: e.textContent.trim(), fam: getComputedStyle(e).fontFamily };
  });
  console.log('  dd reel          :', JSON.stringify(dd));
  if (dd) console.log('  dd fontes posees :', (await fontesDe(p, '#dd-macron')).join(' | '));
  await p.close();
}
await b.close();
