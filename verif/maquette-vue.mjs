import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
const html = readFileSync('verif/maquette.html', 'utf8');
const b = await chromium.launch();
for (const [o, n] of [[{ viewport: { width: 1440, height: 900 } }, 'maq-bureau'],
                      [{ ...devices['iPhone 12'] }, 'maq-mobile']]) {
  const p = await (await b.newContext(o)).newPage();
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`,
                     { waitUntil: 'load' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `verif/${n}.png`, fullPage: n === 'maq-bureau' });
  await p.close();
}
await b.close(); console.log('maquette capturee');
