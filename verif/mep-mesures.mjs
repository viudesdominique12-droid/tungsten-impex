/* ANGLE : la mise en page autour de la photographie.
   Mesure seule, aucune ecriture dans src/. A supprimer apres usage. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const HOTE = 'http://localhost:4321';
const FICHES = [
  ['/export/niger-seed-noug/', 'niger-seed-noug'],
  ['/export/sesame-seed/', 'sesame-seed'],
  ['/export/red-kidney-beans/', 'red-kidney-beans'],
  ['/export/soya-bean/', 'soya-bean'],
  ['/import/electric-vehicles/', 'electric-vehicles'],
  ['/import/medical-equipment/', 'medical-equipment'],
  ['/import/human-medicine/', 'human-medicine'],
  ['/import/building-glass/', 'building-glass'],
  ['/import/elevator-and-escalator/', 'elevator-and-escalator'],
  ['/import/calcium-hypochlorite/', 'calcium-hypochlorite'],
  ['/import/plastic-raw-materials/', 'plastic-raw-materials'],
  ['/import/solar-lanterns/', 'solar-lanterns'],
  ['/import/stationery-materials/', 'stationery-materials'],
  ['/import/ceramics/', 'ceramics'],
];
const AUTRES = [['/about/', 'about'], ['/contact/', 'contact'], ['/training/', 'training']];

const FORMATS = [
  { nom: 'pc', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { nom: 'tel', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

const sonde = () => {
  const R = (e) => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +(b.y + scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const out = { url: location.pathname, doc: document.documentElement.scrollHeight };

  // --- 01 The line : plaque + chapeau
  const grille = document.querySelector('.intro__in');
  if (grille) {
    const plaque = document.querySelector('.intro__img');
    const dire = document.querySelector('.intro__dire');
    const lead = document.querySelector('.intro__lead');
    const img = plaque && plaque.querySelector('img');
    const cs = getComputedStyle(grille);
    out.intro = {
      grille: R(grille), colonnes: cs.gridTemplateColumns, alignItems: cs.alignItems,
      plaque: plaque ? R(plaque) : null,
      plaqueFond: plaque ? getComputedStyle(plaque).backgroundColor : null,
      dire: dire ? R(dire) : null,
      lead: lead ? R(lead) : null,
      leadTexteLargeur: lead ? +(() => { const r = document.createRange(); r.selectNodeContents(lead); const rs = [...r.getClientRects()]; return rs.length ? Math.max(...rs.map((k) => k.width)) : 0; })().toFixed(1) : 0,
      lignesLead: lead ? (() => { const r = document.createRange(); r.selectNodeContents(lead); return r.getClientRects().length; })() : 0,
      img: img ? { ...R(img), nat: img.naturalWidth + 'x' + img.naturalHeight, srcW: (img.currentSrc.match(/w=(\d+)/) || [])[1] || '?' } : null,
      section: R(document.querySelector('.intro')),
    };
  }

  // --- tete sur nuit
  const tete = document.querySelector('.tete');
  if (tete) {
    const enfants = [...tete.querySelectorAll('.crumb, .tete__h, .tete__sens, .code, .tete__act, .tete__p, h1')];
    const boites = enfants.map(R).filter((b) => b.h > 0);
    const haut = Math.min(...boites.map((b) => b.y));
    const bas = Math.max(...boites.map((b) => b.y + b.h));
    const t = R(tete);
    out.tete = {
      boite: t, contenuHaut: +haut.toFixed(1), contenuBas: +bas.toFixed(1),
      contenuH: +(bas - haut).toFixed(1),
      videHaut: +(haut - t.y).toFixed(1), videBas: +(t.y + t.h - bas).toFixed(1),
      partVide: +(((t.h - (bas - haut)) / t.h) * 100).toFixed(1),
      largeurContenuMax: +Math.max(...boites.map((b) => b.x + b.w)).toFixed(1),
      titre: (document.querySelector('.tete__h') || {}).textContent || '',
      titreLignes: (() => { const h = document.querySelector('.tete__h'); if (!h) return 0; const r = document.createRange(); r.selectNodeContents(h); return r.getClientRects().length; })(),
    };
  }

  // --- suite des sections : type, sol, fond calcule, hauteur
  out.sections = [...document.querySelectorAll('main > * , main section, main figure.pleine, article > section, article > figure')]
    .filter((e, i, a) => a.indexOf(e) === i && (e.matches('section, figure.pleine, div.portrait')))
    .map((e) => ({
      cls: e.className, type: e.dataset.type || '-', sol: e.dataset.sol || '-',
      fond: getComputedStyle(e).backgroundColor, h: +R(e).h.toFixed(1), y: +R(e).y.toFixed(1),
    }));

  // --- toutes les plaques + photos de la page
  out.photos = [...document.querySelectorAll('.plaque, .pleine, .portrait, .letter__img')].map((cadre) => {
    const img = cadre.matches('img') ? cadre : cadre.querySelector('img');
    if (!img) return null;
    const c = R(cadre), i = R(img);
    return {
      cadre: cadre.className.split(' ')[0], boiteCadre: c, boiteImg: i,
      nat: img.naturalWidth + 'x' + img.naturalHeight,
      couverture: +(((i.w * i.h) / (c.w * c.h)) * 100).toFixed(1),
      margeG: +(i.x - c.x).toFixed(1), margeD: +((c.x + c.w) - (i.x + i.w)).toFixed(1),
      margeH: +(i.y - c.y).toFixed(1), margeB: +((c.y + c.h) - (i.y + i.h)).toFixed(1),
    };
  }).filter(Boolean);

  // --- vides : pour chaque section, la plus grande bande horizontale sans contenu
  out.vides = [...document.querySelectorAll('section.section')].map((s) => {
    const sh = s.querySelector('.shell') || s;
    const b = R(sh);
    const gosses = [...sh.querySelectorAll('*')].map(R).filter((k) => k.w > 4 && k.h > 4);
    if (!gosses.length) return null;
    const droite = Math.max(...gosses.map((k) => k.x + k.w));
    const gauche = Math.min(...gosses.map((k) => k.x));
    return { cls: s.className.split(' ').slice(0, 2).join(' '), type: s.dataset.type || '-',
             shell: b, videDroite: +((b.x + b.w) - droite).toFixed(1), videGauche: +(gauche - b.x).toFixed(1) };
  }).filter(Boolean);

  return out;
};

const b = await chromium.launch();
const rapport = {};
for (const f of FORMATS) {
  const ctx = await b.newContext(f);
  for (const [u, n] of [...FICHES, ...AUTRES]) {
    const p = await ctx.newPage();
    await p.goto(HOTE + u, { waitUntil: 'networkidle' });
    await p.evaluate(async () => {
      await document.fonts.ready;
      for (const i of document.querySelectorAll('img')) i.loading = 'eager';
      await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    });
    await p.waitForTimeout(250);
    rapport[`${f.nom}|${n}`] = await p.evaluate(sonde);
    await p.close();
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync('verif/mep-mesures.json', JSON.stringify(rapport, null, 1));
console.log('ok', Object.keys(rapport).length);
