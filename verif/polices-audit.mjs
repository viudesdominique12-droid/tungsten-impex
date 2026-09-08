/* Audit des polices — maquette vs site servi. Fichier temporaire. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const MAQ = 'file:///' + 'C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html'.replace(/ /g, '%20');
const SITE = 'http://localhost:4321';

const s = readFileSync('C:/Users/Hamza Abdoulkader/Desktop/site de chaps/verif/maquette.html', 'utf8');
const raw = s.match(/<script id="routes" type="application\/json">([\s\S]*?)<\/script>/)[1];
const ROUTES = Object.keys(JSON.parse(raw.replace(/<\\\//g, '</')));
console.log('ROUTES', JSON.stringify(ROUTES));

const SONDE = () => {
  const out = { status: document.fonts.status, check: {}, loaded: [], elems: {}, mono: null, ital: null };
  const t = ['Fraunces', 'Instrument Sans', 'Plex Mono'];
  for (const f of t) {
    out.check['16px "' + f + '"'] = document.fonts.check('16px "' + f + '"');
  }
  out.check['italic 16px "Fraunces"'] = document.fonts.check('italic 16px "Fraunces"');
  for (const ff of document.fonts) {
    out.loaded.push([ff.family, ff.style, ff.weight, ff.status].join('|'));
  }

  // famille calculee + rendue
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      sel,
      texte: (el.textContent || '').trim().slice(0, 40),
      computed: cs.fontFamily,
      style: cs.fontStyle,
      weight: cs.fontWeight,
      size: cs.fontSize,
    };
  };
  for (const sel of ['h1', 'p', '.t-label', '.t-h1', '.t-h2', '.donnee__v', '.citation blockquote']) {
    out.elems[sel] = pick(sel);
  }

  // mesure de chasse : le "i" et le "m" dans le contexte reel
  const mesure = (el, txt) => {
    const cs = getComputedStyle(el);
    const c = document.createElement('canvas').getContext('2d');
    c.font = [cs.fontStyle, cs.fontWeight, cs.fontSize + '/' + cs.lineHeight, cs.fontFamily].join(' ')
      .replace(/normal\//, '/');
    return c.measureText(txt).width;
  };

  const lab = document.querySelector('.t-label');
  if (lab) {
    const cs = getComputedStyle(lab);
    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;letter-spacing:0;text-transform:none;'
      + 'font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize + ';font-weight:' + cs.fontWeight;
    document.body.append(span);
    const w = (t) => { span.textContent = t; return span.getBoundingClientRect().width; };
    out.mono = { famille: cs.fontFamily, i: w('iiiiiiiiii'), m: w('mmmmmmmmmm'), taille: cs.fontSize };
    span.remove();
  }

  // italique reelle vs oblique synthetique : meme mot, meme fonte, italic vs normal
  const acc = document.querySelector('.accent-mot');
  const csRef = acc ? getComputedStyle(acc) : null;
  {
    const fam = csRef ? csRef.fontFamily : "'Fraunces', Georgia, 'Times New Roman', serif";
    const fw = csRef ? csRef.fontWeight : '500';
    const fs = '48px';
    const mot = acc ? (acc.textContent || 'import').trim() : 'import';
    const mk = (st) => {
      const sp = document.createElement('span');
      sp.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;text-decoration:none;'
        + 'font-family:' + fam + ';font-size:' + fs + ';font-weight:' + fw + ';font-style:' + st;
      sp.textContent = mot;
      document.body.append(sp);
      const w = sp.getBoundingClientRect().width;
      sp.remove();
      return w;
    };
    out.ital = {
      mot, famille: fam, poids: fw,
      normal: mk('normal'), italic: mk('italic'), oblique: mk('oblique 14deg'),
      presentSurLaPage: !!acc,
      styleCalcule: csRef ? csRef.fontStyle : null,
    };
  }
  return out;
};

const b = await chromium.launch();

async function surMaquette(route) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(MAQ);
  await p.evaluate(() => document.fonts.ready);
  if (route !== '/') {
    await p.evaluate((r) => {
      const a = document.createElement('a'); a.href = r; document.body.append(a); a.click(); a.remove();
    }, route);
    await p.waitForTimeout(250);
  }
  await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate(SONDE);
  await p.close();
  return r;
}

async function surSite(route) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const echecs = [];
  p.on('requestfailed', (q) => echecs.push(q.url()));
  const rep = await p.goto(SITE + route, { waitUntil: 'networkidle' }).catch((e) => ({ err: e.message }));
  if (rep && rep.err) { await p.close(); return { err: rep.err }; }
  await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate(SONDE);
  r.echecs = echecs;
  await p.close();
  return r;
}

const cibles = ROUTES;
const res = {};
for (const r of cibles) {
  res[r] = { maquette: await surMaquette(r), site: await surSite(r) };
  const M = res[r].maquette, S = res[r].site;
  console.log('=== ' + r);
  console.log('  MAQ status=' + M.status + ' check=' + JSON.stringify(M.check) + ' faces=' + M.loaded.length);
  console.log('       ' + JSON.stringify(M.loaded));
  console.log('  SITE status=' + (S.err ? 'ERR ' + S.err : S.status + ' check=' + JSON.stringify(S.check) + ' faces=' + S.loaded.length));
  for (const sel of Object.keys(M.elems)) {
    const m = M.elems[sel], sv = S.elems && S.elems[sel];
    if (!m && !sv) continue;
    console.log('  ' + sel + '\n     MAQ ' + (m ? m.computed + ' / ' + m.style + ' / ' + m.weight + ' / ' + m.size + ' « ' + m.texte + ' »' : 'absent')
      + '\n     SIT ' + (sv ? sv.computed + ' / ' + sv.style + ' / ' + sv.weight + ' / ' + sv.size + ' « ' + sv.texte + ' »' : 'absent'));
  }
  console.log('  MONO MAQ ' + JSON.stringify(M.mono) + '\n       SIT ' + JSON.stringify(S.mono));
  console.log('  ITAL MAQ ' + JSON.stringify(M.ital) + '\n       SIT ' + JSON.stringify(S.ital));
}

await b.close();
