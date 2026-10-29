import { contactFor, isOverhead, supportFrom } from '../collision';
import { SIM_DT } from '../constants';
import { OBSTACLES } from '../obstacles';
import { Player } from '../player';
import type { Lane, Obstacle, Row } from '../types';
import type { SimConfig } from '../simulation';

export function rowsToObstacles(rows: Row[]): Obstacle[] {
  const out: Obstacle[] = [];
  let id = 1;
  for (const row of rows) {
    row.cells.forEach((c, lane) => {
      if (!c.kind || !c.cls) return;
      const def = OBSTACLES[c.kind];
      out.push({
        id: id++,
        kind: c.kind,
        cls: def.cls,
        lane: lane as Lane,
        s: row.s,
        depth: def.depth,
        bottom: def.bottom,
        top: def.top,
        halfW: def.halfW,
        rowId: row.id,
        gantry: false,
        flags: 0,
        hit: false,
        passed: false,
        debris: false,
      });
    });
  }
  return out;
}

type Act = 'none' | 'left' | 'right' | 'jump' | 'slide';
const ACTS: Act[] = ['none', 'left', 'right', 'jump', 'slide'];

interface St {
  p: Player;
  d: number;
  flags: number[];
}

/**
 * Exhaustive-ish physics search: is there *any* sequence of inputs (decided
 * every 50 ms) that gets a runner from `startLane` past every row without a
 * crash, using the real Player and collision code? Used to cross-check the
 * route validator.
 */
export function physicsSurvivable(rows: Row[], startLane: Lane, speed: (s: number) => number, startS: number): boolean {
  const obs = rowsToObstacles(rows).sort((a, b) => a.s - b.s);
  const endS = rows[rows.length - 1].end + 1.5;
  const p0 = new Player();
  p0.reset(startLane);
  let frontier: St[] = [{ p: p0, d: startS, flags: obs.map(() => 0) }];
  const STEPS = 8; // decide every 1/15 s
  const near = (d: number) => {
    const out: number[] = [];
    for (let i = 0; i < obs.length; i++) {
      if (obs[i].s > d + 14) break;
      if (obs[i].s + obs[i].depth > d - 2) out.push(i);
    }
    return out;
  };
  for (let iter = 0; iter < 4000 && frontier.length; iter++) {
    const next = new Map<string, St>();
    for (const st of frontier) {
      const idx = near(st.d);
      for (const act of ACTS) {
        const p = st.p.clone();
        const flags = st.flags.slice();
        let d = st.d;
        let alive = true;
        let under = false;
        const box = () => ({ x: p.x, y: p.y, h: p.height, d });
        for (const i of idx) if (isOverhead(box(), obs[i])) under = true;
        if (act === 'left') p.moveLeft();
        else if (act === 'right') p.moveRight();
        else if (act === 'jump' && !under) p.jump();
        else if (act === 'slide') p.slide();
        for (let k = 0; k < STEPS && alive; k++) {
          let ground = 0;
          under = false;
          const b0 = box();
          for (const i of idx) {
            ground = Math.max(ground, supportFrom(b0, obs[i]));
            if (isOverhead(b0, obs[i])) under = true;
          }
          p.step(SIM_DT, ground, under);
          d += speed(d) * SIM_DT;
          const b1 = box();
          for (const i of idx) {
            const ob = obs[i];
            const r = contactFor(b1, ob, flags[i]);
            flags[i] = r.flags;
            if (r.contact === 'crash') {
              alive = false;
              break;
            }
            if (r.contact === 'bump') p.bounceBack();
            if (r.contact === 'land') {
              p.y = ob.top;
              p.vy = 0;
              p.grounded = true;
              p.airTime = 0;
              p.jumpedThisAir = false;
            }
          }
        }
        if (!alive) continue;
        if (d > endS) return true;
        // Coarse state key: nearby states behave the same over the next step.
        const key = [
          p.lane,
          p.prevLane,
          Math.round(p.x * 2),
          Math.round(p.y * 3),
          Math.round(p.vy / 3),
          p.sliding ? Math.round(p.slideT * 6) : -1,
          p.jumpedThisAir ? 1 : 0,
          p.slideQueued ? 1 : 0,
          idx.map((i) => flags[i] & 8).join(''),
        ].join('|');
        if (!next.has(key)) next.set(key, { p, d, flags });
      }
    }
    frontier = [...next.values()];
    if (frontier.length > 400) frontier = frontier.filter((_, i) => i % Math.ceil(frontier.length / 400) === 0);
  }
  return false;
}

export function baseConfig(over: Partial<SimConfig> = {}): SimConfig {
  return {
    mode: 'free',
    character: 'akhilesh',
    rival: 'yogi',
    seed: 1234,
    startTheme: 'lawandorder',
    shortCinematics: false,
    missions: [],
    discovered: ['lawandorder'],
    tutorial: false,
    ...over,
  };
}
