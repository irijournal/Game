import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../content/levels';
import { QUIZ, quizById } from '../../content/quiz';
import { Autopilot } from '../autopilot';
import { CHALLENGE_WARNING, RACE_LENGTH, RACE_PACE, STUMBLE_TIME } from '../constants';
import { OBSTACLES } from '../obstacles';
import { hashString } from '../rng';
import { Simulation, type SimConfig, type SimEvent } from '../simulation';
import type { ThemeId } from '../types';
import { baseConfig } from './helpers';

const quizAnswers = Object.fromEntries(QUIZ.map((q) => [q.id, q.answer]));

function levelConfig(id: ThemeId, seed = 7, over: Partial<SimConfig> = {}): SimConfig {
  const lv = LEVELS.find((l) => l.id === id)!;
  return baseConfig({
    mode: 'campaign',
    character: 'yogi',
    rival: 'akhilesh',
    seed,
    startTheme: lv.id,
    discovered: [lv.id],
    level: { id: lv.id, length: lv.length, tokenGoal: lv.tokenGoal, token: lv.token, diff: lv.diff, events: lv.events },
    quizAnswers,
    ...over,
  });
}

function run(sim: Simulation, seconds: number, bot?: Autopilot, until?: (s: Simulation) => boolean): SimEvent[] {
  const out: SimEvent[] = [];
  for (let t = 0; t < seconds && sim.state !== 'GAME_OVER'; t += 1 / 60) {
    if (bot) for (const a of bot.decide(sim)) sim.input(a);
    sim.advance(1 / 60);
    out.push(...sim.events);
    sim.events.length = 0;
    if (until?.(sim)) break;
  }
  return out;
}

describe('campaign levels', () => {
  for (const lv of LEVELS) {
    it(`level ${lv.num} "${lv.name}" can be completed through ordinary inputs`, () => {
      let completed = 0;
      let bestTokens = 0;
      for (const seed of [11, 22, 33]) {
        const sim = new Simulation(levelConfig(lv.id, seed));
        const ev = run(sim, 240, new Autopilot());
        expect(sim.state).toBe('GAME_OVER');
        if (sim.summary?.completed) {
          completed++;
          expect(sim.summary.level?.stars).toBeGreaterThanOrEqual(1);
          expect(ev.some((e) => e.type === 'levelComplete')).toBe(true);
          bestTokens = Math.max(bestTokens, sim.stats.devTokens);
        }
        // Only this level's environment, never a rotation.
        expect(ev.some((e) => e.type === 'theme')).toBe(false);
      }
      expect(completed).toBeGreaterThanOrEqual(2);
      // The token goal is reachable in principle (the bot does not chase tokens).
      expect(bestTokens).toBeGreaterThan(lv.tokenGoal * 0.3);
    });
  }

  it('development tokens match the level environment', () => {
    const sim = new Simulation(levelConfig('kisan'));
    run(sim, 20, new Autopilot());
    const toks = sim.pickups.filter((p) => p.kind === 'devToken');
    expect(toks.length).toBeGreaterThan(0);
    for (const t of toks) expect(t.variant).toBe('wheat');
  });

  it('a stumble in a level recovers without a chase', () => {
    const sim = new Simulation(levelConfig('expressway'));
    run(sim, 1);
    sim.debugStumble();
    expect(sim.state).toBe('STUMBLE');
    const ev = run(sim, STUMBLE_TIME + 0.2);
    expect(sim.state).toBe('RUNNING');
    expect(ev.some((e) => e.type === 'recover')).toBe(true);
    expect(sim.chase.count).toBe(0);
    expect(sim.guardReady).toBe(false);
    expect(sim.guardT).toBeGreaterThan(0);
    // Second collision before the guard recharges ends the run.
    sim.debugStumble();
    expect(sim.state).toBe('FAILURE');
  });

  it('no obstacles are generated near the finish line', () => {
    const sim = new Simulation(levelConfig('airport'));
    let maxS = 0;
    for (let t = 0; t < 200 && sim.state !== 'GAME_OVER'; t += 1 / 60) {
      for (const a of new Autopilot().decide(sim)) sim.input(a);
      sim.advance(1 / 60);
      sim.events.length = 0;
      for (const o of sim.obstacles) maxS = Math.max(maxS, o.s + o.depth);
    }
    expect(maxS).toBeLessThan(1200 - 30);
  });

  it('each fixed level course is completable and spawns at least 1.8× its token goal', () => {
    for (const lv of LEVELS) {
      // The same seed the game uses for this level (Engine.startRun).
      const sim = new Simulation(levelConfig(lv.id, hashString('level:' + lv.id), { tutorial: false }));
      const bot = new Autopilot();
      const tokens = new Set<number>();
      for (let t = 0; t < 300 && sim.state !== 'GAME_OVER'; t += 1 / 60) {
        for (const a of bot.decide(sim)) sim.input(a);
        sim.advance(1 / 60);
        sim.events.length = 0;
        for (const p of sim.pickups) if (p.kind === 'devToken') tokens.add(p.id);
      }
      expect(sim.summary?.level?.completed, lv.id).toBe(true);
      expect(tokens.size, lv.id).toBeGreaterThanOrEqual(lv.tokenGoal * 1.8);
    }
  });

  it('coins and development tokens never leave a long empty stretch (BUG-022)', () => {
    for (const lv of LEVELS) {
      for (const seed of [1, 2, 3]) {
        const sim = new Simulation(levelConfig(lv.id, seed));
        const seen = new Map<number, number>();
        const bot = new Autopilot();
        for (let t = 0; t < 240 && sim.state !== 'GAME_OVER'; t += 1 / 60) {
          for (const a of bot.decide(sim)) sim.input(a);
          sim.advance(1 / 60);
          sim.events.length = 0;
          for (const p of sim.pickups) if (p.kind === 'coin' || p.kind === 'devToken') seen.set(p.id, p.s);
        }
        const s = [...seen.values()].filter((x) => x > 60 && x < lv.length - 60).sort((a, b) => a - b);
        let gap = 0;
        for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]);
        expect(gap, `${lv.id} seed ${seed}`).toBeLessThan(150);
      }
    }
  });
});

