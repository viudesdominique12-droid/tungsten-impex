import { chromium } from 'playwright';
const routes=['/','/about/','/contact/','/import/electric-vehicles/','/import/human-medicine/','/training/',
  '/export/niger-seed-noug/','/import/ceramics/','/import/medical-equipment/','/import/elevator-and-escalator/',
  '/export/sesame-seed/','/import/building-glass/','/import/plastic-raw-materials/'];
const b = await chromium.launch();
for (const vp of [{w:1440,h:900,dpr:1},{w:1920,h:1080,dpr:1},{w:390,h:844,dpr:2}]) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:vp.dpr });
  const p = await ctx.newPage();
  console.log(`\n=== SITE ${vp.w}x${vp.h} dpr${vp.dpr} ===`);
  for (const r of routes) {
    await p.goto('http://localhost:4321'+r,{waitUntil:'load'});
    await p.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(450);
    await p.evaluate(()=>Promise.all([...document.images].map(i=>i.complete?null:new Promise(res=>{i.onload=res;i.onerror=res;setTimeout(res,2500);}))));
    const d = await p.evaluate(()=>[...document.images].map(i=>{const rr=i.getBoundingClientRect();
      const f=i.closest('figure'); const cap=f&&f.querySelector('figcaption .shell');
      const sh=document.querySelector('main .shell')||document.querySelector('.shell');
      return{nw:i.naturalWidth,dw:+rr.width.toFixed(1),dh:+rr.height.toFixed(1),pleine:!!i.closest('.pleine'),
      capL:cap?Math.round(cap.getBoundingClientRect().left):null, shL:sh?Math.round(sh.getBoundingClientRect().left):null,
      cur:i.currentSrc.replace('http://localhost:4321','')};}));
    for (const i of d) if (i.pleine || i.dw>i.nw+0.5)
      console.log(`  ${r.padEnd(32)} nw=${String(i.nw).padStart(4)} dw=${String(i.dw).padStart(6)} dh=${String(i.dh).padStart(5)} pleine=${i.pleine?'o':'n'} capL=${i.capL} shL=${i.shL}` + (i.dw>i.nw+0.5?` AGRANDI x${(i.dw/i.nw).toFixed(2)}`:''));
  }
  await ctx.close();
}
await b.close();
