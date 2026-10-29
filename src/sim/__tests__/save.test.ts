import { describe, expect, it } from 'vitest';
import { applyRun, defaultSave, levelUnlocked, perksFor, purchase, routeUnlocked, SaveStore, SAVE_KEY, validateSave, type StorageLike } from '../../save/save';
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
    mode: 'free',
    character: 'yogi',
    seed: 1,
    score: 1234,
    breakdown: { distance: 0, coins: 0, dodges: 0, chase: 0, missions: 0, discovery: 0, tokens: 0, rival: 0, level: 0, total: 1234 },
    distance: 800,
    coins: 40,
    chaseResult: 'survived',
    completed: false,
    reason: 'stumble',
    crashedInto: 'bus',
    missionsCompleted: [],
    discoveries: ['ayodhya'],
    stats: {
      distance: 800, coins: 40, chasesStarted: 1, chasesSurvived: 1, jumps: 3, slides: 2, jumpsOver: 2, slidesUnder: 1, dodges: 30, bumps: 0, collisions: 1,
      devTokens: 2, reportCards: 0, rivalChallenges: 0, rivalWins: 0, quizAnswered: 0, quizCorrect: 0, promisesDelivered: 0, roadsCleared: 0,
      vikasRides: 0, fakePromisesDodged: 0, cleanDistance: 500, laneChanges: 20, stage: 1,
    },
    level: null,
    race: null,
    ...over,
  };
}

