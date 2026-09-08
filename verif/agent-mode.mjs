import { chromium, devices } from 'playwright';
const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';

const b = await chromium.launch();

/* --- 1. mode de rendu + charset --- */
const c1 = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p1 = await c1.newPage();
await p1.goto(MAQ, { waitUntil: 'load' });
console.log('maquette  compatMode =', await p1.evaluate(() => document.compatMode),
            ' characterSet =', await p1.evaluate(() => document.characterSet),
            ' doctype =', await p1.evaluate(() => String(document.doctype)),
            ' lang =', await p1.evaluate(() => document.documentElement.lang || '(vide)'),
            ' viewportMeta =', await p1.evaluate(() => !!document.querySelector('meta[name=viewport]')));
const p2 = await c1.newPage();
await p2.goto('http://localhost:4321/', { waitUntil: 'load' });
console.log('site      compatMode =', await p2.evaluate(() => document.compatMode),
            ' characterSet =', await p2.evaluate(() => document.characterSet),
            ' doctype =', await p2.evaluate(() => String(document.doctype)),
            ' lang =', await p2.evaluate(() => document.documentElement.lang || '(vide)'),
            ' viewportMeta =', await p2.evaluate(() => !!document.querySelector('meta[name=viewport]')));

/* texte : les tirets cadratins et apostrophes typographiques */
const lireCodes = (p) => p.evaluate(() => [...document.querySelectorAll('.code, .t-label')].slice(0, 6).map((e) => e.textContent.trim().slice(0, 44)));
console.log('\ncodes maquette :', JSON.stringify(await lireCodes(p1)));
console.log('codes site     :', JSON.stringify(await lireCodes(p2)));
await c1.close();

/* --- 2. telephone : meta viewport absente --- */
const iph = devices['iPhone 12'];
for (const [nom, url, routeur] of [['maquette', MAQ, true], ['site', 'http://localhost:4321/', false]]) {
  const ctx = await b.newContext({ ...iph });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: routeur ? 'load' : 'networkidle' });
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), cols: c.gridTemplateColumns, pos: c.position, disp: c.display }; };
    return {
      innerWidth, outerWidth, dpr: devicePixelRatio,
      docW: document.documentElement.scrollWidth,
      bodyW: Math.round(document.body.getBoundingClientRect().width),
      edito: g('.edito'), editoT: g('.edito__t'), donnees: g('.donnees'), index: g('.index__l'),
      indexAreas: (() => { const e = document.querySelector('.index__l'); return e ? getComputedStyle(e).gridTemplateAreas : null; })(),
      cartes: g('.cartes'),
      h1: (() => { const e = document.querySelector('h1'); return e ? getComputedStyle(e).fontSize : null; })(),
      section: (() => { const e = document.querySelector('.section'); return e ? getComputedStyle(e).paddingTop : null; })(),
    };
  });
  console.log(`\n[iPhone 12] ${nom} :`, JSON.stringify(m, null, 1));
  await p.screenshot({ path: `verif/agent-${nom}-iphone.png` });
  await ctx.close();
}
await b.close();
