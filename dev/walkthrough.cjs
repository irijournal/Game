// UI walkthrough: `node dev/walkthrough.cjs [desktop|phone]` — intro, title,
// menu, campaign, level intro, Level 1 to the reward screen.
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = '/home/user/Game';
// Screenshots go to dev/shots (git-ignored). Run after `npm run build`.
const SHOTS = path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://localhost:4174/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
(async () => {
  const srv = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', '4174', '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
  const browser = await chromium.launch({ args: ARGS });
  const vp = process.argv[2] === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 500, isMobile: vp.width < 500 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  const tag = vp.width < 500 ? 'p' : 'd';
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${tag}_${n}.png`) });
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot('01_intro');
  await page.click('text=Skip intro');
  await page.waitForTimeout(800);
  await shot('02_title');
  await page.click('text=Main menu');
  await page.waitForTimeout(800);
  await shot('03_menu');
  await page.click('text=CAMPAIGN');
  await page.waitForTimeout(500);
  await shot('04_campaign');
  await page.click('text=Expressway Run');
  await page.waitForTimeout(500);
  await shot('05_level_intro');
  await page.click('text=START AS');
  await page.waitForTimeout(2500);
  await shot('06_run_start');
  await page.evaluate(() => window.__UPRUN__.autopilot(true));
  const eng = () => page.evaluate(() => window.__UPRUN__.info());
  // step deterministically
  for (let k = 0; k < 70; k++) {
    await page.evaluate(() => window.__UPRUN__.engine.stepManual(1.5, 1 / 30));
    const i = await eng();
    const hud = await page.evaluate(() => window.__UPRUN__.hud());
    if (k % 4 === 0) console.log(k, i.state, i.d, 'calls', i.calls, 'quiz', !!hud.quiz, 'tokens', hud.level && hud.level.tokens);
    if (hud.quiz && !hud.quiz.chosen && !globalThis.qShot) { globalThis.qShot = 1; await shot('07_quiz'); }
    if (hud.power && hud.power.kind === 'bulldozer' && !globalThis.bShot) { globalThis.bShot = 1; await shot('08_bulldozer'); }
    if (i.state === 'GAME_OVER') break;
  }
  await page.evaluate(() => window.__UPRUN__.engine.stepManual(2.5, 1 / 30));
  await page.waitForTimeout(600);
  await shot('09_result');
  console.log('final', await eng());
  console.log('errors', errors);
  await browser.close();
  srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
