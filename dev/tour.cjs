// Screenshot tour: `node dev/tour.cjs [desktop|phone] [levels|modes]`
// levels: each campaign environment after 9 s; modes: rivalry showdown,
// race, free run (cycle), debate, board and scoreboard.
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = '/home/user/Game';
// Screenshots go to dev/shots (git-ignored). Run after `npm run build`.
const SHOTS = path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://localhost:4174/?nointro';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const LEVELS = ['expressway', 'ayodhya', 'airport', 'kisan', 'jankalyan', 'lawandorder', 'startup', 'viksit'];
(async () => {
  const srv = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', '4174', '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
  const browser = await chromium.launch({ args: ARGS });
  const phone = process.argv[2] === 'phone';
  const vp = phone ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  const tag = phone ? 'p' : 'd';
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${tag}_t_${n}.png`) });
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  const which = process.argv[3] || 'levels';
  if (which === 'levels') {
    for (const lv of LEVELS) {
      await page.evaluate((lv) => { const u = window.__UPRUN__; u.engine.startRun({ mode: 'campaign', level: lv, character: 'yogi' }); u.autopilot(true); }, lv);
      await page.evaluate(() => window.__UPRUN__.engine.stepManual(9, 1 / 30));
      await page.waitForTimeout(300);
      const i = await page.evaluate(() => window.__UPRUN__.info());
      console.log(lv, i.state, i.d, 'calls', i.calls, 'geo', i.geometries, 'tex', i.textures);
      await shot(lv);
    }
  } else if (which === 'modes') {
    const home = async () => { await page.goto(BASE); await page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 }); await page.waitForTimeout(500); };
    const step = (t) => page.evaluate((t) => window.__UPRUN__.engine.stepManual(t, 1 / 30), t);
    // Rivalry: warning → stumble → entrance → showdown
    await page.click('text=Rivalry • Race • Free Run');
    await page.click('text=Play rivalry ▸');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await step(12);
    // Bot inputs would skip the cinematic: let it play, then drive the chase.
    await page.evaluate(() => { window.__UPRUN__.autopilot(false); window.__UPRUN__.clearRoad(80); window.__UPRUN__.fillMeter(); });
    for (let k = 0; k < 80; k++) {
      await step(0.2);
      const i = await page.evaluate(() => window.__UPRUN__.info());
      if (i.state === 'EVENT_PENDING' && !globalThis.a) { globalThis.a = 1; await page.waitForTimeout(150); await shot('riv_pending'); }
      if (i.state === 'STUMBLE' && !globalThis.b) { globalThis.b = 1; await page.waitForTimeout(150); await shot('riv_stumble'); }
      if (i.state === 'CINEMATIC' && i.stateTime > 1.0 && !globalThis.c) { globalThis.c = 1; await page.waitForTimeout(150); await shot('riv_entrance'); }
      if (i.state === 'CINEMATIC' && i.stateTime > 2.4 && !globalThis.c2) { globalThis.c2 = 1; await page.waitForTimeout(150); await shot('riv_entrance2'); }
      if (i.state === 'CHASE' && !globalThis.ap) { globalThis.ap = 1; await page.evaluate(() => window.__UPRUN__.autopilot(true)); }
      if (i.state === 'CHASE' && i.stateTime > 2 && !globalThis.d) { globalThis.d = 1; await page.waitForTimeout(150); await shot('riv_chase'); break; }
    }
    // Race
    await home();
    await page.click('text=Rivalry • Race • Free Run');
    await page.click('text=Race ▸');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await step(14);
    await page.waitForTimeout(300);
    await shot('race');
    // Free run as Yogi → cycle showdown
    await home();
    await page.click('text=Rivalry • Race • Free Run');
    await page.click('text=Run ▸');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await step(12);
    await page.evaluate(() => { window.__UPRUN__.autopilot(false); window.__UPRUN__.clearRoad(80); window.__UPRUN__.fillMeter(); });
    for (let k = 0; k < 40; k++) { await step(0.2); const i = await page.evaluate(() => window.__UPRUN__.info()); if (i.state === 'CINEMATIC' && i.stateTime > 2.6) break; }
    await page.waitForTimeout(200);
    await shot('free_cycle');
    // Debate
    await home();
    await page.click('text=Debate Arena');
    await page.waitForTimeout(2600);
    await shot('debate_choose');
    await page.click('.debate-options .btn >> nth=0');
    await page.waitForTimeout(800);
    await shot('debate_reply');
    for (let k = 0; k < 40; k++) {
      if (await page.isVisible('text=DEBATE WON!') || await page.isVisible('text=THE CROWD WANTS MORE')) break;
      if (await page.isVisible('.debate-options .btn')) await page.click('.debate-options .btn >> nth=0');
      else if (await page.isVisible('text=Continue')) await page.click('text=Continue');
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1200);
    await shot('debate_done');
    await page.click('text=Main menu');
    await page.click('text=Achievements');
    await page.waitForTimeout(400);
    await shot('board_ach');
    await page.click('text=Evidence board');
    await page.waitForTimeout(300);
    await shot('board_evidence');
    await page.click('.screen-header .btn');
    await page.click('text=Scoreboard');
    await page.waitForTimeout(300);
    await shot('scoreboard');
  }
  console.log('errors', errors);
  await browser.close();
  srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
