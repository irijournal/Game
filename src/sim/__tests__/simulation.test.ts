import { describe, expect, it } from 'vitest';
import { Autopilot } from '../autopilot';
import {
  CHASE_FULL,
  CINEMATIC_FULL,
  CINEMATIC_SHORT,
  EVENT_PENDING_MAX,
  FAILURE_TIME,
  STUMBLE_TIME,
  SUCCESS_TIME,
} from '../constants';
import { Simulation, type SimEvent } from '../simulation';
import type { Action, SimState } from '../types';
import { baseConfig } from './helpers';

function drive(sim: Simulation, seconds: number, opts: { bot?: Autopilot; fps?: number; until?: (s: Simulation) => boolean } = {}) {
  const fps = opts.fps ?? 60;
  const dt = 1 / fps;
  const events: SimEvent[] = [];
  for (let t = 0; t < seconds; t += dt) {
    if (opts.bot) for (const a of opts.bot.decide(sim)) sim.input(a);
    sim.advance(dt);
    events.push(...sim.events);
    sim.events.length = 0;
    if (sim.state === 'GAME_OVER' || opts.until?.(sim)) break;
  }
  return events;
}

const states = (ev: SimEvent[]) => ev.filter((e) => e.type === 'state').map((e) => (e as { to: SimState }).to);

describe('core run', () => {
  it('starts running, accumulates distance and score', () => {
    const sim = new Simulation(baseConfig());
    drive(sim, 2);
    expect(sim.state).toBe('RUNNING');
    expect(sim.d).toBeGreaterThan(20);
    expect(sim.score.total).toBeGreaterThan(20);
  });

  it('pausing (not advancing) freezes score, distance and timers', () => {
    const sim = new Simulation(baseConfig());
    drive(sim, 1);
    const snap = [sim.d, sim.score.total, sim.time];
    sim.advance(0);
    sim.advance(-1);
    expect([sim.d, sim.score.total, sim.time]).toEqual(snap);
  });

  it('clamps huge frame deltas after tab suspension', () => {
    const sim = new Simulation(baseConfig());
    sim.advance(30);
    expect(sim.time).toBeLessThan(0.11);
  });

  it('autopilot survives a long run through ordinary inputs', () => {
    let total = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = new Simulation(baseConfig({ seed }));
      drive(sim, 90, { bot: new Autopilot() });
      total += sim.d;
      expect(sim.stats.distance).toBeGreaterThan(400);
    }
    expect(total / 5).toBeGreaterThan(1000);
  });
});

describe('frame-rate independence', () => {
  it('30, 60 and 120 fps produce the same run for the same inputs', () => {
    const results = [30, 60, 120].map((fps) => {
      const sim = new Simulation(baseConfig({ seed: 77 }));
      const script: [number, Action][] = [
        [0.5, 'left'],
        [1.2, 'jump'],
        [2.0, 'right'],
        [2.4, 'right'],
        [3.1, 'slide'],
      ];
      let t = 0;
      const dt = 1 / fps;
      let i = 0;
      while (t < 4) {
        while (i < script.length && script[i][0] <= t + 1e-9) sim.input(script[i++][1]);
        sim.advance(dt);
        t += dt;
      }
      return { d: sim.d, lane: sim.player.lane, state: sim.state };
    });
    for (const r of results) {
      expect(r.lane).toBe(results[0].lane);
      expect(Math.abs(r.d - results[0].d)).toBeLessThan(0.5);
    }
  });
});

