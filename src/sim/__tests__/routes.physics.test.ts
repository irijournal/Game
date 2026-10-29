import { describe, expect, it } from 'vitest';
import { GEN_SPEED_MARGIN } from '../constants';
import { buildChunk, type ChunkKind } from '../generator';
import { Rng } from '../rng';
import { baseSpeedAt, difficultyAt } from '../speed';
import { THEME_ORDER } from '../types';
import { physicsSurvivable } from './helpers';

const vCons = (s: number) => baseSpeedAt(s) * GEN_SPEED_MARGIN;

function randomChunk(rng: Rng, kind: ChunkKind) {
  const start = rng.range(0, 8000);
  const ctx = { kind, theme: rng.pick(THEME_ORDER), distance: start, diff: kind === 'chase' ? rng.next() : difficultyAt(start), vAt: vCons };
  return { start, ctx, rows: buildChunk(rng, ctx, start) };
}

// Cross-checks the route validator against the real player physics and
// collision code with an input search. Slow (~2-3 min), so it lives in its
// own file and runs in parallel with the rest of the suite.
describe('route validator vs. real physics', () => {
  it('every validator-accepted chunk is survivable with real physics from every lane (90 sampled)', () => {
    const rng = new Rng(99);
    const kinds: ChunkKind[] = ['normal', 'chase', 'development'];
    let checked = 0;
    for (let i = 0; i < 90; i++) {
      const { start, rows } = randomChunk(rng, kinds[i % kinds.length]);
      for (const lane of [0, 1, 2] as const) {
        // Both the slowest plausible speed and the conservative maximum.
        expect(physicsSurvivable(rows, lane, (s) => baseSpeedAt(s), start)).toBe(true);
        expect(physicsSurvivable(rows, lane, vCons, start)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(270);
  }, 600000);

});
