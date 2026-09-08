/* Pixels REELS : naturalWidth est corrige par la densite quand un descripteur w
   est present (spec HTML). On decode donc le fichier lui-meme. */
import { chromium } from 'playwright';
const MAQ='file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const SITE='http://localhost:4321';

const REEL = async (page) => page.evaluate(async () => {
  const out=[];
  for (const i of document.images) {
    const u = i.currentSrc || i.src;
    let reel = null;
    try { const bm = await createImageBitmap(await (await fetch(u)).blob());
          reel = { w: bm.width, h: bm.height }; bm.close(); } catch(e) { reel = 'ERR:'+e.message; }
    const r = i.getBoundingClientRect();
    out.push({ nat:[i.naturalWidth,i.naturalHeight], reel, dw:+r.width.toFixed(1), dh:+r.height.toFixed(1),
      pleine:!!i.closest('.pleine'), alt:(i.alt||'').slice(0,40),
      u: u.startsWith('data:') ? 'data:('+Math.round(u.length*0.75/1024)+'Ko)' : u.replace(location.origin,'') });
  }
  return out;
});

const routes=['/','/about/','/contact/','/training/','/export/niger-seed-noug/','/export/red-kidney-beans/',
 '/export/sesame-seed/','/export/soya-bean/','/import/building-glass/','/import/calcium-hypochlorite/',
 '/import/ceramics/','/import/electric-vehicles/','/import/elevator-and-escalator/','/import/human-medicine/',
 '/import/medical-equipment/','/import/plastic-raw-materials/','/import/solar-lanterns/','/import/stationery-materials/'];

const b = await chromium.launch();
for (const vp of [{w:1440,h:900},{w:1920,h:1080}]) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1 });
  const pm = await ctx.newPage(); await pm.goto(MAQ); await pm.waitForTimeout(500);
  const ps = await ctx.newPage();
  console.log(`\n############ ${vp.w}x${vp.h} ############`);
  for (const r of routes) {
    await pm.bringToFront();
    await pm.evaluate((x)=>{const a=document.createElement('a');a.href=x;document.body.append(a);a.click();a.remove();}, r);
    await pm.waitForTimeout(350);
    await pm.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?null:new Promise(res=>{i.onload=res;i.onerror=res;setTimeout(res,2500);}))));
    const M = await REEL(pm);
    await ps.goto(SITE+r,{waitUntil:'load'});
    await ps.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await ps.waitForTimeout(450);
    await ps.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?null:new Promise(res=>{i.onload=res;i.onerror=res;setTimeout(res,2500);}))));
    const S = await REEL(ps);
    for (let k=0;k<Math.max(M.length,S.length);k++){
      const m=M[k]||{},s=S[k]||{};
      const rm=m.reel&&m.reel.w, rs=s.reel&&s.reel.w;
      const fm = rm && m.dw>rm+0.5 ? `x${(m.dw/rm).toFixed(2)}` : '-';
      const fs = rs && s.dw>rs+0.5 ? `x${(s.dw/rs).toFixed(2)}` : '-';
      const alerte = (fm!=='-'||fs!=='-') ? (fm!==fs ? '  <<< ECART' : '  (les deux)') : '';
      console.log(`${r.padEnd(31)}${k} MAQ reel=${String(rm).padStart(4)}x${String(m.reel&&m.reel.h).padEnd(4)} dw=${String(m.dw).padStart(6)} agr=${fm.padEnd(6)}| SITE reel=${String(rs).padStart(4)}x${String(s.reel&&s.reel.h).padEnd(4)} dw=${String(s.dw).padStart(6)} agr=${fs.padEnd(6)}${alerte}`);
      if (k===0 && vp.w===1440) console.log(`${''.padEnd(32)}  maq=${m.u}  site=${s.u}`);
    }
  }
  await ctx.close();
}
await b.close();
