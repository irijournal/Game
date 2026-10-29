// Deterministic visual driver using engine.stepManual.
// node dev/drive3.cjs <outdir> <w> <h> <mode> <character>
const { chromium } = require('playwright');
(async () => {
  const [, , out, w = '1280', h = '720', mode = 'A', character = 'akhilesh'] = process.argv;
  const mobile = +w < 700;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  await page.goto('http://localhost:5173/?nointro');
  await page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 });
  const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
  const step = (s) => page.evaluate((s) => window.__UPRUN__.engine.stepManual(s), s);
  const info = () => page.evaluate(() => window.__UPRUN__.info());
  const stepUntil = async (pred, max = 60) => {
    for (let t = 0; t < max; t += 0.1) { await step(0.1); const i = await info(); if (pred(i)) return i; }
    return info();
  };
  await page.waitForTimeout(500);
  await step(1);
  await shot('s01_menu');
  await page.evaluate(([m, c]) => { window.__UPRUN__.autopilot(true); window.__UPRUN__.engine.startRun({ mode: m, character: c }); }, [mode, character]);
  await step(4);
  await shot('s02_run');
  console.log('run', JSON.stringify(await info()));
  if (mode !== 'B') {
    await page.evaluate(() => window.__UPRUN__.stumble());
    await step(0.3);
    await shot('s03_stumble');
  }
  await stepUntil((i) => i.state === 'CINEMATIC');
  for (const [t, name] of [[0.6, 'c1'], [1.4, 'c2'], [2.2, 'c3'], [2.8, 'c4'], [3.5, 'c5']]) {
    await stepUntil((i) => i.state !== 'CINEMATIC' || i.stateTime >= t);
    await shot('s04_' + name);
  }
  await stepUntil((i) => i.state === 'CHASE' && i.stateTime > 1.5);
  await shot('s05_chase');
  await stepUntil((i) => i.state === 'CHASE' && i.stateTime > 7);
  await shot('s06_chase2');
  console.log('chase', JSON.stringify(await info()));
  const e = await stepUntil((i) => i.state !== 'CHASE', 60);
  await step(0.4);
  await shot('s07_' + e.state);
  console.log('end', JSON.stringify(await info()));
  await page.evaluate(() => { window.__UPRUN__.engine.setAutopilot(false); });
  await stepUntil((i) => i.state === 'FAILURE' && i.stateTime > 1.2, 60);
  await shot('s08_fail');
  await stepUntil((i) => i.state === 'GAME_OVER', 10);
  await step(0.5);
  await page.waitForTimeout(900);
  await shot('s09_over');
  console.log('over', JSON.stringify(await info()));
  console.log('ERRORS\n' + errors.slice(0, 30).join('\n'));
  await browser.close();
})();
