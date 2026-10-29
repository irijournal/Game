import { describe, expect, it } from 'vitest';
import { GEN_SPEED_MARGIN } from '../constants';
import {
  buildChunk,
  coinInsideObstacle,
  EMPTY_CELL,
  placeCoins,
  validateRows,
  type ChunkKind,
  type GenContext,
} from '../generator';
import { OBSTACLES } from '../obstacles';
import { Rng } from '../rng';
import { baseSpeedAt, difficultyAt } from '../speed';
import { THEME_ORDER, type ObstacleKind, type Row } from '../types';

const vCons = (s: number) => baseSpeedAt(s) * GEN_SPEED_MARGIN;

function ctxFor(rng: Rng, s: number, kind: ChunkKind = 'normal'): GenContext {
  return { kind, theme: rng.pick(THEME_ORDER), distance: s, diff: difficultyAt(s), vAt: vCons };
}

function randomChunk(rng: Rng, kind: ChunkKind) {
  const start = rng.range(0, 8000);
  const ctx = ctxFor(rng, start, kind);
  if (kind === 'chase') ctx.diff = rng.next();
  return { start, ctx, rows: buildChunk(rng, ctx, start) };
}

describe('procedural generator + route validator', () => {
  it('produces 10,000 chunks that all pass the validator from every lane', () => {
    const rng = new Rng(42);
    const kinds: ChunkKind[] = ['normal', 'chase', 'development', 'coinRush'];
    let rows = 0;
    for (let i = 0; i < 10000; i++) {
      const { start, ctx, rows: chunk } = randomChunk(rng, kinds[i % kinds.length]);
      expect(chunk.length).toBeGreaterThan(0);
      expect(validateRows(chunk, [0, 1, 2], ctx.vAt, start)).toBe(true);
      // No row ever blocks all three lanes with walls.
      for (const r of chunk) expect(r.cells.some((c) => c.cls !== 'wall')).toBe(true);
      rows += chunk.length;
    }
    expect(rows).toBeGreaterThan(30000);
  });

  it('rejects unconstrained random sequences that have no route', () => {
    const rng = new Rng(7);
    const kinds = Object.keys(OBSTACLES) as ObstacleKind[];
    let rejected = 0;
    let accepted = 0;
    for (let i = 0; i < 10000; i++) {
      const rows: Row[] = [];
      let s = 30;
      for (let k = 0; k < 4; k++) {
        const cells = [0, 1, 2].map(() => {
          if (rng.chance(0.35)) return EMPTY_CELL;
          const kind = rng.pick(kinds);
          return { cls: OBSTACLES[kind].cls, kind, depth: OBSTACLES[kind].depth };
        }) as Row['cells'];
        s += rng.range(3, 25);
        const end = s + Math.max(...cells.map((c) => c.depth), 0.3);
        rows.push({ id: k, s, end, cells, passed: false, chase: false });
        s = end;
      }
      if (validateRows(rows, [0, 1, 2], () => 16, 0)) accepted++;
      else rejected++;
    }
    expect(rejected).toBeGreaterThan(1000);
    expect(accepted).toBeGreaterThan(100);
  });

  it('never places coins inside a collision volume (10,000 chunks)', () => {
    const rng = new Rng(5);
    let coins = 0;
    for (let i = 0; i < 10000; i++) {
      const { start, ctx, rows } = randomChunk(rng, 'normal');
      for (const c of placeCoins(rng, rows, start, ctx.vAt, ['magnet'])) {
        expect(coinInsideObstacle(c, rows)).toBe(false);
        coins++;
      }
    }
    expect(coins).toBeGreaterThan(50000);
  });

  it('introduces obstacle types gradually', () => {
    const rng = new Rng(11);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const rows = buildChunk(rng, ctxFor(rng, 50), 50);
      for (const r of rows) for (const c of r.cells) if (c.kind) seen.add(c.kind);
    }
    for (const k of seen) expect(OBSTACLES[k as ObstacleKind].introAt).toBeLessThanOrEqual(50);
    expect(seen.has('bus')).toBe(false);
    expect(seen.has('roadGap')).toBe(false);
  });

  it('is deterministic for a seed', () => {
    const a = buildChunk(new Rng(3), ctxFor(new Rng(1), 900), 900);
    const b = buildChunk(new Rng(3), ctxFor(new Rng(1), 900), 900);
    expect(a.map((r) => [r.s, r.cells.map((c) => c.kind)])).toEqual(b.map((r) => [r.s, r.cells.map((c) => c.kind)]));
  });
});
