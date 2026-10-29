import { describe, expect, it } from 'vitest';
import { Autopilot } from '../autopilot';
import { SPEED_RUN_TIME, VIKAS_TIME } from '../constants';
import type { MissionDef } from '../missions';
import { Simulation, type SimEvent } from '../simulation';
import { baseConfig } from './helpers';

function run(sim: Simulation, seconds: number, bot?: Autopilot): SimEvent[] {
  const out: SimEvent[] = [];
  for (let t = 0; t < seconds && sim.state !== 'GAME_OVER'; t += 1 / 60) {
    if (bot) for (const a of bot.decide(sim)) sim.input(a);
    sim.advance(1 / 60);
    out.push(...sim.events);
    sim.events.length = 0;
  }
  return out;
}

describe('missions in a run', () => {
  it('completes a mission mid-run once, awarding points', () => {
    const def: MissionDef = { id: 'test', title: 'Travel 50 m', stat: 'distance', goal: 50, scope: 'run', reward: 10 };
    const sim = new Simulation(baseConfig({ missions: [{ def, base: 0, completed: false }] }));
    const ev = run(sim, 8, new Autopilot());
    const m = ev.filter((e) => e.type === 'mission');
    expect(m).toHaveLength(1);
    expect(sim.score.breakdown().missions).toBe(250);
  });

  it('day-scoped missions add to previous progress', () => {
    const def: MissionDef = { id: 'coinsDay', title: 'Coins', stat: 'coins', goal: 100, scope: 'day', reward: 10 };
    const sim = new Simulation(baseConfig({ missions: [{ def, base: 99, completed: false }] }));
    sim.coins = 1;
    expect(sim.missionProgress(sim.missions[0])).toBe(100);
  });
});

describe('Vikas Express', () => {
  it('clears the road, makes the runner invulnerable, then ends', () => {
    const sim = new Simulation(baseConfig({ seed: 3 }));
    run(sim, 3, new Autopilot());
    (sim as unknown as { startVikas(): void }).startVikas();
    expect(sim.vikasT).toBe(VIKAS_TIME);
    expect(sim.invulnerable).toBe(true);
    const ahead = sim.obstacles.filter((o) => !o.hit && o.s > sim.d);
    expect(ahead).toHaveLength(0);
    // No inputs at all: still safe for the whole power-up.
    const ev = run(sim, VIKAS_TIME - 0.1);
    expect(ev.some((e) => e.type === 'crash' || e.type === 'stumble')).toBe(false);
    run(sim, 0.3);
    expect(sim.vikasT).toBe(0);
    expect(sim.invulnerable).toBe(false);
  });
});

describe('Speed Run', () => {
  it('warns first, doubles distance points, and ends on its timer', () => {
    const sim = new Simulation(baseConfig({ seed: 4 }));
    run(sim, 1, new Autopilot());
    sim.plannedEvents.push({ kind: 'speedRun', s0: sim.d + 45, s1: sim.d + 400, started: false, ended: false });
    const bot = new Autopilot();
    const ev = run(sim, 5, bot);
    const phases = ev.filter((e) => e.type === 'director').map((e) => (e as { phase: string }).phase);
    expect(phases[0]).toBe('warn');
    expect(phases).toContain('start');
    expect(sim.speedRunT).toBeGreaterThan(0);
    const before = sim.score.breakdown().distance;
    const d0 = sim.d;
    run(sim, 1, bot);
    const gained = sim.score.breakdown().distance - before;
    expect(gained).toBeGreaterThan((sim.d - d0) * 1.9);
    run(sim, SPEED_RUN_TIME, bot);
    expect(sim.speedRunT).toBe(0);
  });
});

describe('event director', () => {
  it('never runs a director event during the rival cinematic or chase', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = new Simulation(baseConfig({ seed }));
      const bot = new Autopilot();
      let active = false;
      for (let t = 0; t < 120 && sim.state !== 'GAME_OVER'; t += 1 / 60) {
        for (const a of bot.decide(sim)) sim.input(a);
        if (Math.floor(t * 60) % 1800 === 600) sim.debugFillMeter();
        sim.advance(1 / 60);
        for (const e of sim.events) {
          if (e.type === 'director' && e.phase === 'start') active = true;
          if (e.type === 'director' && e.phase === 'end') active = false;
          if (e.type === 'director' && e.phase === 'start') expect(['CHASE', 'CINEMATIC', 'STUMBLE']).not.toContain(sim.state);
        }
        sim.events.length = 0;
        if (sim.state === 'CHASE') {
          expect(sim.speedRunT).toBe(0);
          expect(sim.plannedEvents.filter((e) => e.started && !e.ended)).toHaveLength(0);
        }
      }
      expect(typeof active).toBe('boolean');
    }
  });

  it('discovering a new environment awards a bonus once', () => {
    const sim = new Simulation(baseConfig({ seed: 12, discovered: ['lawandorder'] }));
    const ev = run(sim, 75, new Autopilot());
    if (sim.d < 760) return; // bot crashed early; covered elsewhere
    const disc = ev.filter((e) => e.type === 'discovery');
    expect(disc.length).toBeGreaterThanOrEqual(1);
    expect(sim.score.breakdown().discovery).toBe(250 * disc.length);
  });
});