describe('Accountability Gate (quiz)', () => {
  it('announces the question early, keeps the gate clear and scores by lane', () => {
    for (const answerRight of [true, false]) {
      const sim = new Simulation(levelConfig('expressway', 5));
      const bot = new Autopilot();
      const gate = sim.encounters.find((e) => e.kind === 'quiz')!;
      const q = quizById(gate.quizId!)!;
      let announcedAt = -1;
      let result: SimEvent | undefined;
      for (let t = 0; t < 120 && !result && sim.state !== 'GAME_OVER'; t += 1 / 60) {
        // Steer into the chosen answer lane once inside the clear window.
        if (sim.d > gate.s0 - 40) {
          const want = answerRight ? q.answer : (q.answer + 1) % 3;
          if (sim.player.lane < want) sim.input('right');
          else if (sim.player.lane > want) sim.input('left');
        } else for (const a of bot.decide(sim)) sim.input(a);
        sim.advance(1 / 60);
        for (const e of sim.events) {
          if (e.type === 'encounter' && e.kind === 'quiz' && e.phase === 'announce') announcedAt = sim.d;
          if (e.type === 'encounter' && e.kind === 'quiz' && e.phase === 'end') result = e;
        }
        sim.events.length = 0;
        const blocking = sim.obstacles.filter((o) => !o.debris && o.s + o.depth > gate.s0 - 46 && o.s < gate.s0 + 12);
        expect(blocking).toEqual([]);
      }
      expect(announcedAt).toBeGreaterThan(0);
      expect(gate.s0 - announcedAt).toBeGreaterThan(sim.speed * 4);
      expect(result && result.type === 'encounter' && result.enc.correct).toBe(answerRight);
      expect(sim.stats.quizAnswered).toBe(1);
      expect(sim.stats.quizCorrect).toBe(answerRight ? 1 : 0);
    }
  });
});

