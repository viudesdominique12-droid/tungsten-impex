/* Economie REELLE du remede, page par page, avec l'echelle de variantes
   telle qu'elle existe aujourd'hui. Script jetable. */
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const routes = [
  ['/export/niger-seed-noug/','niger'],['/export/sesame-seed/','sesame'],
  ['/export/red-kidney-beans/','rkb'],['/export/soya-bean/','soya'],
  ['/import/electric-vehicles/','ev'],['/import/medical-equipment/','medeq'],
  ['/import/human-medicine/','medic'],['/import/building-glass/','glass'],
  ['/import/elevator-and-escalator/','lift'],['/import/calcium-hypochlorite/','chlore'],
  ['/import/plastic-raw-materials/','plast'],['/import/solar-lanterns/','lantern'],
  ['/import/stationery-materials/','stat'],['/import/ceramics/','ceram'],
];
const b = await chromium.launch();
for (const [nom, ctx] of [
  ['pc', { viewport:{width:1440,height:900}, deviceScaleFactor:1 }],
  ['tel', { viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true }],
]) {
  const c = await b.newContext(ctx); const p = await c.newPage();
  let sA = 0, sB = 0;
  for (const [r, court] of routes) {
    await p.goto(B + r, { waitUntil: 'networkidle' });
    const out = await p.evaluate(async () => {
      const i = document.querySelector('.plaque.intro__img img');
      const pic = i.closest('picture');
      const poids = async (u) => (await (await fetch(u)).blob()).size;
      const large = async (u) => { const t = new Image(); t.src = u; await t.decode(); return t.naturalWidth; };
      const srcA = i.currentSrc, octA = await poids(srcA), wA = await large(srcA);
      const occ = i.getBoundingClientRect().width;
      const w = Math.round(occ);
      for (const s of pic.querySelectorAll('source')) s.setAttribute('sizes', w+'px');
      i.setAttribute('sizes', w+'px');
      await new Promise(r => setTimeout(r, 700));
      const srcB = i.currentSrc, octB = await poids(srcB), wB = await large(srcB);
      return { occ:+occ.toFixed(1), dpr:devicePixelRatio, wA, octA, wB, octB, meme: srcA===srcB };
    });
    sA += out.octA; sB += out.octB;
    console.log(`${nom} ${court.padEnd(8)} occupe ${String(out.occ).padStart(6)} dpr${out.dpr} | actuel ${String(out.wA).padStart(4)}w ${(out.octA/1024).toFixed(1).padStart(6)}Ko | remede ${String(out.wB).padStart(4)}w ${(out.octB/1024).toFixed(1).padStart(6)}Ko | gain ${((out.octA-out.octB)/1024).toFixed(1)}Ko`);
  }
  console.log(`${nom} TOTAL 14 fiches : actuel ${(sA/1024).toFixed(1)}Ko, remede ${(sB/1024).toFixed(1)}Ko, gain ${((sA-sB)/1024).toFixed(1)}Ko (${(100*(sA-sB)/sA).toFixed(1)} %)\n`);
  await c.close();
}
await b.close();
