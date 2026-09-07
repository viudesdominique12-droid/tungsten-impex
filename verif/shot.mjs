import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('.', import.meta.url));
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
for (const [path, name] of [['/about/', 'about'], ['/training/', 'training'], ['/contact/', 'contact']]) {
  await p.goto('http://localhost:4321' + path, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  ${name.padEnd(10)} debordement ${over}px`);
}
await b.close();
