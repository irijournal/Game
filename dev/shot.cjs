const { chromium } = require('playwright');
(async () => {
const [,, url, out, w = '1200', h = '700'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__done === true, null, { timeout: 30000 }).catch(() => {});
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS', errors.join('\n'));
await browser.close();
})();
