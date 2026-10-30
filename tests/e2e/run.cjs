/* eslint-disable no-console */
// Browser acceptance tests for UP RUN: Development vs. Gundaraj, run
// against the PRODUCTION build.
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
  // E2E_ONLY="part of a name|another" runs a subset.
  const only = process.env.E2E_ONLY;
  if (only && !only.split('|').some((o) => name.includes(o))) return;
  try {
    await fn();
  } catch (e) {
    record(name, false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}

/** Step the engine in fixed increments (deterministic; independent of the slow software renderer). */
const step = (page, seconds, dt = 1 / 60) => page.evaluate(([s, d]) => window.__UPRUN__.engine.stepManual(s, d), [seconds, dt]);
const release = (page) => page.evaluate(() => (window.__UPRUN__.engine.manual = false));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ args: ARGS });

  // 1. First launch: intro is skippable; the title's Play button starts Level 1 as the hero.
  await scenario('intro → skip → title → Level 1 as Yogi', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE);
    await ready(page);
    await page.waitForSelector('text=Skip intro', { timeout: 10000 });
    await page.click('text=Skip intro');
    await page.waitForSelector('text=Development vs. Gundaraj', { timeout: 5000 });
    await page.click('text=PLAY LEVEL 1');
    await page.waitForFunction(() => window.__UPRUN__.info().d > 5, null, { timeout: 20000 });
    const i = await info(page);
    const cfg = await sim(page, () => ({ mode: window.__UPRUN__.engine.sim.cfg.mode, ch: window.__UPRUN__.engine.sim.cfg.character, level: window.__UPRUN__.engine.sim.cfg.level.id }));
    const hud = await page.isVisible('text=LEVEL 1 • EXPRESSWAY RUN');
    await page.screenshot({ path: path.join(SHOTS, '01_level1.png') });
    record('intro → skip → title → Level 1 as Yogi', i.state === 'RUNNING' && cfg.mode === 'campaign' && cfg.ch === 'yogi' && cfg.level === 'expressway' && hud && errors.length === 0, `${JSON.stringify(cfg)} hud=${hud} errors=${errors.length}`);
    await ctx.close();
  });

  // 2. Keyboard: arrows and A/D lanes, Space/W jump, ↓/S slide, Esc pause (score frozen).
  await scenario('laptop keyboard: ← → A D Space W ↓ S Esc', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Rivalry • Race • Free Run');
    await page.click('text=Run ▸');
    await page.evaluate(() => window.__UPRUN__.clearRoad(500));
    await page.waitForTimeout(2000);
    const lane = () => sim(page, () => window.__UPRUN__.engine.sim.player.lane);
    const lanes = [await lane()];
    for (const k of ['ArrowLeft', 'ArrowRight', 'KeyD', 'KeyA']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(300);
      lanes.push(await lane());
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(800);
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(900);
    await page.keyboard.press('KeyS');
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
    const ok = lanes.join() === '1,0,1,2,1' && st.jumps >= 2 && st.slides >= 2 && a.paused && b.d === a.d && b.score === a.score && pausedUi && !c.paused && c.d > b.d && errors.length === 0;
    record('laptop keyboard: ← → A D Space W ↓ S Esc', ok, `lanes ${lanes.join('->')} jumps=${st.jumps} slides=${st.slides} pausedFrozen=${b.d === a.d} resumed=${c.d > b.d} errors=${errors.length}`);
    await ctx.close();
  });

  // 3. Phone: swipes and the on-screen touch buttons; no page scroll; 44 px targets.
  await scenario('phone: swipes + touch buttons (no keyboard)', async () => {
    const { page, errors, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.tap('text=Rivalry • Race • Free Run');
    await page.tap('text=Run ▸');
    await page.evaluate(() => window.__UPRUN__.clearRoad(500));
    await page.waitForTimeout(2000);
    const cdp = await ctx.newCDPSession(page);
    const swipe = async (dx, dy) => {
      const x = 195, y = 420;
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
    await page.waitForTimeout(600);
    // On-screen buttons (shown by default on touch devices).
    const btns = await page.locator('.touch-btn').count();
    await page.tap('[aria-label="Move left"]');
    await page.waitForTimeout(300);
    const l3 = await lane();
    await page.tap('[aria-label="Jump"]');
    await page.waitForTimeout(700);
    const st = await sim(page, () => ({ jumps: window.__UPRUN__.engine.sim.stats.jumps, slides: window.__UPRUN__.engine.sim.stats.slides }));
    const scroll = await page.evaluate(() => (document.scrollingElement ? document.scrollingElement.scrollTop : 0) + window.scrollY);
    const boxes = await page.locator('.touch-btn, [aria-label="Pause"]').evaluateAll((els) => els.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]));
    const big = boxes.every(([w, h]) => w >= 44 && h >= 44);
    await page.screenshot({ path: path.join(SHOTS, '03_phone.png') });
    const ok = l0 === 1 && l1 === 0 && l2 === 2 && l3 === 1 && btns === 4 && st.jumps >= 2 && st.slides >= 1 && scroll === 0 && big && errors.length === 0;
    record('phone: swipes + touch buttons (no keyboard)', ok, `lanes ${l0}->${l1}->${l2}->${l3} buttons=${btns} jumps=${st.jumps} slides=${st.slides} scroll=${scroll} targets≥44=${big} errors=${errors.length}`);
    await ctx.close();
  });

  // 4. Every campaign level is playable to its reward screen through ordinary inputs.
  await scenario('all 8 campaign levels: finish → stars → badge → next level', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    const ids = ['expressway', 'ayodhya', 'airport', 'kisan', 'jankalyan', 'lawandorder', 'startup', 'viksit'];
    const out = [];
    for (let n = 0; n < ids.length; n++) {
      const id = ids[n];
      await page.click('text=CAMPAIGN');
      await page.click(`.level-card >> nth=${n}`);
      await page.evaluate(() => window.__UPRUN__.autopilot(true));
      await page.click('text=START AS');
      let res = null;
      for (let k = 0; k < 400 && !res; k++) {
        await step(page, 1);
        res = await sim(page, () => window.__UPRUN__.engine.sim.summary && window.__UPRUN__.engine.sim.summary.level);
      }
      await step(page, 2.5); // victory beat, then the reward screen
      await release(page);
      await page.waitForSelector('text=LEVEL COMPLETE!', { timeout: 5000 }).catch(() => null);
      const reward = await page.isVisible('text=LEVEL COMPLETE!');
      const badge = await page.isVisible('text=Badge earned');
      if (n === 0 || n === 7) await page.screenshot({ path: path.join(SHOTS, `04_reward_${id}.png`) });
      const saved = await page.evaluate((lid) => window.__UPRUN__.save.data.levels[lid], id);
      out.push({ id, done: !!(res && res.completed), stars: res ? res.stars : 0, tokens: res ? `${res.tokens}/${res.goal}` : '-', reward, badge, saved: saved.completed });
      await page.evaluate(() => window.__UPRUN__.autopilot(false));
      if (n < ids.length - 1) {
        const next = await page.isVisible('text=▶ Next:');
        out[out.length - 1].next = next;
      }
      await page.click('text=⌂ Main menu');
      await page.waitForTimeout(300);
    }
    const unlocked = await sim(page, () => window.__UPRUN__.save.data.badges.length);
    const ok = out.every((r) => r.done && r.reward && r.badge && r.saved && r.stars >= 1 && (r.next === undefined || r.next)) && unlocked === 8 && errors.length === 0;
    record('all 8 campaign levels: finish → stars → badge → next level', ok, out.map((r) => `${r.id}:${r.done ? r.stars + '★ ' + r.tokens : 'FAIL'}`).join(' ') + ` badges=${unlocked} errors=${errors.length}`);
    await ctx.close();
  });

  // 5. Accountability Gate: the question shows with A/B/C lanes; the right lane scores and shows the sourced fact.
  await scenario('Accountability Gate: question → right lane → +200 and fact card', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=CAMPAIGN');
    await page.click('.level-card >> nth=0');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=START AS');
    let q = null;
    for (let k = 0; k < 200 && !q; k++) {
      await step(page, 0.5);
      q = await sim(page, () => window.__UPRUN__.hud().quiz);
    }
    // Keep the bot driving until the runner is inside the gate's obstacle-free approach.
    for (let k = 0; k < 100; k++) {
      const inside = await sim(page, () => {
        const s = window.__UPRUN__.engine.sim;
        const e = s.encounters.find((x) => x.kind === 'quiz' && !x.ended);
        return !e || s.d > e.s0 - 44;
      });
      if (inside) break;
      await step(page, 0.1);
    }
    await release(page);
    const panel = await page.isVisible('.quiz-panel');
    const opts = await page.locator('.quiz-opt').count();
    await page.screenshot({ path: path.join(SHOTS, '05_quiz.png') });
    // Take the wheel: steer into the answer lane (the road before the gate is kept clear).
    await page.evaluate(() => window.__UPRUN__.autopilot(false));
    const answer = await sim(page, () => {
      const e = window.__UPRUN__.engine.sim.encounters.find((x) => x.kind === 'quiz' && !x.ended);
      return window.__UPRUN__.engine.sim.cfg.quizAnswers[e.quizId];
    });
    for (let k = 0; k < 3; k++) {
      const l = await sim(page, () => window.__UPRUN__.engine.sim.player.lane);
      if (l === answer) break;
      await page.keyboard.press(l > answer ? 'ArrowLeft' : 'ArrowRight');
      await step(page, 0.3);
    }
    let done = null;
    for (let k = 0; k < 40 && !done; k++) {
      await step(page, 0.25);
      done = await sim(page, () => {
        const e = window.__UPRUN__.engine.sim.encounters.find((x) => x.kind === 'quiz');
        return e && e.ended ? { correct: e.correct, chosen: e.chosen } : null;
      });
    }
    await release(page);
    await page.waitForTimeout(300);
    const toast = await page.isVisible('text=CORRECT!');
    const fact = await page.isVisible('.fact-toast');
    const label = fact ? await page.textContent('.fact-toast .fact-type') : '';
    const stats = await sim(page, () => window.__UPRUN__.engine.sim.stats.quizCorrect);
    await page.screenshot({ path: path.join(SHOTS, '05_quiz_result.png') });
    const ok = q && panel && opts === 3 && done && done.correct && toast && fact && /fact|Government|claim|Fictional/i.test(label) && stats === 1 && errors.length === 0;
    record('Accountability Gate: question → right lane → +200 and fact card', ok, `q="${q && q.q}" panel=${panel} options=${opts} result=${JSON.stringify(done)} toast=${toast} fact=${label} errors=${errors.length}`);
    await ctx.close();
  });

  // 6. Rivalry Mode: warning → scripted stumble → hero entrance → bulldozer showdown → escape → next stage.
  await scenario('Rivalry: challenge → stumble → hero entrance → showdown escaped → stage 2', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Rivalry • Race • Free Run');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=Play rivalry ▸');
    const seen = new Set();
    let heroVisible = false;
    let chaserOk = false;
    let warning = false;
    let showdownCaption = false;
    let stage = 1;
    for (let attempt = 0; attempt < 3 && stage < 2; attempt++) {
      if (attempt > 0) {
        await release(page);
        await page.click('text=↻ Retry');
        await page.waitForTimeout(500);
      }
      await step(page, 10);
      // Let the cinematic play out (bot inputs would skip it), then drive the showdown.
      await page.evaluate(() => { window.__UPRUN__.autopilot(false); window.__UPRUN__.fillMeter(); });
      for (let i = 0; i < 400; i++) {
        const s = await page.evaluate(() => {
          const e = window.__UPRUN__.engine;
          e.stepManual(0.1, 1 / 60);
          const r = e.rival;
          return { ...window.__UPRUN__.info(), stage: e.sim.stats.stage, hero: !!r.rival && r.rival.root.visible, veh: !!r.vehicle && r.vehicle.root.visible, kind: r.kind, z: r.vehicle ? r.vehicle.root.position.z : 0, x: r.vehicle ? r.vehicle.root.position.x : 0 };
        });
        seen.add(s.state);
        if (s.state === 'EVENT_PENDING' && !warning) {
          await release(page);
          warning = await page.waitForSelector('text=POLITICAL CHALLENGE AHEAD!', { timeout: 1500 }).then(() => true, () => false);
        }
        if (s.state === 'CINEMATIC') {
          heroVisible = heroVisible || s.hero;
          if (s.stateTime > 2 && !showdownCaption) {
            await release(page);
            showdownCaption = await page.isVisible('text=GOVERNANCE SHOWDOWN!');
            if (showdownCaption) await page.screenshot({ path: path.join(SHOTS, '06_entrance.png') });
          }
        }
        if (s.state === 'CHASE') {
          await page.evaluate(() => window.__UPRUN__.autopilot(true));
          // The chaser keeps to the shoulder lane, behind the runner: it never touches anyone.
          chaserOk = chaserOk || (s.veh && s.kind === 'bulldozer' && s.x > 3.5 && s.z > 1);
          if (s.stateTime > 2 && !fs.existsSync(path.join(SHOTS, '06_showdown.png'))) await page.screenshot({ path: path.join(SHOTS, '06_showdown.png') });
        }
        stage = s.stage;
        if (stage >= 2 || s.state === 'GAME_OVER') break;
      }
    }
    await release(page);
    const ok = ['EVENT_PENDING', 'STUMBLE', 'CINEMATIC', 'CHASE', 'SUCCESS'].every((x) => seen.has(x)) && warning && showdownCaption && heroVisible && chaserOk && stage >= 2 && errors.length === 0;
    record('Rivalry: challenge → stumble → hero entrance → showdown escaped → stage 2', ok, `states=${[...seen].join(',')} warning=${warning} caption=${showdownCaption} hero=${heroVisible} chaserOnShoulder=${chaserOk} stage=${stage} errors=${errors.length}`);
    await ctx.close();
  });

  // 7. The showdown is losable; results; Retry is a fresh run with a single loop.
  await scenario('showdown lost → results → retry (fresh run, one loop)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Rivalry • Race • Free Run');
    await page.click('text=Play rivalry ▸');
    await page.waitForTimeout(2200);
    await page.evaluate(() => window.__UPRUN__.stumble());
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'CHASE', null, { timeout: 20000 });
    // Do nothing: the runner will hit something.
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'GAME_OVER', null, { timeout: 60000 });
    await page.waitForSelector('text=CAUGHT IN THE SHOWDOWN!', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS, '07_caught.png') });
    await page.waitForTimeout(800);
    const before = await info(page);
    await page.click('text=↻ Retry');
    await page.waitForTimeout(500);
    const a = await info(page);
    const t0 = Date.now();
    await page.waitForTimeout(2000);
    const b = await info(page);
    const rate = (b.d - a.d) / ((Date.now() - t0) / 1000);
    const ok = before.state === 'GAME_OVER' && a.state === 'RUNNING' && a.d < 20 && a.chaseCount === 0 && rate > 6 && rate < 22 && errors.length === 0;
    record('showdown lost → results → retry (fresh run, one loop)', ok, `afterRetry d=${a.d} chases=${a.chaseCount} rate=${rate.toFixed(1)} m/s errors=${errors.length}`);
    await ctx.close();
  });

  // 8. Bulldozer power-up: drives ahead of the runner on the road and only pushes debris aside.
  await scenario('bulldozer power-up clears debris ahead (never near people)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=CAMPAIGN');
    await page.click('.level-card >> nth=0');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=START AS');
    await step(page, 4);
    await page.evaluate(() => window.__UPRUN__.collect('bulldozer'));
    let maxAbsX = 0;
    let minZ = 0;
    let maxZ = -99;
    for (let k = 0; k < 20; k++) {
      await step(page, 0.25);
      const h = await sim(page, () => { const v = window.__UPRUN__.engine.encounters.helper.root; return v.visible ? { x: v.position.x, z: v.position.z } : null; });
      if (h && k > 4) {
        maxAbsX = Math.max(maxAbsX, Math.abs(h.x));
        minZ = Math.min(minZ, h.z);
        maxZ = Math.max(maxZ, h.z);
      }
    }
    await release(page);
    const label = await page.isVisible('text=Clearing debris');
    await page.screenshot({ path: path.join(SHOTS, '08_bulldozer.png') });
    const st = await sim(page, () => ({ cleared: window.__UPRUN__.engine.sim.stats.roadsCleared, state: window.__UPRUN__.engine.sim.state, collisions: window.__UPRUN__.engine.sim.stats.collisions }));
    // Ahead of the runner (negative z), on the carriageway (|x| < 3.7), clearing debris.
    const ok = label && maxZ < -5 && maxAbsX < 3.7 && st.cleared > 0 && st.state === 'RUNNING' && errors.length === 0;
    record('bulldozer power-up clears debris ahead (never near people)', ok, `label=${label} helper z ${minZ.toFixed(1)}..${maxZ.toFixed(1)} |x|≤${maxAbsX.toFixed(1)} cleared=${st.cleared} state=${st.state} errors=${errors.length}`);
    await ctx.close();
  });

  // 9. Development Race: race HUD, parallel rival, a result either way.
  await scenario('Development Race runs to a result screen', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Rivalry • Race • Free Run');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=Race ▸');
    await step(page, 20);
    const hud = await sim(page, () => window.__UPRUN__.hud().race);
    await release(page);
    const bar = await page.isVisible('.race-track');
    let sum = null;
    for (let k = 0; k < 200 && !sum; k++) {
      await step(page, 1);
      sum = await sim(page, () => window.__UPRUN__.engine.sim.summary);
    }
    await step(page, 2.5);
    await release(page);
    const title = (await page.isVisible('text=RACE WON!')) ? 'RACE WON!' : (await page.isVisible('text=RIVAL WINS THE RACE')) ? 'RIVAL WINS' : 'none';
    await page.screenshot({ path: path.join(SHOTS, '09_race.png') });
    const ok = hud && hud.progress > 0 && hud.rival > 0 && bar && sum && sum.race && title !== 'none' && errors.length === 0;
    record('Development Race runs to a result screen', ok, `hud=${JSON.stringify(hud)} bar=${bar} result=${sum && JSON.stringify(sum.race)} reason=${sum && sum.reason} screen=${title} errors=${errors.length}`);
    await ctx.close();
  });

  // 10. Free Run as Yogi: the rival arrives on the giant cycle.
  await scenario('Free Run as Yogi (rival = Akhilesh + cycle)', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Rivalry • Race • Free Run');
    await page.click('.seg button:has-text("Yogi")');
    await page.click('text=Run ▸');
    await page.waitForTimeout(2200);
    await page.evaluate(() => window.__UPRUN__.stumble());
    await page.waitForFunction(() => window.__UPRUN__.info().state === 'CINEMATIC', null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ ch: window.__UPRUN__.engine.sim.cfg.character, rival: window.__UPRUN__.engine.sim.cfg.rival, kind: window.__UPRUN__.engine.rival.kind }));
    await page.screenshot({ path: path.join(SHOTS, '10_free_yogi.png') });
    record('Free Run as Yogi (rival = Akhilesh + cycle)', r.ch === 'yogi' && r.rival === 'akhilesh' && r.kind === 'cycle' && errors.length === 0, JSON.stringify(r) + ` errors=${errors.length}`);
    await ctx.close();
  });

  // 11. Manifesto Mayhem: crates of fictional promises parachute from the
  // rival's cycle-copter onto validated spots; the manifesto runs empty.
  await scenario('Manifesto Mayhem: falling promises → manifesto empty', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Manifesto Mayhem');
    const label = await page.isVisible('text=invented exaggeration');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=PLAY AS');
    let falling = false;
    let copter = false;
    let sum = null;
    for (let k = 0; k < 400 && !sum; k++) {
      const s = await page.evaluate(() => {
        const e = window.__UPRUN__.engine;
        e.stepManual(0.5, 1 / 60);
        const views = [...e.obstacleViews.values()];
        return {
          falling: views.some((v) => (v.kind === 'promiseCrate' || v.kind === 'promiseStack') && v.root.position.y > 1 && v.chute && v.chute.every((c) => c.visible)),
          copter: e.encounters.copter.visible && e.encounters.copter.position.y > 5,
          sum: e.sim.summary ? { completed: e.sim.summary.completed, dodged: e.sim.stats.fakePromisesDodged, chases: e.sim.chase.count } : null,
        };
      });
      if (s.falling && !falling) {
        falling = true;
        await release(page);
        await page.screenshot({ path: path.join(SHOTS, '11_mayhem.png') });
      }
      copter = copter || s.copter;
      sum = s.sum;
    }
    await step(page, 2.5);
    await release(page);
    const title = (await page.isVisible('text=MANIFESTO EMPTY!')) ? 'empty' : (await page.isVisible('text=BURIED IN PROMISES!')) ? 'buried' : 'none';
    const saved = await sim(page, () => ({ wins: window.__UPRUN__.save.data.stats.mayhemWins, dodged: window.__UPRUN__.save.data.stats.fakePromisesDodged }));
    await page.screenshot({ path: path.join(SHOTS, '11_mayhem_end.png') });
    const ok = label && falling && copter && sum && sum.completed && sum.dodged > 10 && sum.chases === 0 && title === 'empty' && saved.wins === 1 && saved.dodged === sum.dodged && errors.length === 0;
    record('Manifesto Mayhem: falling promises → manifesto empty', ok, `label=${label} falling=${falling} copter=${copter} result=${JSON.stringify(sum)} screen=${title} saved=${JSON.stringify(saved)} errors=${errors.length}`);
    await ctx.close();
  });

  // 11b. Governance Room: five fictional cases decided with due process →
  // model-governance report card; then the Hinglish switch (persists on reload).
  await scenario('Governance Room: 5 cases → report card; Hinglish switch', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('.menu-screen >> text=Governance Room');
    const label = await page.isVisible('text=Every case, place, gang and person in the Governance Room is fictional');
    await page.click('text=START THE SHIFT');
    const BEST = ['mandi.squad', 'witness.protect', 'encroach.notice', 'college.patrol', 'paper.reexam', 'rumour.factcheck', 'sand.drone', 'backlog.lab'];
    const seen = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('.gov-case');
      seen.push(await page.textContent('.gov-count'));
      const id = await page.evaluate((best) => [...document.querySelectorAll('[data-choice]')].map((b) => b.dataset.choice).find((c) => best.includes(c)), BEST);
      await page.click(`[data-choice="${id}"]`);
      await page.waitForSelector('.gov-result');
      if (i === 1) {
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(SHOTS, '11b_governance_case.png') });
      }
      await page.click(i < 4 ? 'text=Next case' : 'text=See the report card');
    }
    await page.waitForSelector('.gov-report');
    const title = await page.textContent('.gov-report h3');
    const contextFacts = await page.locator('.fact-card.claim').count();
    await page.screenshot({ path: path.join(SHOTS, '11b_governance_report.png') });
    const saved = await page.evaluate(() => {
      const d = window.__UPRUN__.save.data;
      return { shifts: d.stats.governanceShifts, best: d.stats.governanceBest, ach: d.achievements.includes('ach.ruleOfLaw'), coins: d.coins };
    });
    // Hinglish: switch on the menu, check a few labels, reload, still Hinglish.
    await page.click('text=Menu');
    await page.click('.menu-screen >> text=English → Hinglish');
    const hiMenu = (await page.isVisible('.menu-screen >> text=Kirdaar')) && (await page.isVisible('.menu-screen >> text=Achievements aur Facts'));
    await page.reload();
    await ready(page);
    await page.waitForSelector('.menu-screen');
    const kept = await page.isVisible('.menu-screen >> text=Kirdaar');
    await page.click('.menu-screen >> text=Governance Room');
    await page.click('text=SHIFT SHURU KARO');
    const hiCase = await page.isVisible('text=Aap kya karenge?');
    await page.screenshot({ path: path.join(SHOTS, '11b_governance_hinglish.png') });
    await page.click('[aria-label="Back"]');
    await page.click('.menu-screen >> text=Hinglish → English');
    const back = await page.isVisible('.menu-screen >> text=Characters');
    const ok = label && seen.join(',') === 'Case 1/5,Case 2/5,Case 3/5,Case 4/5,Case 5/5' && /Model Governance/.test(title) && contextFacts === 2 && saved.shifts === 1 && saved.best === 3 && saved.ach && saved.coins === 85 && hiMenu && kept && hiCase && back && errors.length === 0;
    record('Governance Room: 5 cases → report card; Hinglish switch', ok, `label=${label} cases=${seen.join(',')} title=${title} facts=${contextFacts} saved=${JSON.stringify(saved)} hinglish=${hiMenu}/${kept}/${hiCase} back=${back} errors=${errors.length}`);
    await ctx.close();
  });

  // 12. Every menu button leads somewhere real (no decorative buttons); board, sources and scoreboard labels.
  await scenario('menus: every button works; evidence board + scoreboard labels', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    const targets = [
      ['CAMPAIGN', 'Eight levels across a fictionalised Uttar Pradesh'],
      ['Rivalry • Race • Free Run', 'Play modes'],
      ['Achievements & Facts', 'How to read'],
      ['Scoreboard', 'Performance is the real scoreboard'],
      ['Characters', 'Rival: played in Rivalry Mode'],
      ['Missions', 'Daily missions'],
      ['Unlocks', 'Start route'],
      ['Settings', 'On-screen touch buttons'],
      ['Manifesto Mayhem', 'Crates of fictional promises'],
      ['Governance Room', 'Five cases land on your desk'],
    ];
    const res = [];
    for (const [btn, expect] of targets) {
      await page.click(`.menu-screen >> text=${btn}`);
      if (btn === 'Achievements & Facts') await page.click('text=Evidence board');
      if (btn === 'Characters') await page.click('[aria-label="Next character"]');
      const okScreen = await page.waitForSelector(`text=${expect}`, { timeout: 3000 }).then(() => true, () => false);
      res.push([btn, okScreen]);
      await page.click('[aria-label="Back"]');
      await page.waitForSelector('.menu-screen', { timeout: 3000 });
    }
    // Evidence board: every type is labelled; sources open in a new tab.
    await page.click('.menu-screen >> text=Achievements & Facts');
    await page.click('text=Evidence board');
    await page.click('.seg >> text=Political claim');
    const claims = await page.locator('.fact-card.claim').count();
    const others = await page.locator('.fact-card:not(.claim)').count();
    await page.click('.seg >> text=All');
    await page.click('text=Sources (3) >> nth=0');
    const link = await page.locator('.sources a').first().evaluate((a) => ({ href: a.href, target: a.target, rel: a.rel }));
    await page.screenshot({ path: path.join(SHOTS, '12_evidence.png') });
    await page.click('[aria-label="Back"]');
    await page.click('.menu-screen >> text=Scoreboard');
    const fictional = await page.isVisible('text=Game points are fictional');
    const ok = res.every(([, o]) => o) && claims > 0 && others === 0 && /^https:\/\//.test(link.href) && link.target === '_blank' && link.rel.includes('noopener') && fictional && errors.length === 0;
    record('menus: every button works; evidence board + scoreboard labels', ok, `${res.map(([b, o]) => `${b}:${o ? 'ok' : 'FAIL'}`).join(' | ')} claimsFilter=${claims}/${others} link=${link.href.slice(0, 40)} fictionalNote=${fictional} errors=${errors.length}`);
    await ctx.close();
  });

  // 13. Progress persists across a refresh; corrupted saves recover; a run is banked on leave.
  await scenario('save persists after refresh; corrupt save recovers', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.evaluate(() => window.__UPRUN__.save.update((d) => { d.coins = 777; d.best.free = 4242; d.best.overall = 4242; d.levels.expressway.completed = true; d.levels.expressway.stars = 2; }));
    await page.reload();
    await ready(page);
    const kept = await page.evaluate(() => ({ coins: window.__UPRUN__.save.data.coins, best: window.__UPRUN__.save.data.best.free, stars: window.__UPRUN__.save.data.levels.expressway.stars }));
    await page.click('text=CAMPAIGN');
    const level2Open = await page.locator('.level-card >> nth=1').isEnabled();
    await page.click('[aria-label="Back"]');
    await page.evaluate(() => localStorage.setItem('uprun.save', '{"version":3,"coins":"oops",'));
    await page.reload();
    await ready(page);
    const recovered = await page.evaluate(() => ({ coins: window.__UPRUN__.save.data.coins, menu: !!document.querySelector('.menu-screen') }));
    await page.click('text=Rivalry • Race • Free Run');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.click('text=Run ▸');
    await page.waitForTimeout(2500);
    const runsBefore = await page.evaluate(() => window.__UPRUN__.save.data.stats.runs);
    await page.reload();
    await ready(page);
    const runsAfter = await page.evaluate(() => window.__UPRUN__.save.data.stats.runs);
    const ok = kept.coins === 777 && kept.best === 4242 && kept.stars === 2 && level2Open && recovered.coins === 0 && recovered.menu && runsAfter === runsBefore + 1 && errors.length === 0;
    record('save persists after refresh; corrupt save recovers', ok, `kept=${JSON.stringify(kept)} level2Unlocked=${level2Open} recovered=${JSON.stringify(recovered)} runBankedOnLeave=${runsAfter === runsBefore + 1} errors=${errors.length}`);
    await ctx.close();
  });

  // 14. Resize / rotate mid-level keeps the run.
  await scenario('resize + orientation change mid-level', async () => {
    const { page, errors, ctx } = await newPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.tap('text=CAMPAIGN');
    await page.tap('.level-card >> nth=0');
    await page.evaluate(() => window.__UPRUN__.autopilot(true));
    await page.tap('text=START AS');
    await page.waitForFunction(() => window.__UPRUN__.info().d > 8, null, { timeout: 20000 });
    const a = await info(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await page.waitForTimeout(500);
    const paused = await info(page);
    await page.tap('text=▶ Resume');
    await page.waitForTimeout(1500);
    const b = await info(page);
    await page.screenshot({ path: path.join(SHOTS, '14_landscape.png') });
    const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return { w: c.clientWidth, h: c.clientHeight }; });
    const ok = paused.paused && b.d > a.d && b.score >= a.score && b.state !== 'GAME_OVER' && canvas.w === 844 && canvas.h === 390 && errors.length === 0;
    record('resize + orientation change mid-level', ok, `pausedOnRotate=${paused.paused} d ${a.d}->${b.d} canvas=${canvas.w}x${canvas.h} errors=${errors.length}`);
    await ctx.close();
  });

  // 15. Tab hidden → auto-pause; no giant time step on return.
  await scenario('tab hidden pauses; no time jump on return', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Rivalry • Race • Free Run');
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

  // 16. WebGL unavailable → readable message, not a blank screen.
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

  // 17. Audio: every cue and music track can play without throwing.
  await scenario('audio: all cues and tracks play without errors', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.click('text=Settings'); // user gesture unlocks audio
    const r = await page.evaluate(async () => {
      const a = window.__UPRUN__.engine.audio;
      const cues = ['coin', 'jump', 'slide', 'lane', 'bump', 'stumble', 'crash', 'horn', 'stinger', 'success', 'mission', 'powerup', 'click', 'poof', 'token', 'bell', 'warn', 'correct', 'wrong', 'fanfare'];
      for (const c of cues) a.play(c);
      const tracks = ['menu', 'expressway', 'ayodhya', 'airport', 'kisan', 'jankalyan', 'lawandorder', 'startup', 'viksit', 'chase', 'mayhem', 'menu'];
      for (const t of tracks) {
        a.setTrack(t);
        await new Promise((r) => setTimeout(r, 120));
      }
      a.engine(true);
      await new Promise((r) => setTimeout(r, 200));
      a.engine(false);
      return { state: a.ctx ? a.ctx.state : 'none', cues: cues.length, tracks: tracks.length - 1 };
    });
    record('audio: all cues and tracks play without errors', r.state === 'running' && errors.length === 0, `context=${r.state} cues=${r.cues} tracks=${r.tracks} errors=${errors.length}`);
    await ctx.close();
  });

  // 18. Soak: long free-run session; scene resources stay bounded.
  await scenario('soak: 15 game-minutes keeps resources bounded', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await page.goto(BASE + '?nointro');
    await ready(page);
    await page.evaluate(() => {
      const U = window.__UPRUN__;
      U.autopilot(true);
      U.engine.startRun({ mode: 'free', character: 'yogi' });
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
            U.engine.startRun({ mode: 'free', character: 'yogi' });
            restarted++;
          }
        }
        return { ...U.info(), restarted };
      });
      restarts += s.restarted;
      samples.push(s);
    }
    // Pools fill while new environments and obstacle types appear (the
    // first rotation through all 8 environments takes 6,000 m); after that
    // GPU resources must plateau, not keep growing.
    const mid = samples[9];
    const last = samples[samples.length - 1];
    const maxObs = Math.max(...samples.map((s) => s.obstacles));
    const maxParticles = Math.max(...samples.map((s) => s.particles));
    const trend = samples.map((s) => s.geometries).join(',');
    const heapOk = !mid.heapMB || last.heapMB <= mid.heapMB * 1.5 + 10;
    const ok = last.geometries <= mid.geometries + 25 && last.textures <= mid.textures + 12 && last.poolCreated < 220 && maxObs < 80 && maxParticles <= 700 && heapOk && errors.length === 0;
    record('soak: 15 game-minutes keeps resources bounded', ok, `geometries/min [${trend}] textures ${mid.textures}->${last.textures} pooledViews=${last.poolCreated} maxObstacles=${maxObs} maxParticles=${maxParticles} heapMB ${mid.heapMB}->${last.heapMB} restarts=${restarts} distance=${last.d}m calls=${last.calls} errors=${errors.length}`);
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
