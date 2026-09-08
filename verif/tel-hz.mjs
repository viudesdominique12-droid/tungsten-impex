/* Sonde telephone — angle mobile. Fichier temporaire, a supprimer. */
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';

const MAQ = 'file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const SITE = 'http://localhost:4321';

const MESURE = () => {
  const de = document.documentElement;
  const cw = de.clientWidth;
  const deborde = de.scrollWidth - cw;
  const bodyDeborde = document.body.scrollWidth - document.body.clientWidth;

  const coupables = [];
  if (deborde > 0) {
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > cw + 0.5 || r.left < -0.5) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        coupables.push({
          sel: el.tagName.toLowerCase()
            + (el.id ? '#' + el.id : '')
            + (el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
          left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
          pos: cs.position, ov: cs.overflowX,
        });
      }
    }
  }
  const vus = new Set();
  const top = coupables
    .sort((a, b) => b.right - a.right)
    .filter((c) => (vus.has(c.sel) ? false : (vus.add(c.sel), true)))
    .slice(0, 8);

  const petites = [];
  const sels = 'a[href], button, [role="button"], summary, input, select, textarea';
  for (const el of document.querySelectorAll(sels)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right < 0 || r.left > cw) continue;
    if (r.height < 48 || r.width < 48) {
      petites.push({
        sel: el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        txt: (el.textContent || '').trim().slice(0, 24),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      });
    }
  }

  const champs = [];
  for (const el of document.querySelectorAll('input, textarea, select')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    champs.push({
      sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
        + (el.name ? '[name=' + el.name + ']' : ''),
      type: el.type || '', fs: parseFloat(cs.fontSize),
    });
  }

  const bd = document.querySelector('.donnees');
  const bandeCols = bd ? getComputedStyle(bd).gridTemplateColumns : null;
  const bandeN = bandeCols ? bandeCols.trim().split(/\s+/).length : 0;

  const rail = document.getElementById('rail');
  const railCs = rail ? getComputedStyle(rail) : null;
  const railVu = !!(rail && railCs.display !== 'none' && railCs.visibility !== 'hidden'
                    && rail.getBoundingClientRect().width > 0);

  const barre = document.getElementById('barre');
  const bcs = barre ? getComputedStyle(barre) : null;

  let regleBarreHidden = false;
  for (const s of [...document.styleSheets]) {
    try {
      for (const r of [...s.cssRules]) {
        if (r.selectorText && /\.barre[^{]*\[hidden\]/.test(r.selectorText)) regleBarreHidden = true;
      }
    } catch (e) { /* feuille distante */ }
  }

  return {
    deborde, bodyDeborde, cw, sw: de.scrollWidth, coupables: top,
    hauteur: de.scrollHeight,
    petites: petites.slice(0, 25), nbPetites: petites.length,
    champs, bandeCols, bandeN,
    railPresent: !!rail, railVu,
    barrePresente: !!barre,
    barreHidden: barre ? barre.hidden : null,
    barreDisplay: bcs ? bcs.display : null,
    barreH: barre ? Math.round(barre.getBoundingClientRect().height) : 0,
    regleBarreHidden,
  };
};