describe('save validation', () => {
  it('returns defaults for garbage input', () => {
    for (const bad of [null, undefined, 42, 'x', [], { version: 99, coins: 'lots' }]) {
      const s = validateSave(bad, DAY);
      expect(s.version).toBe(3);
      expect(s.coins).toBe(0);
      expect(s.selectedCharacter).toBe('yogi');
    }
  });

  it('keeps valid fields when others are corrupted', () => {
    const d = defaultSave(DAY);
    const raw = JSON.parse(JSON.stringify(d));
    raw.coins = 500;
    raw.best = { overall: -3, campaign: 'nope', rivalry: 900, free: Infinity };
    raw.unlocked = ['trail.sparkle', 'hacker.item', 5];
    raw.equipped.akhilesh = { outfit: 'yogi.mala', trail: 'trail.sparkle', runStyle: 'run.power' };
    raw.selectedCharacter = 'karyakarta';
    raw.levels.expressway = { completed: true, stars: 9, best: 'x', tokens: 12 };
    raw.levels.bogus = { completed: true };
    raw.badges = ['badge.expressway', 'badge.fake'];
    raw.startRoute = 'viksit';
    const s = validateSave(raw, DAY);
    expect(s.coins).toBe(500);
    expect(s.best.rivalry).toBe(900);
    expect(s.best.campaign).toBe(0);
    expect(s.best.free).toBe(0);
    expect(s.best.overall).toBe(900);
    expect(s.levels.expressway).toEqual({ completed: true, stars: 3, best: 0, tokens: 12 });
    expect('bogus' in s.levels).toBe(false);
    expect(s.badges).toEqual(['badge.expressway']);
    expect(s.startRoute).toBe('expressway'); // Viksit UP not completed
    expect(s.unlocked).toContain('trail.sparkle');
    expect(s.unlocked).not.toContain('hacker.item');
    expect(s.equipped.akhilesh.outfit).toBe('akhilesh.classic');
    expect(s.equipped.akhilesh.trail).toBe('trail.sparkle');
    expect(s.equipped.akhilesh.runStyle).toBe('run.classic');
    expect(s.selectedCharacter).toBe('yogi'); // not unlocked
  });

  it('migrates a v1 save', () => {
    const s = validateSave({ version: 1, best: 777, coins: 33 }, DAY);
    expect(s.best.rivalry).toBe(777);
    expect(s.best.overall).toBe(777);
    expect(s.coins).toBe(33);
  });

  it('migrates a v2 (Political Rivalry Mode) save', () => {
    const v2 = {
      version: 2,
      coins: 640,
      best: { overall: 3000, A: 1200, B: 3000, C: 2100 },
      unlocked: ['char.akhilesh', 'char.yogi', 'char.ummeedwar', 'trail.redgreen', 'route.heritage'],
      equipped: { akhilesh: { outfit: 'akhilesh.classic', trail: 'trail.redgreen', runStyle: 'run.classic' }, ummeedwar: { outfit: 'ummeedwar.classic', trail: 'trail.none', runStyle: 'run.classic' } },
      selectedCharacter: 'ummeedwar',
      startRoute: 'heritage',
      discovered: ['lucknow', 'heritage', 'festival'],
      stats: { runs: 12, totalDistance: 9000, totalCoins: 600, chasesSurvived: 4, jumps: 50, heritageTokens: 9 },
      settings: { music: false, sfx: true, reducedMotion: true, shortCinematics: false, quality: 'low', debugColliders: false },
    };
    const s = validateSave(v2, DAY);
    expect(s.version).toBe(3);
    expect(s.coins).toBe(640);
    expect(s.best.rivalry).toBe(3000);
    expect(s.best.free).toBe(2100);
    expect(s.best.overall).toBe(3000);
    expect(s.unlocked).toContain('char.karyakarta');
    expect(s.unlocked).toContain('trail.saffrongreen');
    expect(s.selectedCharacter).toBe('karyakarta');
    expect(s.equipped.akhilesh.trail).toBe('trail.saffrongreen');
    expect(s.discovered).toEqual(expect.arrayContaining(['expressway', 'lawandorder', 'ayodhya', 'viksit']));
    expect(s.startRoute).toBe('expressway');
    expect(s.stats.runs).toBe(12);
    expect(s.settings.music).toBe(false);
    expect(s.settings.quality).toBe('low');
  });

  it('resets missions on a new day', () => {
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
      d.best.free = 999;
      d.levels.expressway.completed = true;
    });
    const b = new SaveStore(mem);
    expect(b.data.coins).toBe(250);
    expect(b.data.best.free).toBe(999);
    expect(b.data.levels.expressway.completed).toBe(true);
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
    expect(d.best.free).toBe(1234);
    expect(d.best.overall).toBe(1234);
    expect(d.bestDistance).toBe(800);
    expect(d.coins).toBe(40);
    expect(d.stats.runs).toBe(1);
    expect(d.stats.devTokens).toBe(2);
    expect(d.stats.obstaclesAvoided).toBe(30);
    expect(d.discovered).toContain('ayodhya');
    const again = applyRun(d, summary({ score: 100 }), {});
    expect(again.newBest).toBe(false);
    expect(d.best.free).toBe(1234);
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
    expect(info.unlockedNow).toContain('char.karyakarta');
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

describe('campaign progress', () => {
  const lvl = (id: string, completed: boolean, stars: number, tokens = 20) => ({ id, completed, tokens, goal: 25, stars });

  it('unlocks levels in order and awards each badge once', () => {
    const d = defaultSave(DAY);
    expect(levelUnlocked(d, 'expressway')).toBe(true);
    expect(levelUnlocked(d, 'ayodhya')).toBe(false);
    const fail = applyRun(d, summary({ mode: 'campaign', level: lvl('expressway', false, 0) }), {});
    expect(fail.badgeEarned).toBeNull();
    expect(levelUnlocked(d, 'ayodhya')).toBe(false);
    const win = applyRun(d, summary({ mode: 'campaign', level: lvl('expressway', true, 2) }), {});
    expect(win.badgeEarned).toBe('badge.expressway');
    expect(win.nextLevelUnlocked).toBe('ayodhya');
    expect(levelUnlocked(d, 'ayodhya')).toBe(true);
    expect(routeUnlocked(d, 'expressway')).toBe(true);
    expect(d.levels.expressway.stars).toBe(2);
    const replay = applyRun(d, summary({ mode: 'campaign', level: lvl('expressway', true, 1) }), {});
    expect(replay.badgeEarned).toBeNull();
    expect(replay.nextLevelUnlocked).toBeNull();
    expect(replay.previousStars).toBe(2);
    expect(d.levels.expressway.stars).toBe(2); // best stars kept
    expect(d.badges.filter((b) => b === 'badge.expressway')).toHaveLength(1);
  });

  it('gives the Public Service coin gift once and turns badges into perks', () => {
    const d = defaultSave(DAY);
    const a = applyRun(d, summary({ mode: 'campaign', coins: 0, level: lvl('jankalyan', true, 3) }), {});
    expect(a.giftCoins).toBe(300);
    expect(d.coins).toBe(300);
    d.badges = d.badges.filter((b) => b !== 'badge.publicService');
    const b = applyRun(d, summary({ mode: 'campaign', coins: 0, level: lvl('jankalyan', true, 3) }), {});
    expect(b.giftCoins).toBe(0);
    expect(perksFor(d)).toEqual({ powerupBoost: false, guardBoost: false, tokenBoost: false });
    applyRun(d, summary({ mode: 'campaign', level: lvl('lawandorder', true, 1) }), {});
    applyRun(d, summary({ mode: 'campaign', level: lvl('airport', true, 1) }), {});
    expect(perksFor(d)).toEqual({ powerupBoost: true, guardBoost: true, tokenBoost: false });
  });

  it('records races, rivalry stages, Manifesto Mayhem and achievements', () => {
    const d = defaultSave(DAY);
    const r = applyRun(d, summary({ mode: 'race', race: { won: true, margin: 40 } }), {});
    expect(d.stats.racesWon).toBe(1);
    expect(r.achievementsNow).toContain('ach.race');
    const stats = { ...summary().stats, stage: 3, rivalWins: 5 };
    applyRun(d, summary({ mode: 'rivalry', character: 'akhilesh', stats }), {});
    expect(d.stats.bestStage).toBe(3);
    expect(d.achievements).toEqual(expect.arrayContaining(['ach.showdown', 'ach.governance']));
    // Manifesto Mayhem: a finished run counts as a win; dodges accumulate.
    const may = { ...summary().stats, fakePromisesDodged: 61 };
    const m1 = applyRun(d, summary({ mode: 'mayhem', completed: true, reason: 'completed', stats: may }), {});
    expect(d.stats.mayhemWins).toBe(1);
    expect(d.stats.fakePromisesDodged).toBe(61);
    expect(m1.achievementsNow).toEqual(expect.arrayContaining(['ach.mayhem', 'ach.dodger']));
    applyRun(d, summary({ mode: 'mayhem', completed: false, reason: 'stumble', stats: may }), {});
    expect(d.stats.mayhemWins).toBe(1);
    // Achievements are never listed twice.
    expect(applyRun(d, summary({ mode: 'mayhem', completed: true, reason: 'completed', stats: may }), {}).achievementsNow).toEqual([]);
  });
});
