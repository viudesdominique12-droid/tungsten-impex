import { chromium, devices } from 'playwright';

/* Les controles profonds ne portaient que sur deux pages. On les passe sur les
   dix-huit, au bureau ET au telephone, pour savoir ce que ce trou cachait. */
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const flat = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1;
  return fg.slice(0, 3).map((c, i) => c * a + bg.slice(0, 3)[i] * (1 - a)); };

const b = await chromium.launch();
const routes = JSON.parse(await (await b.newContext()).newPage()
  .then(async (p) => { await p.goto('http://localhost:4321/'); 
    return p.evaluate(() => JSON.stringify(['/', '/about/', '/contact/', '/training/',
      ...[...document.querySelectorAll('a[href^="/export/"], a[href^="/import/"]')]
        .map((a) => a.getAttribute('href'))])); }));
const uniques = [...new Set(routes)];

const passe = async (ctx, nom, mobile) => {
  console.log(`\n===== ${nom} — ${uniques.length} pages =====`);
  const soucis = [];
  for (const u of uniques) {
    const p = await ctx.newPage();
    await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready;
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))); });
    const m = await p.evaluate(() => {
      /* Le fond effectif : un fond a 7 % d'opacite n'est pas de l'encre pleine,
         c'est de l'encre POSEE SUR ce qu'il y a dessous. On empile donc les
         couches de bas en haut avant de mesurer. Sans cela le lavis du tableau
         de departs se lit comme de l'encre, et le controle annonce 1,00 de
         contraste sur du texte parfaitement lisible. */
      const fond = (el) => {
        const couches = [];
        for (let e = el; e; e = e.parentElement) {
          const n = (getComputedStyle(e).backgroundColor.match(/[\d.]+/g) || []).map(Number);
          if (n.length < 3) continue;
          const a = n.length > 3 ? n[3] : 1;
          if (a === 0) continue;
          couches.push([n[0], n[1], n[2], a]);
          if (a === 1) break;
        }
        couches.push([255, 255, 255, 1]);
        let out = couches[couches.length - 1].slice(0, 3);
        for (let i = couches.length - 2; i >= 0; i--) {
          const [r, g, b, a] = couches[i];
          out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
        }
        return `rgb(${out.map(Math.round).join(',')})`;
      };
      const echantillon = [];
      for (const sel of ['p', 'h1', 'h2', 'h3', 'li', 'dd', 'dt', 'span', 'a', 'b']) {
        for (const el of [...document.querySelectorAll(sel)].slice(0, 40)) {
          if (!el.textContent.trim() || el.getBoundingClientRect().height === 0) continue;
          const cs = getComputedStyle(el);
          echantillon.push({ t: el.tagName.toLowerCase() + '.' + (String(el.className).split(' ')[0] || ''),
                             fg: cs.color, bg: fond(el),
                             taille: parseFloat(cs.fontSize), gras: cs.fontWeight });
        }
      }
      const petites = [...document.querySelectorAll('a[href], button, input, select, textarea')]
        .filter((el) => { const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 44; })
        .map((el) => el.tagName.toLowerCase() + '.' + (String(el.className).split(' ')[0] || '?'));
      return { echantillon, petites: [...new Set(petites)],
               over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    for (const e of m.echantillon) {
      const r = ratio(flat(parse(e.fg), parse(e.bg)), parse(e.bg));
      const grand = e.taille >= 24 || (e.taille >= 18.66 && parseInt(e.gras) >= 700);
      const seuil = grand ? 3 : 4.5;
      if (r < seuil) soucis.push(`${u} ${e.t} ${r.toFixed(2)} (seuil ${seuil}, ${e.taille}px)`);
    }
    if (mobile && m.petites.length) soucis.push(`${u} cibles<44 : ${m.petites.join(' ')}`);
    if (m.over !== 0) soucis.push(`${u} debordement ${m.over}px`);
    await p.close();
  }
  if (!soucis.length) console.log('  aucun souci');
  else [...new Set(soucis)].slice(0, 12).forEach((s) => console.log('  ' + s));
  return soucis.length;
};

let total = 0;
total += await passe(await b.newContext({ viewport: { width: 1440, height: 900 } }), 'BUREAU 1440', false);
total += await passe(await b.newContext({ ...devices['iPhone 12'] }), 'IPHONE 12', true);
console.log(`\n${total ? total + ' souci(s)' : 'aucun souci sur les dix-huit pages'}`);
await b.close();
