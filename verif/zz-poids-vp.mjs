import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

/* --- 1. poids des images encodees, lu dans le fichier lui-meme --- */
const src = readFileSync('verif/maquette.html', 'utf8');
const uris = [...src.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g)].map((m) => m[1]);
const uniq = new Map();
for (const u of uris) uniq.set(u.slice(0, 64) + u.length, Math.round(u.length * 3 / 4));
let tot = 0; for (const v of uniq.values()) tot += v;
console.log(`images encodees : ${uris.length} occurrences, ${uniq.size} distinctes, ${(tot/1024/1024).toFixed(2)} Mo decodes`);
const fontes = [...src.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g)].map((m)=>Math.round(m[1].length*3/4));
console.log(`fontes : ${fontes.length}, ${(fontes.reduce((a,b)=>a+b,0)/1024).toFixed(0)} Ko`);
console.log(`fichier total : ${(Buffer.byteLength(src)/1024/1024).toFixed(2)} Mo`);
console.log('plus grosses images (Ko) :', [...uniq.values()].sort((a,b)=>b-a).slice(0,6).map(v=>Math.round(v/1024)).join(' '));

/* --- 2. agrandissement a plusieurs largeurs --- */
const MAQ='file:///C:/Users/Hamza%20Abdoulkader/Desktop/site%20de%20chaps/verif/maquette.html';
const b = await chromium.launch();
const routes=['/','/about/','/contact/','/import/electric-vehicles/','/import/human-medicine/','/training/',
  '/export/niger-seed-noug/','/import/ceramics/','/import/medical-equipment/','/import/elevator-and-escalator/',
  '/export/sesame-seed/','/import/building-glass/','/import/plastic-raw-materials/'];

for (const vp of [{w:1440,h:900,dpr:1},{w:1920,h:1080,dpr:1},{w:390,h:844,dpr:2}]) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:vp.dpr });
  const p = await ctx.newPage();
  await p.goto(MAQ); await p.waitForTimeout(500);
  console.log(`\n=== viewport ${vp.w}x${vp.h} dpr${vp.dpr} ===`);
  for (const r of routes) {
    await p.evaluate((x)=>{const a=document.createElement('a');a.href=x;document.body.append(a);a.click();a.remove();}, r);
    await p.waitForTimeout(350);
    await p.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?null:new Promise(res=>{i.onload=res;i.onerror=res;setTimeout(res,2500);}))));
    const d = await p.evaluate((dpr)=>[...document.images].map(i=>{
      const rr=i.getBoundingClientRect(); const f=i.closest('figure');
      const cap=f&&f.querySelector('figcaption .shell');
      const sh=document.querySelector('main .shell')||document.querySelector('.shell');
      return {nw:i.naturalWidth,dw:+rr.width.toFixed(1),dh:+rr.height.toFixed(1),left:Math.round(rr.left),
        pleine:!!i.closest('.pleine'),
        capL: cap?Math.round(cap.getBoundingClientRect().left):null,
        capW: cap?Math.round(cap.getBoundingClientRect().width):null,
        shL: sh?Math.round(sh.getBoundingClientRect().left):null,
        shW: sh?Math.round(sh.getBoundingClientRect().width):null,
        besoin: Math.round(rr.width*dpr)};
    }), vp.dpr);
    for (const i of d) {
      const flag = i.nw>0 && i.dw > i.nw+0.5 ? ` AGRANDI x${(i.dw/i.nw).toFixed(2)}` : '';
      const flagDpr = i.nw>0 && i.besoin > i.nw ? ` (besoin ${i.besoin}px pour ${i.nw}px reels)` : '';
      if (flag||flagDpr||i.pleine) console.log(`  ${r.padEnd(32)} nw=${String(i.nw).padStart(4)} dw=${String(i.dw).padStart(6)} dh=${String(i.dh).padStart(5)} pleine=${i.pleine?'o':'n'} cap[L=${i.capL} W=${i.capW}] shell[L=${i.shL} W=${i.shW}]${flag}${flagDpr}`);
    }
  }
  await ctx.close();
}
await b.close();
