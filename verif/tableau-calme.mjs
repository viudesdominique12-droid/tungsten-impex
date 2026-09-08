import { chromium, devices } from 'playwright';
const b = await chromium.launch();

/* 1. mouvement reduit : le panneau ne doit pas tourner du tout */
const c1 = await b.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
const p1 = await c1.newPage();
await p1.goto('http://localhost:4321/', { waitUntil:'networkidle' });
const avant = await p1.evaluate(() => document.getElementById('board-card').getAttribute('href'));
await p1.waitForTimeout(8000);
const apres = await p1.evaluate(() => ({
  href: document.getElementById('board-card').getAttribute('href'),
  tr: getComputedStyle(document.getElementById('board-card')).transform,
}));
console.log('mouvement reduit : href', avant, '->', apres.href,
            avant === apres.href ? '  OK, immobile' : '  ECHEC, il tourne');
await c1.close();

/* 2. survol : la rotation doit s arreter */
const c2 = await b.newContext({ viewport:{width:1440,height:900} });
const p2 = await c2.newPage();
await p2.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p2.hover('#board');
const h1 = await p2.evaluate(() => document.getElementById('board-card').getAttribute('href'));
await p2.waitForTimeout(8000);
const h2 = await p2.evaluate(() => document.getElementById('board-card').getAttribute('href'));
console.log('survol            : href', h1, '->', h2, h1 === h2 ? '  OK, arrete' : '  ECHEC, il tourne');
await c2.close();

/* 3. mobile : pas de debordement, panneau visible */
const c3 = await b.newContext({ ...devices['iPhone 12'] });
const p3 = await c3.newPage();
await p3.goto('http://localhost:4321/', { waitUntil:'networkidle' });
await p3.evaluate(() => document.fonts.ready);
const m = await p3.evaluate(() => {
  const r = document.getElementById('board').getBoundingClientRect();
  return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
           w: Math.round(r.width), h: Math.round(r.height) };
});
console.log('mobile            : panneau', m.w + 'x' + m.h, '| debordement', m.over + 'px',
            m.over === 0 ? ' OK' : ' ECHEC');
await p3.screenshot({ path: 'verif/tableau-mobile.png' });
await c3.close();
await b.close();