describe('stumble → rival entrance → chase', () => {
  it('a recoverable collision runs the full sequence and returns control', () => {
    const sim = new Simulation(baseConfig({ seed: 9 }));
    drive(sim, 1);
    sim.debugStumble();
    expect(sim.state).toBe('STUMBLE');
    sim.events.length = 0;
    const ev = drive(sim, STUMBLE_TIME + CINEMATIC_FULL + 0.2);
    expect(states(ev)).toEqual(['CINEMATIC', 'CHASE']);
    expect(sim.cinematic.kind).toBe('full');
    expect(sim.chase.active).toBe(true);
    expect(sim.chase.total).toBe(CHASE_FULL);
    // No obstacle right in front of the runner when control returns.
    const near = sim.obstacles.filter((o) => !o.hit && o.s > sim.d && o.s < sim.d + sim.speed * 2);
    expect(near).toEqual([]);
  });

  it('the bot survives the chase and the game returns to RUNNING with a bonus', () => {
    let survived = 0;
    const seeds = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    for (const seed of seeds) {
      const sim = new Simulation(baseConfig({ seed }));
      drive(sim, 1);
      sim.debugStumble();
      const bot = new Autopilot();
      const ev = drive(sim, 40, { bot, until: (s) => s.state === 'RUNNING' && s.chase.count > 0 });
      if (sim.state === 'RUNNING') {
        survived++;
        expect(states(ev)).toContain('SUCCESS');
        expect(sim.score.breakdown().chase).toBeGreaterThanOrEqual(500);
        expect(sim.guardReady).toBe(false);
      }
    }
    expect(survived).toBeGreaterThanOrEqual(9);
  });

  it('dodges shorten the chase (escape by successful movements)', () => {
    const sim = new Simulation(baseConfig({ seed: 21 }));
    drive(sim, 1);
    sim.debugStumble();
    const bot = new Autopilot();
    drive(sim, STUMBLE_TIME + CINEMATIC_FULL + 0.1);
    const start = sim.time;
    drive(sim, 40, { bot, until: (s) => s.state !== 'CHASE' });
    if (sim.state === 'SUCCESS') {
      expect(sim.chase.escapes).toBeGreaterThan(0);
      expect(sim.time - start).toBeLessThan(CHASE_FULL + sim.chase.tokens * 2.5 + 0.1);
    }
  });

  it('a collision during the chase ends the run cleanly', () => {
    const sim = new Simulation(baseConfig({ seed: 5 }));
    drive(sim, 1);
    sim.debugStumble();
    drive(sim, STUMBLE_TIME + CINEMATIC_FULL + 0.1);
    expect(sim.state).toBe('CHASE');
    // No inputs: the runner will hit something.
    const ev = drive(sim, 30);
    expect(states(ev)).toContain('FAILURE');
    expect(sim.state).toBe('GAME_OVER');
    expect(sim.summary?.chaseResult).toBe('failed');
    expect(sim.summary?.reason).toBe('chase');
  });

  it('second entrance in the same run is the short version', () => {
    const sim = new Simulation(baseConfig({ seed: 31 }));
    const bot = new Autopilot();
    // The meter only triggers after 150 m.
    drive(sim, 14, { bot });
    expect(sim.d).toBeGreaterThan(150);
    if (sim.state !== 'RUNNING') return;
    sim.debugFillMeter();
    drive(sim, EVENT_PENDING_MAX + 0.1, { bot, until: (s) => s.state === 'CINEMATIC' });
    expect(sim.state).toBe('CINEMATIC');
    expect(sim.cinematic.kind).toBe('full');
    expect(sim.cinematic.trigger).toBe('meter');
    sim.skipCinematic();
    expect(sim.state).toBe('CHASE');
    drive(sim, 40, { bot, until: (s) => s.state === 'RUNNING' });
    if (sim.state !== 'RUNNING') return; // bot crashed; covered by other tests
    sim.debugFillMeter();
    drive(sim, EVENT_PENDING_MAX + 0.2, { bot, until: (s) => s.state === 'CINEMATIC' });
    expect(sim.state).toBe('CINEMATIC');
    expect(sim.cinematic.kind).toBe('short');
    expect(sim.cinematic.duration).toBe(CINEMATIC_SHORT);
  });

  it('cinematics can be skipped by input', () => {
    const sim = new Simulation(baseConfig());
    drive(sim, 1);
    sim.debugStumble();
    drive(sim, STUMBLE_TIME + 0.5);
    expect(sim.state).toBe('CINEMATIC');
    sim.input('jump');
    expect(sim.state).toBe('CHASE');
    // The skip input must not leak into gameplay as a jump.
    sim.advance(1 / 60);
    expect(sim.player.grounded).toBe(true);
  });

  it('a second collision while the guard recharges ends the run', () => {
    const sim = new Simulation(baseConfig({ seed: 41 }));
    drive(sim, 1);
    sim.debugStumble();
    drive(sim, STUMBLE_TIME + 0.5);
    sim.skipCinematic();
    const bot = new Autopilot();
    drive(sim, 40, { bot, until: (s) => s.state === 'RUNNING' });
    if (sim.state !== 'RUNNING') return;
    expect(sim.guardReady).toBe(false);
    sim.debugStumble();
    expect(sim.state).toBe('FAILURE');
    drive(sim, FAILURE_TIME + 0.1);
    expect(sim.state).toBe('GAME_OVER');
  });
});

