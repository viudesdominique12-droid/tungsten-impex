/* ---------------------------------------------------------------------------
   ANGLE TELEPHONE — mesures sur les 18 routes a 390x844, isMobile + hasTouch,
   deviceScaleFactor 2.

   On mesure : debordement horizontal, la plaque et le remplissage de l'image
   dedans, les bandes pleine largeur et leur nettete reelle, la barre d'action
   du bas, les cibles tactiles, le logo de l'en-tete, et les intervalles entre
   sections. Rien n'est corrige : on observe.

   Usage : node verif/tel-mesures.mjs
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const ROUTES = [
  '/', '/about/', '/contact/', '/training/',
  ...['niger-seed-noug', 'sesame-seed', 'red-kidney-beans', 'soya-bean'].map((s) => `/export/${s}/`),
  ...['electric-vehicles', 'medical-equipment', 'human-medicine', 'building-glass',
      'elevator-and-escalator', 'calcium-hypochlorite', 'plastic-raw-materials',
      'solar-lanterns', 'stationery-materials', 'ceramics'].map((s) => `/import/${s}/`),
];

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
const p = await ctx.newPage();

const tout = [];

for (const route of ROUTES) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.querySelectorAll('img')) i.loading = 'eager';
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(350);

  const m = await p.evaluate(() => {
    const r = (n) => Math.round(n * 10) / 10;
    const de = document.documentElement;

    /* --- debordement horizontal + coupables --- */
    const deborde = de.scrollWidth - de.clientWidth;
    const coupables = [];
    if (deborde > 0) {
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.right > de.clientWidth + 1 || b.left < -1) {
          coupables.push({
            sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
            left: r(b.left), right: r(b.right), width: r(b.width),
          });
        }
      }
    }

    /* --- la plaque --- */
    const plaques = [...document.querySelectorAll('.plaque')].map((f) => {
      const fb = f.getBoundingClientRect();
      const img = f.querySelector('img');
      const ib = img ? img.getBoundingClientRect() : null;
      const cs = getComputedStyle(f);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const dispoW = fb.width - padX, dispoH = fb.height - padY;
      return {
        plaque: [r(fb.width), r(fb.height)],
        pad: [r(padX / 2), r(padY / 2)],
        dispo: [r(dispoW), r(dispoH)],
        img: ib ? [r(ib.width), r(ib.height)] : null,
        naturel: img ? [img.naturalWidth, img.naturalHeight] : null,
        src: img ? (img.currentSrc || img.src).split('/').pop().slice(0, 70) : null,
        /* part de la boite disponible reellement occupee par l'image */
        occupe: ib ? r(100 * (ib.width * ib.height) / (dispoW * dispoH)) : null,
        /* densite reelle servie : pixels du fichier par pixel css, a dpr 2 il en faut 2 */
        densite: ib && img ? r(img.naturalWidth / ib.width) : null,
      };
    });

    /* --- bandes pleine largeur --- */
    const pleines = [...document.querySelectorAll('.pleine')].map((f) => {
      const fb = f.getBoundingClientRect();
      const img = f.querySelector('img');
      const ib = img ? img.getBoundingClientRect() : null;
      /* combien d'image `cover` doit fournir pour remplir la boite */
      let besoinW = null;
      if (img && ib && img.naturalWidth) {
        const ratioBoite = ib.width / ib.height;
        const ratioImg = img.naturalWidth / img.naturalHeight;
        besoinW = ratioImg > ratioBoite ? ib.width : ib.height * ratioImg;
      }
      return {
        boite: [r(fb.width), r(fb.height)],
        img: ib ? [r(ib.width), r(ib.height)] : null,
        naturel: img ? [img.naturalWidth, img.naturalHeight] : null,
        src: img ? (img.currentSrc || img.src).split('/').pop().slice(0, 70) : null,
        sizes: img ? img.getAttribute('sizes') : null,
        /* pixels de fichier par pixel css affiche, en tenant compte du recadrage */
        densite: img && ib ? r(img.naturalWidth / (besoinW || ib.width)) : null,
        objectFit: img ? getComputedStyle(img).objectFit : null,
      };
    });

    /* --- le logo de l'en-tete --- */
    const mark = document.querySelector('header .mark') || document.querySelector('.mark');
    let logo = null;
    if (mark) {
      const mb = mark.getBoundingClientRect();
      const pieces = [...mark.querySelectorAll('img')].map((i) => {
        const bb = i.getBoundingClientRect();
        return { alt: i.alt || '', css: [r(bb.width), r(bb.height)],
                 naturel: [i.naturalWidth, i.naturalHeight],
                 src: (i.currentSrc || i.src).split('/').pop().slice(0, 50) };
      });
      logo = { boite: [r(mb.width), r(mb.height)], pieces, texte: mark.innerText.trim() };
    }

    /* --- cibles tactiles --- */
    const petites = [];
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
      const bb = el.getBoundingClientRect();
      if (bb.width === 0 || bb.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      /* on ignore les liens en ligne dans un paragraphe : la regle vise les commandes */
      const dansTexte = el.closest('p, li, dd') && el.tagName === 'A';
      if (bb.height < 48 || bb.width < 24) {
        petites.push({
          sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          txt: (el.innerText || el.value || '').trim().slice(0, 28),
          taille: [r(bb.width), r(bb.height)], dansTexte: !!dansTexte,
        });
      }
    }

    /* --- intervalles entre sections --- */
    const secs = [...document.querySelectorAll('main .section, main > section, main > article > section')];
    const uniques = [...new Set(secs)];
    const inter = [];
    for (let i = 1; i < uniques.length; i++) {
      const a = uniques[i - 1].getBoundingClientRect();
      const c = uniques[i].getBoundingClientRect();
      inter.push({
        de: uniques[i - 1].getAttribute('data-rail-section') || uniques[i - 1].className.slice(0, 24),
        a: uniques[i].getAttribute('data-rail-section') || uniques[i].className.slice(0, 24),
        ecart: r(c.top - a.bottom),
        solA: uniques[i - 1].getAttribute('data-sol') || 'jour',
        solB: uniques[i].getAttribute('data-sol') || 'jour',
      });
    }

    return {
      deborde, coupables: coupables.slice(0, 6), plaques, pleines, logo,
      petites, inter, hauteur: document.body.scrollHeight,
    };
  });

  /* --- la barre d'action, a trois positions --- */
  const barre = { existe: await p.locator('#barre').count() > 0 };
  if (barre.existe) {
    barre.hautHidden = await p.locator('#barre').evaluate((e) => e.hidden);
    await p.evaluate(() => scrollTo(0, 1200));
    await p.waitForTimeout(400);
    barre.milieu = await p.locator('#barre').evaluate((e) => {
      const b = e.getBoundingClientRect();
      return { hidden: e.hidden, top: Math.round(b.top), h: Math.round(b.height) };
    });
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(500);
    barre.pied = await p.locator('#barre').evaluate((e) => e.hidden);
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForTimeout(250);
  }

  tout.push({ route, ...m, barre });

  console.log(`\n=== ${route}  hauteur ${m.hauteur}px  ecrans ${(m.hauteur / 844).toFixed(1)}`);
  console.log(`  debordement ${m.deborde}px` + (m.coupables.length ? ` -> ${JSON.stringify(m.coupables)}` : ''));
  for (const q of m.plaques)
    console.log(`  PLAQUE ${q.plaque[0]}x${q.plaque[1]}  dispo ${q.dispo[0]}x${q.dispo[1]}  img ${q.img && q.img.join('x')}  nat ${q.naturel && q.naturel.join('x')}  occupe ${q.occupe}%  densite ${q.densite}x  ${q.src}`);
  for (const q of m.pleines)
    console.log(`  PLEINE ${q.boite[0]}x${q.boite[1]}  img ${q.img && q.img.join('x')}  nat ${q.naturel && q.naturel.join('x')}  densite ${q.densite}x  sizes="${q.sizes}"  ${q.src}`);
  if (m.logo) console.log(`  LOGO boite ${m.logo.boite.join('x')} pieces ${JSON.stringify(m.logo.pieces)} texte "${m.logo.texte.replace(/\n/g, ' / ')}"`);
  console.log(`  barre ${JSON.stringify(barre)}`);
  const dures = m.petites.filter((x) => !x.dansTexte);
  if (dures.length) console.log(`  CIBLES < 48px : ${JSON.stringify(dures)}`);
  const serres = m.inter.filter((x) => x.ecart < 24);
  if (serres.length) console.log(`  ECARTS serres : ${JSON.stringify(serres)}`);
}

writeFileSync('verif/tel-mesures.json', JSON.stringify(tout, null, 1));
await b.close();
console.log('\n--- ecrit dans verif/tel-mesures.json');
