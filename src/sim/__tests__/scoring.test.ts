import { describe, expect, it } from 'vitest';
import { POINTS, ScoreKeeper } from '../scoring';
import { dayKey, missionsForDay, missionValue, MISSION_POOL } from '../missions';

describe('ScoreKeeper', () => {
  it('sums every source exactly once', () => {
    const s = new ScoreKeeper();
    s.addDistance(100.7);
    s.addCoin();
    s.addCoin(2);
    s.addDodge(false);
    s.addDodge(true);
    s.addChaseComplete(4);
    s.addBonus('mission');
    s.addBonus('discovery');
    s.addBonus('devToken');
    s.addBonus('chaseToken');
    const b = s.breakdown();
    expect(b.distance).toBe(100);
    expect(b.coins).toBe(POINTS.perCoin * 3);
    expect(b.dodges).toBe(POINTS.perDodge + POINTS.perOverDodge);
    expect(b.chase).toBe(POINTS.chaseBase + 4 * POINTS.chasePerEscape + POINTS.chaseToken);
    expect(b.missions).toBe(POINTS.mission);
    expect(b.discovery).toBe(POINTS.discovery);
    expect(b.tokens).toBe(POINTS.devToken);
    expect(b.total).toBe(b.distance + b.coins + b.dodges + b.chase + b.missions + b.discovery + b.tokens + b.rival + b.level);
    expect(s.total).toBe(b.total);
  });

  it('routes rival, level and token bonuses to their buckets', () => {
    const s = new ScoreKeeper();
    s.tokenMultiplier = 1.2;
    expect(s.addBonus('devToken')).toBe(30);
    s.addBonus('quiz');
    s.addBonus('rivalWin');
    s.addLevelComplete(3);
    const b = s.breakdown();
    expect(b.tokens).toBe(30);
    expect(b.rival).toBe(POINTS.quiz + POINTS.rivalWin);
    expect(b.level).toBe(POINTS.levelComplete + 3 * POINTS.perStar);
    expect(b.total).toBe(30 + b.rival + b.level);
  });

  it('ignores negative or invalid distance', () => {
    const s = new ScoreKeeper();
    s.addDistance(-5);
    s.addDistance(Number.NaN);
    expect(s.total).toBe(0);
  });

  it('applies the speed-run multiplier to distance only', () => {
    const s = new ScoreKeeper();
    s.addDistance(10, 2);
    expect(s.total).toBe(20);
  });
});

describe('missions', () => {
  it('picks three distinct missions per day, deterministically', () => {
    const a = missionsForDay('2026-10-29');
    const b = missionsForDay('2026-10-29');
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
  });

  it('formats local day keys', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('combines progress by scope', () => {
    const day = MISSION_POOL.find((m) => m.scope === 'day')!;
    const run = MISSION_POOL.find((m) => m.scope === 'run')!;
    expect(missionValue({ def: day, base: 40, completed: false }, 15)).toBe(55);
    expect(missionValue({ def: run, base: 40, completed: false }, 15)).toBe(40);
    expect(missionValue({ def: run, base: 40, completed: false }, 90)).toBe(90);
  });
});
