// Open dist-single/index.html straight from disk (file://) and play a bit.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (!r.url().endsWith('favicon.svg')) errors.push('requestfailed ' + r.url().slice(0, 80)); });
  await page.goto('file://' + path.resolve(__dirname, '../dist-single/index.html') + '?nointro');
  await page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 });
  await page.click('text=CAMPAIGN');
  await page.click('.level-card >> nth=0');
  await page.evaluate(() => window.__UPRUN__.autopilot(true));
  await page.click('text=START AS');
  await page.waitForFunction(() => window.__UPRUN__.info().d > 5, null, { timeout: 30000 });
  const i = await page.evaluate(() => window.__UPRUN__.info());
  const font = await page.evaluate(() => document.fonts.check("800 20px 'Baloo 2'"));
  await page.screenshot({ path: process.argv[2] });
  console.log(JSON.stringify({ state: i.state, d: i.d, font, errors }));
  await browser.close();
})();
