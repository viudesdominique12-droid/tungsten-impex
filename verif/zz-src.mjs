import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 })).newPage();
for (const r of ['/','/training/','/import/human-medicine/','/about/','/contact/','/import/electric-vehicles/']) {
  await p.goto('http://localhost:4321'+r, { waitUntil:'load' });
  await p.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(500);
  const d = await p.evaluate(()=>[...document.images].map(i=>({cur:i.currentSrc,nw:i.naturalWidth,nh:i.naturalHeight,dw:Math.round(i.getBoundingClientRect().width)})));
  console.log(r); d.forEach(x=>console.log('   ',x.nw+'x'+x.nh,'dw='+x.dw,x.cur.replace('http://localhost:4321','')));
}
await b.close();
