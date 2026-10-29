import { describe, expect, it } from 'vitest';
import { contactFor, F_IGNORE } from '../collision';
import { PLAYER_HALF_D, SIM_DT } from '../constants';
import { OBSTACLES } from '../obstacles';
import { Player } from '../player';
import type { Lane, Obstacle, ObstacleKind } from '../types';
import { physicsSurvivable } from './helpers';
import type { Row } from '../types';
import { EMPTY_CELL } from '../generator';

function ob(kind: ObstacleKind, lane: Lane, s: number): Obstacle {
  const d = OBSTACLES[kind];
  return { id: 1, kind, cls: d.cls, lane, s, depth: d.depth, bottom: d.bottom, top: d.top, halfW: d.halfW, rowId: 1, gantry: false, flags: 0, hit: false, passed: false, debris: false };
}

function row(s: number, cells: (ObstacleKind | null)[]): Row {
  const c = cells.map((k) => (k ? { cls: OBSTACLES[k].cls, kind: k, depth: OBSTACLES[k].depth } : EMPTY_CELL));
  const end = s + Math.max(...c.map((x) => x.depth), 0.3);
  return { id: 1, s, end, cells: c as Row['cells'], passed: false, chase: false };
}

describe('contact classification', () => {
  it('reports a frontal crash when running into a wall', () => {
    const o = ob('gundarajBoard', 1, 10);
    let flags = 0;
    let contact = 'none';
    for (let d = 8; d < 11 && contact === 'none'; d += 0.1) {
      const r = contactFor({ x: 0, y: 0, h: 1.75, d }, o, flags);
      flags = r.flags;
      contact = r.contact;
    }
    expect(contact).toBe('crash');
  });

  it('reports a side bump when moving into an obstacle alongside', () => {
    const o = ob('bus', 0, 10);
    const d = 13; // alongside the bus
    let r = contactFor({ x: 0, y: 0, h: 1.75, d }, o, 0);
    expect(r.contact).toBe('none');
    r = contactFor({ x: -1.0, y: 0, h: 1.75, d }, o, r.flags);
    expect(r.contact).toBe('bump');
    expect(r.flags & F_IGNORE).toBeTruthy();
  });

  it('never collides with a gap while airborne, always when grounded over it', () => {
    const o = ob('roadGap', 1, 10);
    expect(contactFor({ x: 0, y: 0.5, h: 1.75, d: 11.5 }, o, 0).contact).toBe('none');
    expect(contactFor({ x: 0, y: 0, h: 1.75, d: 11.5 }, o, 0).contact).toBe('crash');
    // Edges are forgiving.
    expect(contactFor({ x: 0, y: 0, h: 1.75, d: 10.1 }, o, 0).contact).toBe('none');
  });

  it('ignores obstacles that were knocked away', () => {
    const o = ob('barricade', 1, 10);
    o.hit = true;
    expect(contactFor({ x: 0, y: 0, h: 1.75, d: 10.2 }, o, 0).contact).toBe('none');
  });
});

describe('physics: actions clear their obstacle class', () => {
  const speeds = [13, 19, 26 * 1.25];
  for (const v of speeds) {
    it(`jump clears a low barrier at ${v.toFixed(1)} m/s`, () => {
      expect(physicsSurvivable([row(40, [null, 'barricade', null])].map((r) => ({ ...r, cells: [{ ...r.cells[0] }, r.cells[1], r.cells[2]] as Row['cells'] })), 1, () => v, 0)).toBe(true);
    });
    it(`slide clears an overhead barrier at ${v.toFixed(1)} m/s (all lanes blocked)`, () => {
      expect(physicsSurvivable([row(40, ['bannerArch', 'boomBarrier', 'scaffold'])], 1, () => v, 0)).toBe(true);
    });
    it(`jump clears a wide gap at ${v.toFixed(1)} m/s (all lanes)`, () => {
      expect(physicsSurvivable([row(40, ['wideGap', 'wideGap', 'wideGap'])], 1, () => v, 0)).toBe(true);
    });
    it(`a full wall row is impossible at ${v.toFixed(1)} m/s`, () => {
      expect(physicsSurvivable([row(40, ['bus', 'truck', 'constructionWall'])], 1, () => v, 0)).toBe(false);
    });
  }

  it('runner standing still in lane hits a low barrier without input (sanity)', () => {
    const p = new Player();
    const o = ob('barricade', 1, 5);
    let d = 0;
    let crashed = false;
    let flags = 0;
    for (let t = 0; t < 1 && !crashed; t += SIM_DT) {
      p.step(SIM_DT, 0, false);
      d += 13 * SIM_DT;
      const r = contactFor({ x: p.x, y: p.y, h: p.height, d }, o, flags);
      flags = r.flags;
      crashed = r.contact === 'crash';
    }
    expect(crashed).toBe(true);
    expect(d).toBeGreaterThan(5 - PLAYER_HALF_D - 0.5);
  });
});