const barreAuxTroisEtages = async (page) => {
  const etat = () => page.evaluate(() => {
    const b = document.getElementById('barre');
    if (!b) return null;
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return { hidden: b.hidden, display: cs.display, h: Math.round(r.height),
             visible: cs.display !== 'none' && r.height > 0,
             y: Math.round(scrollY),
             max: Math.round(document.documentElement.scrollHeight - innerHeight) };
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  const haut = await etat();
  await page.evaluate(() => scrollTo(0, innerHeight * 1.6));
  await page.waitForTimeout(400);
  const milieu = await etat();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(600);
  const bas = await etat();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  return { haut, milieu, bas };
};

const menu = async (page) => {
  const ouvre = await page.$('#nav-open');
  if (!ouvre) return { present: false };
  const boite = await ouvre.boundingBox();
  await ouvre.click();
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const nav = document.getElementById('nav');
    if (!nav) return { panneau: false };
    const cs = getComputedStyle(nav);
    const rr = nav.getBoundingClientRect();
    const liens = [...nav.querySelectorAll('a[href], button')].map((a) => {
      const b = a.getBoundingClientRect();
      return { txt: (a.textContent || '').trim().slice(0, 22),
               w: +b.width.toFixed(1), h: +b.height.toFixed(1),
               t: Math.round(b.top), bt: Math.round(b.bottom),
               dansEcran: b.bottom > 0 && b.top < innerHeight && b.left >= -1 && b.right <= de.clientWidth + 1 };
    });
    return {
      panneau: true, open: nav.dataset.open, display: cs.display, opacity: cs.opacity,
      visibility: cs.visibility, transform: cs.transform, ariaHidden: nav.getAttribute('aria-hidden'),
      rect: { t: Math.round(rr.top), l: Math.round(rr.left), w: Math.round(rr.width), h: Math.round(rr.height) },
      couvre: rr.width >= de.clientWidth - 1 && rr.height >= innerHeight - 1,
      debordeNavY: nav.scrollHeight - nav.clientHeight,
      debordeDocX: de.scrollWidth - de.clientWidth,
      nbLiens: liens.length,
      liensHorsEcran: liens.filter((l) => !l.dansEcran),
      liensPetits: liens.filter((l) => l.h < 48),
      bodyOverflow: getComputedStyle(document.body).overflow,
      croix: (() => { const x = document.getElementById('nav-close');
        if (!x) return null; const b = x.getBoundingClientRect();
        return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; })(),
    };
  });
  let ferme = null;
  const x = await page.$('#nav-close');
  if (x) {
    await x.click().catch(() => {});
    await page.waitForTimeout(500);
    ferme = await page.evaluate(() => {
      const nav = document.getElementById('nav');
      const cs = getComputedStyle(nav);
      return { open: nav.dataset.open, display: cs.display, opacity: cs.opacity,
               visibility: cs.visibility, aria: nav.getAttribute('aria-hidden') };
    });
  }
  return { present: true, bouton: boite ? { w: +boite.width.toFixed(1), h: +boite.height.toFixed(1) } : null, ...r, ferme };
};

const run = async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: devices['iPhone 13'].userAgent,
  });
  const page = await ctx.newPage();

  await page.goto(MAQ, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const routes = await page.evaluate(() =>
    Object.keys(JSON.parse(document.getElementById('routes').textContent)).sort());

  const out = { routes, maquette: {}, site: {} };

  for (const r of routes) {
    await page.evaluate((rr) => {
      const a = document.createElement('a'); a.href = rr; document.body.append(a); a.click(); a.remove();
    }, r);
    await page.waitForTimeout(800);
    const m = await page.evaluate(MESURE);
    m.barre3 = await barreAuxTroisEtages(page);
    m.menu = await menu(page);
    m.titre = await page.title();
    out.maquette[r] = m;
    console.error('maq  ' + r + '  deborde=' + m.deborde + ' bandeN=' + m.bandeN
      + ' rail=' + m.railVu + ' barre@bas=' + (m.barre3.bas && m.barre3.bas.visible));
  }

  for (const r of routes) {
    await page.goto(SITE + r, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const m = await page.evaluate(MESURE);
    m.barre3 = await barreAuxTroisEtages(page);
    m.menu = await menu(page);
    m.titre = await page.title();
    out.site[r] = m;
    console.error('site ' + r + '  deborde=' + m.deborde + ' bandeN=' + m.bandeN
      + ' rail=' + m.railVu + ' barre@bas=' + (m.barre3.bas && m.barre3.bas.visible));
  }

  writeFileSync(process.argv[2] || 'verif/tel-hz.json', JSON.stringify(out, null, 1));
  await nav.close();
};
run();
