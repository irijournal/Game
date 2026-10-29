/* eslint-disable no-console */
// Browser acceptance tests for UP RUN, run against the PRODUCTION build.
//
//   npm run build && npm run e2e
//
// Uses the Playwright + Chromium that is installed globally in this
// environment (require('playwright')). Each scenario prints PASS/FAIL; the
// process exits non-zero if any scenario fails.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = path.join(ROOT, 'tests/e2e/screenshots');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function startServer() {
  if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) throw new Error('dist/ missing: run `npm run build` first');
  const proc = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return proc;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error('preview server did not start');
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 720 }, hasTouch: !!opts.mobile, isMobile: !!opts.mobile, deviceScaleFactor: 1 });
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return { ctx, page, errors };
}

const ready = (page) => page.waitForFunction(() => !!window.__UPRUN__, null, { timeout: 30000 });
const info = (page) => page.evaluate(() => window.__UPRUN__.info());
const sim = (page, fn) => page.evaluate(fn);

async function scenario(name, fn) {
  try {
    await fn();
  } catch (e) {
    record(name, false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ args: ARGS });

  // 1. First launch: intro is skippable, title Start begins a run with Akhilesh.
  await scenario('intro → skip → title → start (Akhilesh default)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE);
    await ready(page);
    await page.waitForSelector('text=Skip intro', { timeout: 10000 });
    await page.click('text=Skip intro');
    await page.waitForSelector('text=Uttar Pradesh: The Great Political Run', { timeout: 5000 });
    await page.click('text=▶ START');
    // A short per-character starting-line moment plays first.
    await page.waitForFunction(() => window.__UPRUN__.info().d > 5, null, { timeout: 15000 });
    const i = await info(page);
    const ch = await sim(page, () => window.__UPRUN__.engine.sim.cfg.character);
    await page.screenshot({ path: path.join(SHOTS, '01_run.png') });
    record('intro → skip → title → start (Akhilesh default)', i.state === 'RUNNING' && ch === 'akhilesh' && i.d > 0 && errors.length === 0, `state=${i.state} char=${ch} d=${i.d} errors=${errors.length}`);
    await ctx.close();
  });

  // 2. Keyboard controls: lanes, jump, slide, pause/resume (score frozen).
  await scenario('laptop keyboard: ← → Space ↓ Esc', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME');
    await page.click('text=Run ▸');
    await page.evaluate(() => window.__UPRUN__.clearRoad(400));
    await page.waitForTimeout(600);
    const lane0 = await sim(page, () => window.__UPRUN__.engine.sim.player.lane);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const lane1 = await sim(page, () => window.__UPRUN__.engine.sim.player.lane);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const lane2 = await sim(page, () => window.__UPRUN__.engine.sim.player.lane);
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    const st = await sim(page, () => ({ jumps: window.__UPRUN__.engine.sim.stats.jumps, slides: window.__UPRUN__.engine.sim.stats.slides }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const a = await info(page);
    await page.waitForTimeout(1200);
    const b = await info(page);
    const pausedUi = await page.isVisible('text=Paused');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const c = await info(page);
    const ok = lane0 === 1 && lane1 === 0 && lane2 === 2 && st.jumps >= 1 && st.slides >= 1 && a.paused && b.d === a.d && b.score === a.score && pausedUi && !c.paused && c.d > b.d && errors.length === 0;
    record('laptop keyboard: ← → Space ↓ Esc', ok, `lanes ${lane0}->${lane1}->${lane2} jumps=${st.jumps} slides=${st.slides} pausedFrozen=${b.d === a.d} resumed=${c.d > b.d} errors=${errors.length}`);
    await ctx.close();
  });

  // 3. Phone: touch swipes, no page scroll, portrait layout readable.
  await scenario('phone touch swipes (no keyboard)', async () => {
    const { page, errors, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.tap('text=START GAME');
    await page.tap('text=Run ▸');
    await page.evaluate(() => window.__UPRUN__.clearRoad(400));
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    const swipe = async (dx, dy) => {
      const x = 195, y = 520;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 6, y: y + (dy * i) / 6 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(350);
    };
    const lane = () => sim(page, () => window.__UPRUN__.engine.sim.player.lane);
    const l0 = await lane();
    await swipe(-140, 0);
    const l1 = await lane();
    await swipe(140, 0);
    await swipe(140, 0);
    const l2 = await lane();
    await swipe(0, -140);
    await page.waitForTimeout(600);
    await swipe(0, 140);
    const st = await sim(page, () => ({ jumps: window.__UPRUN__.engine.sim.stats.jumps, slides: window.__UPRUN__.engine.sim.stats.slides }));
    const scroll = await page.evaluate(() => (document.scrollingElement ? document.scrollingElement.scrollTop : 0) + window.scrollY);
    const pauseBox = await page.locator('[aria-label="Pause"]').boundingBox();
    await page.screenshot({ path: path.join(SHOTS, '03_phone.png') });
    const ok = l0 === 1 && l1 === 0 && l2 === 2 && st.jumps >= 1 && st.slides >= 1 && scroll === 0 && pauseBox && pauseBox.width >= 44 && pauseBox.height >= 44 && errors.length === 0;
    const state = (await info(page)).state;
    record('phone touch swipes (no keyboard)', ok, `lanes ${l0}->${l1}->${l2} jumps=${st.jumps} slides=${st.slides} state=${state} scroll=${scroll} pauseBtn=${pauseBox && Math.round(pauseBox.width)}px errors=${errors.length}`);
    await ctx.close();
  });

  // 4. Signature sequence: stumble → Yogi entrance → bulldozer chase → escape.
  // The bot drives through the normal input API. Time is stepped in fine,
  // fixed increments so the result does not depend on the (slow, software)
  // frame rate of the test browser; up to 3 attempts.
  await scenario('stumble → Yogi entrance → bulldozer chase → survived', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=Run ▸');
    await page.waitForTimeout(800);
    const seen = new Set();
    let rivalVisible = false;
    let chaserVisible = false;
    let survived = false;
    for (let attempt = 0; attempt < 3 && !survived; attempt++) {
      if (attempt > 0) {
        await page.evaluate(() => (window.__UPRUN__.engine.manual = false));
        await page.click('text=↻ Retry');
        await page.waitForTimeout(600);
      }
      await page.evaluate(() => window.__UPRUN__.stumble());
      for (let i = 0; i < 300; i++) {
        const s = await page.evaluate(() => {
          const e = window.__UPRUN__.engine;
          e.stepManual(0.2, 1 / 60);
          const r = e.rival;
          return { ...window.__UPRUN__.info(), rival: !!r.rival && r.rival.root.visible, veh: !!r.vehicle && r.vehicle.root.visible, kind: r.kind, z: r.vehicle ? r.vehicle.root.position.z : 0, x: r.vehicle ? r.vehicle.root.position.x : 0 };
        });
        seen.add(s.state);
        if (s.state === 'CINEMATIC' || s.state === 'CHASE') rivalVisible = rivalVisible || s.rival;
        // The chaser must stay on the shoulder lane, behind the runner.
        if (s.state === 'CHASE') chaserVisible = chaserVisible || (s.veh && s.kind === 'bulldozer' && s.x > 3.5 && s.z > 1);
        if (s.state === 'CHASE' && s.stateTime > 2 && !fs.existsSync(path.join(SHOTS, '04_chase.png'))) await page.screenshot({ path: path.join(SHOTS, '04_chase.png') });
        if (s.state === 'SUCCESS') survived = true;
        if (survived || s.state === 'GAME_OVER') break;
      }
    }
    await page.evaluate(() => (window.__UPRUN__.engine.manual = false));
    const ok = ['STUMBLE', 'CINEMATIC', 'CHASE', 'SUCCESS'].every((x) => seen.has(x)) && survived && rivalVisible && chaserVisible && errors.length === 0;
    record('stumble → Yogi entrance → bulldozer chase → survived', ok, `states=${[...seen].join(',')} rival=${rivalVisible} chaserOnShoulder=${chaserVisible} errors=${errors.length}`);
    await ctx.close();
  });

  // 5. Chase failure ends cleanly; Retry is a fresh run with a single loop.
  await scenario('chase failure → results → retry (fresh run, one loop)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME');
    await page.click('text=Run ▸');
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__UPRUN__.stumble());
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'CHASE', null, { timeout: 20000 });
    // Do nothing: the runner will hit something.
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'GAME_OVER', null, { timeout: 60000 });
    await page.waitForSelector('text=CAUGHT IN THE CHASE!', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS, '05_results.png') });
    await page.waitForTimeout(800);
    const before = await info(page);
    await page.click('text=↻ Retry');
    await page.waitForTimeout(500);
    const a = await info(page);
    const t0 = Date.now();
    await page.waitForTimeout(2000);
    const b = await info(page);
    const rate = (b.d - a.d) / ((Date.now() - t0) / 1000);
    // One loop: distance grows at ~running speed (13-16 m/s), not double.
    const ok = before.state === 'GAME_OVER' && a.state === 'RUNNING' && a.d < 20 && a.chaseCount === 0 && rate > 6 && rate < 20 && errors.length === 0;
    record('chase failure → results → retry (fresh run, one loop)', ok, `afterRetry d=${a.d} chases=${a.chaseCount} rate=${rate.toFixed(1)} m/s errors=${errors.length}`);
    await ctx.close();
  });

  // 6. Progress persists across a refresh; corrupted saves recover.
  await scenario('save persists after refresh; corrupt save recovers', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.evaluate(() => window.__UPRUN__.save.update((d) => { d.coins = 777; d.best.A = 4242; d.best.overall = 4242; }));
    await page.reload();
    await ready(page);
    const kept = await page.evaluate(() => ({ coins: window.__UPRUN__.save.data.coins, best: window.__UPRUN__.save.data.best.A }));
    await page.evaluate(() => localStorage.setItem('uprun.save', '{"version":2,"coins":"oops",'));
    await page.reload();
    await ready(page);
    const recovered = await page.evaluate(() => ({ coins: window.__UPRUN__.save.data.coins, menu: !!document.querySelector('.menu-screen') }));
    // Leaving the page mid-run banks the run (coins + run count).
    await page.click('text=START GAME');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=Run ▸');
    await page.waitForTimeout(2500);
    const runsBefore = await page.evaluate(() => window.__UPRUN__.save.data.stats.runs);
    await page.reload();
    await ready(page);
    const runsAfter = await page.evaluate(() => window.__UPRUN__.save.data.stats.runs);
    const ok = kept.coins === 777 && kept.best === 4242 && recovered.coins === 0 && recovered.menu && runsAfter === runsBefore + 1 && errors.length === 0;
    record('save persists after refresh; corrupt save recovers', ok, `kept=${JSON.stringify(kept)} recovered=${JSON.stringify(recovered)} runBankedOnLeave=${runsAfter === runsBefore + 1} errors=${errors.length}`);
    await ctx.close();
  });

  // 7. Resize / rotate mid-run keeps the run and the score.
  await scenario('resize + orientation change mid-run', async () => {
    const { page, errors, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.tap('text=START GAME');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.tap('text=Run ▸');
    await page.waitForFunction(() => window.__UPRUN__.info().d > 8, null, { timeout: 20000 });
    const a = await info(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await page.waitForTimeout(500);
    const paused = await info(page);
    await page.screenshot({ path: path.join(SHOTS, '07_landscape_paused.png') });
    await page.tap('text=▶ Resume');
    await page.waitForTimeout(1200);
    const b = await info(page);
    const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return { w: c.clientWidth, h: c.clientHeight }; });
    const ok = paused.paused && b.d > a.d && b.score >= a.score && b.state !== 'GAME_OVER' && canvas.w === 844 && canvas.h === 390 && errors.length === 0;
    record('resize + orientation change mid-run', ok, `pausedOnRotate=${paused.paused} d ${a.d}->${b.d} canvas=${canvas.w}x${canvas.h} errors=${errors.length}`);
    await ctx.close();
  });

  // 8. Tab hidden → auto-pause; no giant time step on return.
  await scenario('tab hidden pauses; no time jump on return', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME');
    await page.click('text=Run ▸');
    await page.evaluate(() => window.__UPRUN__.clearRoad(400));
    await page.waitForFunction(() => window.__UPRUN__.info().d > 8, null, { timeout: 20000 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const a = await info(page);
    await page.waitForTimeout(1500);
    const b = await info(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.click('text=▶ Resume');
    await page.waitForTimeout(150);
    const c = await info(page);
    const ok = a.paused && a.d > 8 && b.d === a.d && !c.paused && c.d - b.d < 10 && errors.length === 0;
    record('tab hidden pauses; no time jump on return', ok, `paused=${a.paused} frozen=${b.d === a.d} jumpAfterResume=${c.d - b.d}m errors=${errors.length}`);
    await ctx.close();
  });

  // 9. Mode B: Bulldozer Chase challenge can be completed through movement
  // (bot inputs, fine fixed time steps, up to 3 attempts via the Retry button).
  await scenario('Mode B bulldozer chase completes (autopilot inputs)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=Chase ▸');
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'CINEMATIC', null, { timeout: 15000 });
    await page.waitForSelector('text=Skip ▸', { timeout: 5000 });
    await page.click('text=Skip ▸');
    let done = false;
    let attempts = 0;
    for (; attempts < 3 && !done; attempts++) {
      if (attempts > 0) {
        await page.evaluate(() => (window.__UPRUN__.engine.manual = false));
        await page.click('text=↻ Retry');
        await page.waitForTimeout(400);
      }
      const r = await page.evaluate(() => {
        const e = window.__UPRUN__.engine;
        for (let i = 0; i < 400 && e.sim.state !== 'GAME_OVER'; i++) e.stepManual(0.2, 1 / 60);
        return e.sim.summary ? e.sim.summary.completed : false;
      });
      await page.waitForTimeout(900);
      done = r && (await page.isVisible('text=CHALLENGE COMPLETE!'));
    }
    await page.screenshot({ path: path.join(SHOTS, '09_modeB.png') });
    await page.evaluate(() => (window.__UPRUN__.engine.manual = false));
    record('Mode B bulldozer chase completes (autopilot inputs)', done && errors.length === 0, `complete=${done} attempts=${attempts} errors=${errors.length}`);
    await ctx.close();
  });

  // 10. Mode C: Yogi selectable; rival becomes Akhilesh on the cycle.
  await scenario('Mode C showdown as Yogi (rival = Akhilesh + cycle)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME');
    await page.click('.seg button:has-text("Yogi")');
    await page.click('text=Showdown ▸');
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__UPRUN__.stumble());
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'CINEMATIC', null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ ch: window.__UPRUN__.engine.sim.cfg.character, rival: window.__UPRUN__.engine.sim.cfg.rival, kind: window.__UPRUN__.engine.rival.kind }));
    await page.screenshot({ path: path.join(SHOTS, '10_modeC_yogi.png') });
    record('Mode C showdown as Yogi (rival = Akhilesh + cycle)', r.ch === 'yogi' && r.rival === 'akhilesh' && r.kind === 'cycle' && errors.length === 0, JSON.stringify(r) + ` errors=${errors.length}`);
    await ctx.close();
  });

  // 11. WebGL unavailable → readable message, not a blank screen.
  await scenario('no WebGL → readable error screen', async () => {
    const { page, ctx } = await newPage(browser, {
      init: () => {
        const orig = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          if (String(type).startsWith('webgl')) return null;
          return orig.call(this, type, ...rest);
        };
      },
    });
    await page.goto(BASE + '?nointro');
    await page.waitForSelector("text=UP RUN can't start", { timeout: 15000 });
    const hasRetry = await page.isVisible('text=Try again');
    record('no WebGL → readable error screen', hasRetry);
    await ctx.close();
  });

  // 12. Audio: every cue and music track can play without throwing.
  await scenario('audio: all cues and tracks play without errors', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=START GAME'); // user gesture unlocks audio
    const r = await page.evaluate(async () => {
      const a = window.__UPRUN__.engine.audio;
      const cues = ['coin', 'jump', 'slide', 'lane', 'bump', 'stumble', 'crash', 'horn', 'stinger', 'success', 'mission', 'powerup', 'click', 'poof', 'token', 'bell', 'warn'];
      for (const c of cues) a.play(c);
      for (const t of ['menu', 'lucknow', 'heritage', 'modern', 'festival', 'chase', 'menu']) {
        a.setTrack(t);
        await new Promise((r) => setTimeout(r, 150));
      }
      a.engine(true);
      await new Promise((r) => setTimeout(r, 200));
      a.engine(false);
      return { state: a.ctx ? a.ctx.state : 'none', cues: cues.length };
    });
    record('audio: all cues and tracks play without errors', r.state === 'running' && errors.length === 0, `context=${r.state} cues=${r.cues} errors=${errors.length}`);
    await ctx.close();
  });

  // 13. Soak: long autopilot session; scene resources stay bounded.
  await scenario('soak: 15 game-minutes keeps resources bounded', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.evaluate(() => {
      const U = window.__UPRUN__;
      U.autopilot(true);
      U.engine.startRun({ mode: 'A', character: 'akhilesh' });
    });
    const samples = [];
    let restarts = 0;
    for (let minute = 0; minute < 15; minute++) {
      const s = await page.evaluate(() => {
        const U = window.__UPRUN__;
        let restarted = 0;
        for (let k = 0; k < 6; k++) {
          U.engine.stepManual(10, 1 / 30);
          if (U.engine.sim.state === 'GAME_OVER') {
            U.engine.startRun({ mode: 'A', character: 'akhilesh' });
            restarted++;
          }
        }
        return { ...U.info(), restarted };
      });
      restarts += s.restarted;
      samples.push(s);
    }
    // Pools fill up while new obstacle types are introduced (first few
    // minutes); after that, GPU resources must plateau, not keep growing.
    const mid = samples[7];
    const last = samples[samples.length - 1];
    const maxObs = Math.max(...samples.map((s) => s.obstacles));
    const maxParticles = Math.max(...samples.map((s) => s.particles));
    const trend = samples.map((s) => s.geometries).join(',');
    const heapOk = !mid.heapMB || last.heapMB <= mid.heapMB * 1.5 + 10;
    const ok = last.geometries <= mid.geometries + 25 && last.textures <= mid.textures + 10 && last.poolCreated < 140 && maxObs < 80 && maxParticles <= 700 && heapOk && errors.length === 0;
    record('soak: 15 game-minutes keeps resources bounded', ok, `geometries/min [${trend}] textures ${mid.textures}->${last.textures} pooledViews=${last.poolCreated} maxObstacles=${maxObs} maxParticles=${maxParticles} heapMB ${mid.heapMB}->${last.heapMB} restarts=${restarts} distance=${last.d}m errors=${errors.length}`);
    await ctx.close();
  });

  await browser.close();
  server.kill();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
