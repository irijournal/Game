// Theme / event tour with the menu UI hidden. node dev/tour.cjs <outdir>
const { chromium } = require('playwright');
(async () => {
  const [, , out, w = '1280', h = '720'] = process.argv;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5173/?nointro');
  await page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 });
  await page.addStyleTag({ content: '.panel-screen{display:none !important}' });
  const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
  for (const theme of ['lucknow', 'heritage', 'modern', 'festival']) {
    await page.evaluate((t) => {
      const U = window.__UPRUN__;
      U.save.update((d) => { d.unlocked.push('route.' + t); d.startRoute = t; });
      U.autopilot(true);
      U.engine.startRun({ mode: 'A', character: t === 'festival' ? 'ummeedwar' : t === 'modern' ? 'yogi' : 'akhilesh' });
      U.engine.stepManual(6);
    }, theme);
    await shot('t_' + theme);
  }
  // Vikas Express.
  await page.evaluate(() => { const e = window.__UPRUN__.engine; e.sim.startVikas(); e.stepManual(1.5); });
  await shot('e_vikas');
  // Speed run + coin rush (inject planned events just ahead).
  await page.evaluate(() => {
    const e = window.__UPRUN__.engine; const s = e.sim;
    s.vikasT = 0; e.stepManual(3);
    s.plannedEvents.push({ kind: 'speedRun', s0: s.d + 5, s1: s.d + 200, started: false, ended: false });
    e.stepManual(1.5);
  });
  await shot('e_speedrun');
  // Magnet.
  await page.evaluate(() => { const e = window.__UPRUN__.engine; e.sim.magnetT = 8; e.stepManual(1); });
  await shot('e_magnet');
  // Collision debug view.
  await page.evaluate(() => { const U = window.__UPRUN__; U.save.update((d) => (d.settings.debugColliders = true)); U.engine.applySettings(U.save.data.settings); U.engine.stepManual(1); });
  await shot('e_colliders');
  console.log(JSON.stringify(await page.evaluate(() => window.__UPRUN__.info())));
  console.log('ERRORS\n' + errors.join('\n'));
  await browser.close();
})();
