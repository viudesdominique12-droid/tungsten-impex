import { webkit, chromium } from 'playwright';
const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
for (const [nom, nav] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await nav.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(MAQ, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const t = document.body.innerText;
    const tirets = (t.match(/\u2014/g) || []).length;
    const mojibake = (t.match(/\u00e2\u0080|\u00c3|\uFFFD/g) || []).length;
    const g = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { bg: c.backgroundColor, encre: c.getPropertyValue('--encre').trim() }; };
    return { compatMode: document.compatMode, charset: document.characterSet,
             tirets, mojibake, extrait: t.slice(0, 120).replace(/\s+/g, ' '),
             nuit: g('[data-sol="nuit"]'), accent: g('[data-sol="accent"]'),
             carte: (() => { const e = document.querySelector('.carte'); return e ? getComputedStyle(e).borderRadius : null; })(),
             editoT: (() => { const e = document.querySelector('.edito__t'); return e ? getComputedStyle(e).position : null; })(),
             filet: (() => { const e = document.querySelector('.index__l'); return e ? getComputedStyle(e).borderTopWidth + ' ' + getComputedStyle(e).borderTopColor : null; })(),
             types: [...document.querySelectorAll('[data-type]')].map((e) => e.getAttribute('data-type')).join(''),
             fonte: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0] };
  });
  console.log(nom, JSON.stringify(m));
  await b.close();
}
