import { LANE_CHANGE_TIME, PLAYER_HALF_D } from './constants';
import { canTransition, passable } from './generator';
import type { Simulation } from './simulation';
import type { Action, Obstacle, Row } from './types';

/**
 * A simple bot that plays the game through the public input API. It is used
 * by the automated tests (to prove routes and chases are survivable through
 * ordinary inputs) and by the browser soak test. It is deliberately not
 * perfect: it plans lanes with the same rules as the route validator and
 * reacts to the obstacle directly ahead.
 */
export class Autopilot {
  private lastLaneMoveT = -1;

  decide(sim: Simulation): Action[] {
    if (!sim.acceptsInput()) return [];
    const out: Action[] = [];
    const p = sim.player;
    const d = sim.d;
    const v = Math.max(sim.speed, 1);

    const rows = sim.rows
      .filter((r) => !r.passed && r.end > d - PLAYER_HALF_D)
      .sort((a, b) => a.s - b.s)
      .slice(0, 6);

    // ---- lane planning
    const target = this.planLane(sim, rows);
    if (target !== null && target !== p.lane && sim.time - this.lastLaneMoveT > LANE_CHANGE_TIME * 0.9) {
      const dir = target < p.lane ? -1 : 1;
      const next = p.lane + dir;
      if (this.lateralClear(sim, next)) {
        out.push(dir < 0 ? 'left' : 'right');
        this.lastLaneMoveT = sim.time;
      }
    }

    // ---- vertical reactions in the current lane
    const lane = p.lane;
    let nearest: Obstacle | null = null;
    for (const ob of sim.obstacles) {
      if (ob.lane !== lane || ob.hit || ob.s + ob.depth < d - PLAYER_HALF_D) continue;
      if (!nearest || ob.s < nearest.s) nearest = ob;
    }
    if (nearest && !p.changingLane) {
      const dist = nearest.s - (d + PLAYER_HALF_D);
      if (nearest.cls === 'low' && dist < v * 0.16 + 0.2 && dist > -0.2 && p.grounded) out.push('jump');
      else if (nearest.cls === 'gap' && dist < v * 0.08 + 0.35 && p.grounded) out.push('jump');
      else if (nearest.cls === 'high' && dist < v * 0.22 + 0.3 && !p.sliding) out.push('slide');
    }
    return out;
  }

  /** Best lane for the next row: fewest lane changes over the next rows. */
  private planLane(sim: Simulation, rows: Row[]): number | null {
    if (!rows.length) return null;
    const p = sim.player;
    const vAt = sim.vCons;
    // cost[i][lane]
    const INF = 1e9;
    const cost: number[][] = rows.map(() => [INF, INF, INF]);
    const from: number[][] = rows.map(() => [-1, -1, -1]);
    for (let b = 0; b < 3; b++) {
      if (!passable(rows[0], b)) continue;
      const dist = rows[0].s - sim.d;
      const lanes = Math.abs(b - p.lane);
      if (lanes === 0 || (dist > lanes * sim.speed * LANE_CHANGE_TIME * 1.2 + 1 && this.pathClear(sim, p.lane, b, rows[0].s)))
        cost[0][b] = lanes;
    }
    for (let i = 1; i < rows.length; i++) {
      for (let b = 0; b < 3; b++) {
        for (let a = 0; a < 3; a++) {
          if (cost[i - 1][a] >= INF) continue;
          if (!canTransition(rows[i - 1], rows[i], a, b, vAt, sim.d)) continue;
          const c = cost[i - 1][a] + Math.abs(a - b) + (b === 1 ? 0 : 0.01);
          if (c < cost[i][b]) {
            cost[i][b] = c;
            from[i][b] = a;
          }
        }
      }
    }
    // Walk back from the cheapest reachable final lane.
    let last = rows.length - 1;
    while (last >= 0 && Math.min(...cost[last]) >= INF) last--;
    if (last < 0) return null;
    let lane = cost[last].indexOf(Math.min(...cost[last]));
    for (let i = last; i > 0; i--) lane = from[i][lane];
    return lane;
  }

  private pathClear(sim: Simulation, a: number, b: number, until: number): boolean {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (const ob of sim.obstacles) {
      if (ob.hit || ob.lane < lo || ob.lane > hi || ob.lane === a) continue;
      if (ob.s + ob.depth > sim.d - PLAYER_HALF_D - 0.3 && ob.s < until - 0.5) return false;
    }
    return true;
  }

  private lateralClear(sim: Simulation, lane: number): boolean {
    const d = sim.d;
    const reach = sim.speed * LANE_CHANGE_TIME + PLAYER_HALF_D + 0.6;
    for (const ob of sim.obstacles) {
      if (ob.hit || ob.lane !== lane) continue;
      if (ob.s + ob.depth > d - PLAYER_HALF_D - 0.3 && ob.s < d + reach) return false;
    }
    return true;
  }
}
