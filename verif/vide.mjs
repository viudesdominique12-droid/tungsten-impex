import { chromium, devices } from 'playwright';

/* Ou est le vide, et combien. On projette tout ce qui est peint — texte et
   images — sur l'axe vertical, puis on cherche les bandes ou il n'y a rien. */
const mesure = async (ctx, nom) => {
  console.log(`\n===== ${nom} =====`);
  const p = await ctx.newPage();
  const routes = ['/', '/about/', '/contact/', '/training/',
                  '/import/electric-vehicles/', '/export/niger-seed-noug/'];
  for (const u of routes) {
    await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await document.fonts.ready;
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))); });
    const m = await p.evaluate(() => {
      const H = document.documentElement.scrollHeight;
      const peint = new Uint8Array(H);
      const marque = (t, b) => { for (let y = Math.max(0, Math.floor(t)); y < Math.min(H, Math.ceil(b)); y++) peint[y] = 1; };
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.width === 0) continue;
        const t = r.top + scrollY, b = r.bottom + scrollY;
        if (el.tagName === 'IMG') { marque(t, b); continue; }
        const cs = getComputedStyle(el);
        const n = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
        if (n.length >= 3 && !(n.length > 3 && n[3] === 0)) marque(t, b);
        // le texte : seulement les feuilles qui portent des caracteres
        if (el.children.length === 0 && el.textContent.trim()) marque(t, b);
      }
      // les bandes vides
      const trous = [];
      let debut = -1;
      for (let y = 0; y < H; y++) {
        if (!peint[y]) { if (debut < 0) debut = y; }
        else if (debut >= 0) { trous.push([debut, y - debut]); debut = -1; }
      }
      if (debut >= 0) trous.push([debut, H - debut]);
      const vides = peint.reduce((a, c) => a + (c ? 0 : 1), 0);
      return { H, part: Math.round((vides / H) * 100),
               pires: trous.sort((a, b) => b[1] - a[1]).slice(0, 3) };
    });
    console.log(`${u.padEnd(28)} ${String(m.H).padStart(5)}px   ${String(m.part).padStart(2)} % de bandes vides   ` +
                `plus grands trous : ${m.pires.map(([y, h]) => `${h}px a y=${y}`).join(', ')}`);
  }
  await p.close();
};

const b = await chromium.launch();
await mesure(await b.newContext({ viewport: { width: 1440, height: 900 } }), 'BUREAU 1440');
await mesure(await b.newContext({ ...devices['iPhone 12'] }), 'IPHONE 12');
await b.close();