describe('rival encounters', () => {
  it('Red Cap Challenge: won without a collision, scored once', () => {
    const sim = new Simulation(levelConfig('ayodhya', 3));
    const ev = run(sim, 120, new Autopilot(), (s) => s.encounters.some((e) => e.kind === 'redCap' && e.ended));
    const start = ev.find((e) => e.type === 'encounter' && e.kind === 'redCap' && e.phase === 'start');
    const end = ev.find((e) => e.type === 'encounter' && e.kind === 'redCap' && e.phase === 'end');
    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    if (end && end.type === 'encounter' && !end.enc.failed) {
      expect(sim.stats.rivalWins).toBe(1);
      expect(end.points).toBe(300);
    }
    expect(sim.stats.rivalChallenges).toBe(1);
  });

  it('Red Cap Challenge fails if you crash during it', () => {
    const sim = new Simulation(levelConfig('ayodhya', 3));
    run(sim, 120, new Autopilot(), (s) => s.encounters.some((e) => e.kind === 'redCap' && e.started));
    sim.debugStumble();
    const ev = run(sim, 60, new Autopilot(), (s) => s.encounters.some((e) => e.kind === 'redCap' && e.ended));
    const end = ev.find((e) => e.type === 'encounter' && e.kind === 'redCap' && e.phase === 'end');
    if (end && end.type === 'encounter') expect(end.enc.failed).toBe(true);
    expect(sim.stats.rivalWins).toBe(0);
  });

  it('Promises vs Performance spawns promise tokens among red-tape obstacles', () => {
    const sim = new Simulation(levelConfig('airport', 4));
    const ev = run(sim, 120, new Autopilot(), (s) => s.encounters.some((e) => e.kind === 'promises' && e.ended));
    const enc = sim.encounters.find((e) => e.kind === 'promises');
    const end = ev.find((e) => e.type === 'encounter' && e.kind === 'promises' && e.phase === 'end');
    expect(end).toBeTruthy();
    if (end && end.type === 'encounter') {
      expect(end.enc.total).toBeGreaterThan(3);
      expect(end.enc.got).toBeLessThanOrEqual(end.enc.total);
    }
    expect(enc === undefined || enc.ended).toBe(true);
  });
});

describe('bulldozer power-up (Road Clearing Drive)', () => {
  it('only clears debris kinds, keeps the runner safe, then ends', () => {
    const sim = new Simulation(levelConfig('expressway', 9));
    run(sim, 2, new Autopilot());
    sim.debugCollect('bulldozer');
    expect(sim.bulldozerT).toBeGreaterThan(0);
    expect(sim.invulnerable).toBe(true);
    const debris = sim.obstacles.filter((o) => o.debris);
    expect(debris.length).toBeGreaterThan(2);
    for (const o of debris) expect(OBSTACLES[o.kind].clearable).toBe(true);
    const ev = run(sim, sim.bulldozerT + 0.2);
    const bulldozed = ev.filter((e) => e.type === 'bulldozed');
    expect(bulldozed.length).toBeGreaterThan(0);
    expect(ev.some((e) => e.type === 'crash' || e.type === 'stumble')).toBe(false);
    expect(sim.stats.roadsCleared).toBeGreaterThan(2);
    expect(sim.bulldozerT).toBe(0);
  });

  it('the level places the power-up as a pickup in a clear lane', () => {
    const sim = new Simulation(levelConfig('expressway', 9));
    run(sim, 20, new Autopilot(), (s) => s.pickups.some((p) => p.kind === 'bulldozer'));
    const pk = sim.pickups.find((p) => p.kind === 'bulldozer')!;
    expect(pk).toBeTruthy();
    const blocking = sim.obstacles.filter((o) => o.lane === pk.lane && o.s < pk.s + 4 && o.s + o.depth > pk.s - 20);
    expect(blocking).toEqual([]);
  });
});

