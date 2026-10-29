import { describe, expect, it } from 'vitest';
import { applyRun, defaultSave, purchase, SaveStore, SAVE_KEY, validateSave, type StorageLike } from '../../save/save';
import type { RunSummary } from '../simulation';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const DAY = '2026-10-29';

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    mode: 'A',
    character: 'akhilesh',
    seed: 1,
    score: 1234,
    breakdown: { distance: 0, coins: 0, dodges: 0, chase: 0, missions: 0, discovery: 0, tokens: 0, total: 1234 },
    distance: 800,
    coins: 40,
    chaseResult: 'survived',
    completed: false,
    reason: 'stumble',
    crashedInto: 'bus',
    missionsCompleted: [],
    discoveries: ['heritage'],
    stats: { distance: 800, coins: 40, chasesStarted: 1, chasesSurvived: 1, jumps: 3, slides: 2, jumpsOver: 2, slidesUnder: 1, dodges: 30, bumps: 0, collisions: 1, heritageTokens: 2, vikasRides: 0, cleanDistance: 500, laneChanges: 20 },
    ...over,
  };
}

describe('save validation', () => {
  it('returns defaults for garbage input', () => {
    for (const bad of [null, undefined, 42, 'x', [], { version: 99, coins: 'lots' }]) {
      const s = validateSave(bad, DAY);
      expect(s.version).toBe(2);
      expect(s.coins).toBe(0);
      expect(s.selectedCharacter).toBe('akhilesh');
    }
  });

  it('keeps valid fields when others are corrupted', () => {
    const d = defaultSave(DAY);
    const raw = JSON.parse(JSON.stringify(d));
    raw.coins = 500;
    raw.best = { overall: -3, A: 'nope', B: 900, C: Infinity };
    raw.unlocked = ['trail.sparkle', 'hacker.item', 5];
    raw.equipped.akhilesh = { outfit: 'yogi.mala', trail: 'trail.sparkle', runStyle: 'run.power' };
    raw.selectedCharacter = 'ummeedwar';
    const s = validateSave(raw, DAY);
    expect(s.coins).toBe(500);
    expect(s.best.B).toBe(900);
    expect(s.best.A).toBe(0);
    expect(s.best.C).toBe(0);
    expect(s.best.overall).toBe(900);
    expect(s.unlocked).toContain('trail.sparkle');
    expect(s.unlocked).not.toContain('hacker.item');
    expect(s.equipped.akhilesh.outfit).toBe('akhilesh.classic');
    expect(s.equipped.akhilesh.trail).toBe('trail.sparkle');
    expect(s.equipped.akhilesh.runStyle).toBe('run.classic');
    expect(s.selectedCharacter).toBe('akhilesh'); // not unlocked
  });

  it('migrates a v1 save', () => {
    const s = validateSave({ version: 1, best: 777, coins: 33 }, DAY);
    expect(s.best.A).toBe(777);
    expect(s.best.overall).toBe(777);
    expect(s.coins).toBe(33);
  });

  it('resets missions and showdown on a new day', () => {
    const d = defaultSave('2026-10-28');
    d.missions.completed = [d.missions.ids[0]];
    const s = validateSave(JSON.parse(JSON.stringify(d)), DAY);
    expect(s.missions.day).toBe(DAY);
    expect(s.missions.completed).toEqual([]);
  });
});

describe('SaveStore persistence', () => {
  it('persists and reloads (survives a "refresh")', () => {
    const mem = new MemStorage();
    const a = new SaveStore(mem);
    a.update((d) => {
      d.coins = 250;
      d.best.A = 999;
    });
    const b = new SaveStore(mem);
    expect(b.data.coins).toBe(250);
    expect(b.data.best.A).toBe(999);
  });

  it('handles malformed JSON without crashing', () => {
    const mem = new MemStorage();
    mem.setItem(SAVE_KEY, '{not json');
    const s = new SaveStore(mem);
    expect(s.data.coins).toBe(0);
    expect(s.lastError).toBeTruthy();
  });

  it('keeps working when writes fail (quota / private mode)', () => {
    const mem = new MemStorage();
    const s = new SaveStore(mem);
    mem.failWrites = true;
    expect(() => s.update((d) => (d.coins = 10))).not.toThrow();
    expect(s.data.coins).toBe(10);
    expect(s.lastError).toBeTruthy();
  });

  it('works with no storage at all', () => {
    const s = new SaveStore(null);
    expect(s.persistent).toBe(false);
    s.update((d) => (d.coins = 5));
    expect(s.data.coins).toBe(5);
  });
});

describe('applyRun and purchases', () => {
  it('updates bests, wallet, stats and discoveries', () => {
    const d = defaultSave(DAY);
    const info = applyRun(d, summary(), {});
    expect(info.newBest).toBe(true);
    expect(d.best.A).toBe(1234);
    expect(d.best.overall).toBe(1234);
    expect(d.coins).toBe(40);
    expect(d.stats.runs).toBe(1);
    expect(d.discovered).toContain('heritage');
    const again = applyRun(d, summary({ score: 100 }), {});
    expect(again.newBest).toBe(false);
    expect(d.best.A).toBe(1234);
  });

  it('awards mission rewards once', () => {
    const d = defaultSave(DAY);
    const id = d.missions.ids[0];
    applyRun(d, summary({ missionsCompleted: [id], coins: 0 }), {});
    const after = d.coins;
    expect(after).toBeGreaterThan(0);
    applyRun(d, summary({ missionsCompleted: [id], coins: 0 }), {});
    expect(d.coins).toBe(after);
  });

  it('unlocks the fictional candidate by distance', () => {
    const d = defaultSave(DAY);
    const info = applyRun(d, summary({ distance: 2100 }), {});
    expect(info.unlockedNow).toContain('char.ummeedwar');
  });

  it('purchases only when affordable', () => {
    const d = defaultSave(DAY);
    expect(purchase(d, 'trail.sparkle')).toBe(false);
    d.coins = 1000;
    expect(purchase(d, 'trail.sparkle')).toBe(true);
    expect(d.coins).toBe(800);
    expect(purchase(d, 'trail.sparkle')).toBe(true);
    expect(d.coins).toBe(800);
    expect(purchase(d, 'unknown.thing')).toBe(false);
  });
});