describe('Mode B (Bulldozer Chase challenge)', () => {
  it('starts the chase, and the bot can complete it', () => {
    let completed = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Simulation(baseConfig({ mode: 'B', seed }));
      const ev = drive(sim, 60, { bot: new Autopilot() });
      expect(states(ev).slice(0, 2)).toEqual(['CINEMATIC', 'CHASE']);
      if (sim.summary?.completed) completed++;
    }
    expect(completed).toBeGreaterThanOrEqual(5);
  });
});

describe('state machine never gets stuck', () => {
  const LIMIT: Partial<Record<SimState, number>> = {
    STUMBLE: STUMBLE_TIME + 0.05,
    CINEMATIC: CINEMATIC_FULL + 0.05,
    EVENT_PENDING: EVENT_PENDING_MAX + 0.05,
    SUCCESS: SUCCESS_TIME + 0.05,
    FAILURE: FAILURE_TIME + 0.05,
    CHASE: 120,
  };

  it('random inputs on 40 seeds: every non-terminal state exits on time', () => {
    for (let seed = 100; seed < 140; seed++) {
      const sim = new Simulation(baseConfig({ seed, mode: seed % 3 === 0 ? 'B' : seed % 3 === 1 ? 'A' : 'C' }));
      let x = seed;
      const acts: Action[] = ['left', 'right', 'jump', 'slide', 'skip'];
      for (let t = 0; t < 120 && sim.state !== 'GAME_OVER'; t += 1 / 60) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        if (x % 17 === 0) sim.input(acts[x % 5]);
        if (x % 997 === 0) sim.debugFillMeter();
        sim.advance(1 / 60);
        sim.events.length = 0;
        const lim = LIMIT[sim.state];
        if (lim) expect(sim.stateTime).toBeLessThanOrEqual(lim);
      }
    }
  });
});

describe('long session and restart', () => {
  it('15 minutes of play keeps object counts bounded', () => {
    const sim = new Simulation(baseConfig({ seed: 2024 }));
    const bot = new Autopilot();
    let maxObs = 0;
    let maxPick = 0;
    let maxRows = 0;
    let restarts = 0;
    let current = sim;
    for (let t = 0; t < 15 * 60; t += 1 / 60) {
      for (const a of bot.decide(current)) current.input(a);
      current.advance(1 / 60);
      current.events.length = 0;
      maxObs = Math.max(maxObs, current.obstacles.length);
      maxPick = Math.max(maxPick, current.pickups.length);
      maxRows = Math.max(maxRows, current.rows.length);
      if (current.state === 'GAME_OVER') {
        current = new Simulation(baseConfig({ seed: 2024 + ++restarts }));
      }
    }
    expect(maxObs).toBeLessThan(80);
    expect(maxPick).toBeLessThan(260);
    expect(maxRows).toBeLessThan(40);
  });

  it('restarting with the same seed reproduces the same course', () => {
    const a = new Simulation(baseConfig({ seed: 555 }));
    const b = new Simulation(baseConfig({ seed: 555 }));
    drive(a, 3);
    drive(b, 3);
    expect(a.rows.map((r) => [r.s, r.cells.map((c) => c.kind)])).toEqual(b.rows.map((r) => [r.s, r.cells.map((c) => c.kind)]));
    expect(a.d).toBe(b.d);
  });

  it('collectibles are counted exactly once', () => {
    const sim = new Simulation(baseConfig({ seed: 8 }));
    const bot = new Autopilot();
    const ev = drive(sim, 60, { bot });
    const ids = ev.filter((e) => e.type === 'coin').map((e) => (e as { id: number }).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sim.coins).toBe(ev.filter((e) => e.type === 'coin').reduce((n, e) => n + (e as { value: number }).value, 0));
  });
});