describe('Development Race', () => {
  const raceCfg = (pace: number) =>
    baseConfig({ mode: 'race', character: 'yogi', rival: 'akhilesh', startTheme: 'expressway', race: { length: 900, rivalPace: pace } });

  it('a clean run beats the rival', () => {
    let wins = 0;
    for (const seed of [1, 2, 3]) {
      const sim = new Simulation({ ...raceCfg(0.985), seed });
      run(sim, 150, new Autopilot());
      if (sim.summary?.race?.won) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(2);
  });

  it('the production race (length and rival pace) is a contest the bot can still win', () => {
    let wins = 0;
    const margins: number[] = [];
    for (const seed of [5, 6, 7]) {
      const sim = new Simulation({ ...baseConfig({ mode: 'race', character: 'yogi', rival: 'akhilesh', startTheme: 'expressway', race: { length: RACE_LENGTH, rivalPace: RACE_PACE } }), seed });
      run(sim, 200, new Autopilot());
      if (sim.summary?.race?.won) wins++;
      margins.push(sim.summary?.race?.margin ?? 0);
    }
    expect(wins, margins.join()).toBeGreaterThanOrEqual(2);
    // A contest, not a walkover: the rival must not trail by a whole stretch.
    expect(Math.max(...margins)).toBeLessThan(150);
  });

  it('a much faster rival wins and the run ends cleanly', () => {
    const sim = new Simulation(raceCfg(1.6));
    const ev = run(sim, 150, new Autopilot());
    expect(sim.state).toBe('GAME_OVER');
    expect(sim.summary?.reason).toBe('raceLost');
    expect(sim.summary?.race?.won).toBe(false);
    expect(ev.some((e) => e.type === 'raceEnd' && !e.won)).toBe(true);
  });

  it('development tokens boost race progress', () => {
    const sim = new Simulation(raceCfg(0.985));
    run(sim, 1);
    const before = sim.progress;
    sim.debugCollect('devToken');
    expect(sim.raceBoost).toBe(3);
    expect(sim.progress).toBeGreaterThan(before);
  });
});

describe('Rivalry Mode (Governance Showdown)', () => {
  it('warning → scripted stumble → entrance → chase with report cards → next stage', () => {
    const sim = new Simulation(baseConfig({ mode: 'rivalry', character: 'akhilesh', rival: 'yogi', seed: 17 }));
    const bot = new Autopilot();
    run(sim, 14, bot);
    sim.debugFillMeter();
    const ev = run(sim, 60, bot, (s) => s.state === 'RUNNING' && s.chase.count > 0);
    const states = ev.filter((e) => e.type === 'state').map((e) => (e as { to: string }).to);
    expect(ev.find((e) => e.type === 'eventPending')).toMatchObject({ challenge: true });
    expect(states.slice(0, 4)).toEqual(['EVENT_PENDING', 'STUMBLE', 'CINEMATIC', 'CHASE']);
    expect(ev.find((e) => e.type === 'stumble')).toMatchObject({ scripted: true });
    // A scripted challenge stumble does not use up the stumble guard.
    expect(sim.guardReady).toBe(true);
    if (sim.state === 'RUNNING') {
      expect(ev.some((e) => e.type === 'stageUp' && e.stage === 2)).toBe(true);
      expect(sim.stats.stage).toBe(2);
    }
    expect(sim.cfg.rival).toBe('yogi');
    expect(sim.chaseKind).toBe('bulldozer');
  });

  it('the "Political Challenge Ahead!" warning shows before the stumble', () => {
    for (const seed of [17, 18, 19]) {
      const sim = new Simulation(baseConfig({ mode: 'rivalry', character: 'akhilesh', rival: 'yogi', seed }));
      const bot = new Autopilot();
      run(sim, 14, bot);
      sim.debugFillMeter();
      let warnAt = -1;
      let stumbleAt = -1;
      for (let t = 0; t < 10 && stumbleAt < 0; t += 1 / 60) {
        for (const a of bot.decide(sim)) sim.input(a);
        sim.advance(1 / 60);
        for (const e of sim.events) {
          if (e.type === 'eventPending') warnAt = sim.time;
          if (e.type === 'stumble') stumbleAt = sim.time;
        }
        sim.events.length = 0;
      }
      expect(warnAt, `seed ${seed}`).toBeGreaterThan(0);
      expect(stumbleAt - warnAt, `seed ${seed}`).toBeGreaterThanOrEqual(CHALLENGE_WARNING - 1 / 60);
    }
  });

  it('report-card tokens appear during the showdown', () => {
    const sim = new Simulation(baseConfig({ mode: 'rivalry', character: 'akhilesh', rival: 'yogi', seed: 21 }));
    run(sim, 2, new Autopilot());
    sim.debugStumble();
    run(sim, STUMBLE_TIME + 4.5);
    expect(sim.state).toBe('CHASE');
    run(sim, 8, new Autopilot());
    const cards = sim.pickups.filter((p) => p.kind === 'reportCard').length + sim.stats.reportCards;
    expect(cards).toBeGreaterThan(0);
  });
});
