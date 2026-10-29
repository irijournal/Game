import { ACHIEVEMENTS, achievementUnlocked } from '../content/achievements';
import { LEVELS, type LevelId } from '../content/levels';
import { CHARACTERS, CHARACTER_ORDER, ROUTES, RUN_STYLES, TRAILS } from '../sim/characters';
import { dayKey, missionById, missionsForDay, type ActiveMission } from '../sim/missions';
import type { Perks, RunSummary } from '../sim/simulation';
import { THEME_ORDER, type CharacterId, type ModeId, type ThemeId } from '../sim/types';

export const SAVE_KEY = 'uprun.save';
export const LEGACY_KEY = 'uprun.save.v1';
export const SAVE_VERSION = 3;
const MAX_NUM = 1e9;
const MODES: readonly ModeId[] = ['campaign', 'rivalry', 'race', 'free', 'mayhem'];

export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  shortCinematics: boolean;
  quality: Quality;
  debugColliders: boolean;
  /** On-screen ◀ ▲ ▼ ▶ buttons in addition to swipes. */
  touchButtons: boolean;
}

export interface Equipped {
  outfit: string;
  trail: string;
  runStyle: string;
}

export interface LevelProgress {
  completed: boolean;
  stars: number;
  best: number;
  tokens: number;
}

export interface SaveStats {
  runs: number;
  totalDistance: number;
  totalCoins: number;
  chasesSurvived: number;
  jumps: number;
  devTokens: number;
  rivalWins: number;
  quizAnswered: number;
  quizCorrect: number;
  mayhemWins: number;
  fakePromisesDodged: number;
  racesWon: number;
  roadsCleared: number;
  promisesDelivered: number;
  obstaclesAvoided: number;
  missionsCompleted: number;
  bestStage: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  coins: number;
  best: Record<ModeId, number> & { overall: number };
  bestDistance: number;
  levels: Record<LevelId, LevelProgress>;
  badges: string[];
  achievements: string[];
  stats: SaveStats;
  missions: { day: string; ids: string[]; progress: Record<string, number>; completed: string[] };
  unlocked: string[];
  equipped: Record<CharacterId, Equipped>;
  /** Hero used for campaign levels, races and free runs. */
  selectedCharacter: CharacterId;
  startRoute: ThemeId;
  discovered: ThemeId[];
  flags: { introSeen: boolean; tutorialDone: boolean; coinGiftClaimed: boolean };
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  sfx: true,
  reducedMotion: false,
  shortCinematics: false,
  quality: 'auto',
  debugColliders: false,
  touchButtons: typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : false,
};

const EMPTY_STATS: SaveStats = {
  runs: 0,
  totalDistance: 0,
  totalCoins: 0,
  chasesSurvived: 0,
  jumps: 0,
  devTokens: 0,
  rivalWins: 0,
  quizAnswered: 0,
  quizCorrect: 0,
  mayhemWins: 0,
  fakePromisesDodged: 0,
  racesWon: 0,
  roadsCleared: 0,
  promisesDelivered: 0,
  obstaclesAvoided: 0,
  missionsCompleted: 0,
  bestStage: 1,
};

export function allCosmeticIds(): Set<string> {
  const ids = new Set<string>();
  for (const id of CHARACTER_ORDER) {
    ids.add('char.' + id);
    for (const o of CHARACTERS[id].outfits) ids.add(o.id);
  }
  for (const c of [...TRAILS, ...RUN_STYLES]) ids.add(c.id);
  return ids;
}

function emptyLevels(): Record<LevelId, LevelProgress> {
  const out = {} as Record<LevelId, LevelProgress>;
  for (const l of LEVELS) out[l.id] = { completed: false, stars: 0, best: 0, tokens: 0 };
  return out;
}

export function defaultSave(day = dayKey()): SaveData {
  const equipped = {} as Record<CharacterId, Equipped>;
  for (const id of CHARACTER_ORDER) {
    equipped[id] = { outfit: CHARACTERS[id].outfits[0].id, trail: 'trail.none', runStyle: 'run.classic' };
  }
  const freebies = ['char.yogi', 'char.akhilesh', ...CHARACTER_ORDER.map((id) => CHARACTERS[id].outfits[0].id), 'trail.none', 'run.classic'];
  return {
    version: SAVE_VERSION,
    coins: 0,
    best: { overall: 0, campaign: 0, rivalry: 0, race: 0, free: 0, mayhem: 0 },
    bestDistance: 0,
    levels: emptyLevels(),
    badges: [],
    achievements: [],
    stats: { ...EMPTY_STATS },
    missions: { day, ids: missionsForDay(day).map((m) => m.id), progress: {}, completed: [] },
    unlocked: freebies,
    equipped,
    selectedCharacter: 'yogi',
    startRoute: 'expressway',
    discovered: ['expressway'],
    flags: { introSeen: false, tutorialDone: false, coinGiftClaimed: false },
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ------------------------------------------------------------ validation

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(MAX_NUM, Math.floor(v))) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function strArray(v: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x): x is string => typeof x === 'string' && (!allowed || allowed.has(x)));
  return [...new Set(out)];
}

const OLD_THEMES: Record<string, ThemeId> = { lucknow: 'lawandorder', heritage: 'ayodhya', modern: 'startup', festival: 'viksit' };
const OLD_IDS: Record<string, string> = {
  'char.ummeedwar': 'char.karyakarta',
  'trail.redgreen': 'trail.saffrongreen',
};

/** Bring older save formats up to the current schema shape. */
export function migrate(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  if (raw.version === 1 || raw.version === undefined) {
    // v1 stored a single best score and a coin wallet.
    const best = num(raw.best, 0);
    return { version: 3, coins: raw.coins, best: { overall: best, rivalry: best } };
  }
  if (raw.version === 2) {
    // v2 (Political Rivalry Mode): modes A/B/C, four themes, Ummeedwar-ji.
    const b = isObj(raw.best) ? raw.best : {};
    const out: Record<string, unknown> = { ...raw, version: 3 };
    out.best = { overall: num(b.overall, 0), rivalry: Math.max(num(b.A, 0), num(b.B, 0)), free: num(b.C, 0), campaign: 0, race: 0 };
    out.unlocked = strArray(raw.unlocked).map((id) => OLD_IDS[id] ?? id);
    out.discovered = strArray(raw.discovered).map((t) => OLD_THEMES[t] ?? t);
    out.startRoute = 'expressway';
    if (raw.selectedCharacter === 'ummeedwar') out.selectedCharacter = 'karyakarta';
    else if (raw.selectedCharacter === 'akhilesh') out.selectedCharacter = 'yogi';
    if (isObj(raw.equipped)) {
      const eq = { ...raw.equipped } as Record<string, unknown>;
      if (eq.ummeedwar) eq.karyakarta = { ...(eq.ummeedwar as object), outfit: 'karyakarta.classic' };
      for (const k of Object.keys(eq)) {
        const e = eq[k];
        if (isObj(e) && typeof e.trail === 'string') e.trail = OLD_IDS[e.trail] ?? e.trail;
      }
      out.equipped = eq;
    }
    return out;
  }
  return raw;
}

/**
 * Turn anything (missing, corrupted, hand-edited, from an older version)
 * into a valid SaveData. Invalid fields fall back to defaults individually,
 * so one bad value never wipes the rest of the player's progress.
 */
export function validateSave(input: unknown, day = dayKey()): SaveData {
  const def = defaultSave(day);
  const raw = migrate(input);
  if (!isObj(raw)) return def;
  const out = defaultSave(day);
  out.coins = num(raw.coins, def.coins);
  if (isObj(raw.best)) {
    for (const m of MODES) out.best[m] = num(raw.best[m], 0);
    out.best.overall = Math.max(num(raw.best.overall, 0), ...MODES.map((m) => out.best[m]));
  }
  out.bestDistance = num(raw.bestDistance, 0);
  if (isObj(raw.levels)) {
    for (const l of LEVELS) {
      const p = raw.levels[l.id];
      if (!isObj(p)) continue;
      out.levels[l.id] = { completed: bool(p.completed, false), stars: Math.min(3, num(p.stars, 0)), best: num(p.best, 0), tokens: num(p.tokens, 0) };
    }
  }
  const badgeIds = new Set(LEVELS.map((l) => l.badge.id));
  out.badges = strArray(raw.badges, badgeIds);
  out.achievements = strArray(raw.achievements, new Set(ACHIEVEMENTS.map((a) => a.id)));
  if (isObj(raw.stats)) {
    const s = raw.stats;
    for (const k of Object.keys(EMPTY_STATS) as (keyof SaveStats)[]) out.stats[k] = num(s[k], EMPTY_STATS[k]);
    out.stats.bestStage = Math.max(1, out.stats.bestStage);
  }
  if (isObj(raw.missions) && raw.missions.day === day) {
    const ids = strArray(raw.missions.ids).filter((id) => missionById(id));
    if (ids.length) out.missions.ids = ids;
    if (isObj(raw.missions.progress)) {
      for (const id of out.missions.ids) out.missions.progress[id] = num(raw.missions.progress[id], 0);
    }
    out.missions.completed = strArray(raw.missions.completed).filter((id) => out.missions.ids.includes(id));
  }
  const cosmetics = allCosmeticIds();
  out.unlocked = [...new Set([...def.unlocked, ...strArray(raw.unlocked, cosmetics)])];
  if (isObj(raw.equipped)) {
    for (const id of CHARACTER_ORDER) {
      const e = raw.equipped[id];
      if (!isObj(e)) continue;
      const outfit = typeof e.outfit === 'string' && out.unlocked.includes(e.outfit) && e.outfit.startsWith(id + '.') ? e.outfit : out.equipped[id].outfit;
      const trail = typeof e.trail === 'string' && out.unlocked.includes(e.trail) && e.trail.startsWith('trail.') ? e.trail : 'trail.none';
      const runStyle = typeof e.runStyle === 'string' && out.unlocked.includes(e.runStyle) && e.runStyle.startsWith('run.') ? e.runStyle : 'run.classic';
      out.equipped[id] = { outfit, trail, runStyle };
    }
  }
  const sel = str<CharacterId>(raw.selectedCharacter, CHARACTER_ORDER, 'yogi');
  out.selectedCharacter = out.unlocked.includes('char.' + sel) ? sel : 'yogi';
  const route = str<ThemeId>(raw.startRoute, THEME_ORDER, 'expressway');
  out.startRoute = routeUnlocked(out, route) ? route : 'expressway';
  out.discovered = [...new Set(['expressway', ...strArray(raw.discovered, new Set(THEME_ORDER))])] as ThemeId[];
  if (isObj(raw.flags)) {
    out.flags = {
      introSeen: bool(raw.flags.introSeen, false),
      tutorialDone: bool(raw.flags.tutorialDone, false),
      coinGiftClaimed: bool(raw.flags.coinGiftClaimed, false),
    };
  }
  if (isObj(raw.settings)) {
    const s = raw.settings;
    out.settings = {
      music: bool(s.music, true),
      sfx: bool(s.sfx, true),
      reducedMotion: bool(s.reducedMotion, false),
      shortCinematics: bool(s.shortCinematics, false),
      quality: str(s.quality, ['auto', 'high', 'low'] as const, 'auto'),
      debugColliders: bool(s.debugColliders, false),
      touchButtons: bool(s.touchButtons, DEFAULT_SETTINGS.touchButtons),
    };
  }
  return out;
}

// --------------------------------------------------------------- queries

export function levelUnlocked(d: SaveData, id: LevelId): boolean {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i <= 0 || d.levels[LEVELS[i - 1].id].completed;
}

/** Free Run start routes unlock with their campaign level. */
export function routeUnlocked(d: SaveData, theme: ThemeId): boolean {
  return theme === 'expressway' || d.levels[theme]?.completed === true;
}

export function perksFor(d: SaveData): Perks {
  const has = (perk: string) => LEVELS.some((l) => l.badge.perk === perk && d.badges.includes(l.badge.id));
  return { powerupBoost: has('powerupBoost'), guardBoost: has('guardBoost'), tokenBoost: has('tokenBoost') };
}

export function totalStars(d: SaveData): number {
  return LEVELS.reduce((n, l) => n + d.levels[l.id].stars, 0);
}

// ------------------------------------------------------------ persistence

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__uprun_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/**
 * Local save system. Never throws: if storage is unavailable (private mode,
 * blocked cookies, quota full) the game keeps working with in-memory progress
 * and `persistent` reports false so the UI can say so.
 */
export class SaveStore {
  data: SaveData;
  persistent: boolean;
  lastError: string | null = null;
  private storage: StorageLike | null;
  private listeners = new Set<() => void>();

  constructor(storage: StorageLike | null | undefined = undefined) {
    this.storage = storage === undefined ? browserStorage() : storage;
    this.persistent = !!this.storage;
    this.data = this.load();
  }

  load(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      const text = this.storage.getItem(SAVE_KEY) ?? this.storage.getItem(LEGACY_KEY);
      if (!text) return defaultSave();
      return validateSave(JSON.parse(text));
    } catch {
      this.lastError = 'Saved progress was unreadable and has been reset.';
      return defaultSave();
    }
  }

  save(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.lastError = null;
      return true;
    } catch {
      this.lastError = 'Could not save progress (storage full or blocked).';
      return false;
    }
  }

  update(fn: (d: SaveData) => void): void {
    const next = structuredClone(this.data);
    fn(next);
    this.data = validateSave(next);
    this.save();
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.data.flags.introSeen = true;
    this.save();
    this.listeners.forEach((l) => l());
  }

  /** Roll missions over to today if the day changed. */
  refreshDay(day = dayKey()): void {
    if (this.data.missions.day === day) return;
    this.update((d) => {
      d.missions = { day, ids: missionsForDay(day).map((m) => m.id), progress: {}, completed: [] };
    });
  }
}

export function activeMissions(d: SaveData): ActiveMission[] {
  return d.missions.ids
    .map((id) => missionById(id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((def) => ({ def, base: d.missions.progress[def.id] ?? 0, completed: d.missions.completed.includes(def.id) }));
}

export interface RunResultInfo {
  newBest: boolean;
  previousBest: number;
  coinsEarned: number;
  missionRewards: number;
  unlockedNow: string[];
  /** Campaign only. */
  badgeEarned: string | null;
  nextLevelUnlocked: LevelId | null;
  previousStars: number;
  achievementsNow: string[];
  giftCoins: number;
}

function updateAchievements(d: SaveData): string[] {
  const now: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!d.achievements.includes(a.id) && achievementUnlocked(a, d)) {
      d.achievements.push(a.id);
      now.push(a.id);
    }
  }
  return now;
}

/**
 * Fold a finished run into the save (mutates `d`; the caller persists).
 * `missionProgress` holds the run's final progress for each active mission
 * (already combined with the stored base).
 */
export function applyRun(d: SaveData, run: RunSummary, missionProgress: Record<string, number>): RunResultInfo {
  const previousBest = d.best[run.mode];
  const newBest = run.score > previousBest;
  d.best[run.mode] = Math.max(d.best[run.mode], run.score);
  d.best.overall = Math.max(d.best.overall, run.score);
  d.bestDistance = Math.max(d.bestDistance, run.distance);

  const s = d.stats;
  const r = run.stats;
  s.runs += 1;
  s.totalDistance += run.distance;
  s.totalCoins += run.coins;
  s.chasesSurvived += r.chasesSurvived;
  s.jumps += r.jumpsOver;
  s.devTokens += r.devTokens;
  s.rivalWins += r.rivalWins;
  s.quizAnswered += r.quizAnswered;
  s.quizCorrect += r.quizCorrect;
  s.roadsCleared += r.roadsCleared;
  s.promisesDelivered += r.promisesDelivered;
  s.obstaclesAvoided += r.dodges;
  if (run.mode === 'rivalry') s.bestStage = Math.max(s.bestStage, r.stage);
  if (run.race?.won) s.racesWon += 1;
  s.fakePromisesDodged += r.fakePromisesDodged;
  if (run.mode === 'mayhem' && run.completed) s.mayhemWins += 1;

  let missionRewards = 0;
  for (const id of d.missions.ids) {
    if (missionProgress[id] !== undefined) d.missions.progress[id] = Math.max(d.missions.progress[id] ?? 0, missionProgress[id]);
  }
  for (const id of run.missionsCompleted) {
    if (d.missions.completed.includes(id)) continue;
    d.missions.completed.push(id);
    s.missionsCompleted += 1;
    missionRewards += missionById(id)?.reward ?? 0;
  }

  let badgeEarned: string | null = null;
  let nextLevelUnlocked: LevelId | null = null;
  let previousStars = 0;
  let giftCoins = 0;
  if (run.level) {
    const id = run.level.id as LevelId;
    const lp = d.levels[id];
    const def = LEVELS.find((l) => l.id === id);
    if (lp && def) {
      previousStars = lp.stars;
      lp.best = Math.max(lp.best, run.score);
      lp.tokens = Math.max(lp.tokens, run.level.tokens);
      lp.stars = Math.max(lp.stars, run.level.stars);
      if (run.level.completed) {
        const first = !lp.completed;
        lp.completed = true;
        if (!d.badges.includes(def.badge.id)) {
          d.badges.push(def.badge.id);
          badgeEarned = def.badge.id;
          if (def.badge.perk === 'coinGift' && !d.flags.coinGiftClaimed) {
            d.flags.coinGiftClaimed = true;
            giftCoins = 300;
          }
        }
        const next = LEVELS[def.num];
        if (first && next) nextLevelUnlocked = next.id;
      }
    }
  }

  d.coins += run.coins + missionRewards + giftCoins;
  for (const t of run.discoveries) if (!d.discovered.includes(t)) d.discovered.push(t);

  const unlockedNow: string[] = [];
  for (const id of CHARACTER_ORDER) {
    const u = CHARACTERS[id].unlock;
    const key = 'char.' + id;
    if (u.kind === 'distance' && !d.unlocked.includes(key) && run.distance >= u.metres) {
      d.unlocked.push(key);
      unlockedNow.push(key);
    }
  }
  d.flags.tutorialDone = true;
  const achievementsNow = updateAchievements(d);
  return { newBest, previousBest, coinsEarned: run.coins, missionRewards, unlockedNow, badgeEarned, nextLevelUnlocked, previousStars, achievementsNow, giftCoins };
}

export function priceOf(id: string): number {
  for (const c of CHARACTER_ORDER) {
    if (id === 'char.' + c) {
      const u = CHARACTERS[c].unlock;
      return u.kind === 'distance' ? u.price : 0;
    }
    const o = CHARACTERS[c].outfits.find((x) => x.id === id);
    if (o) return o.price;
  }
  return [...TRAILS, ...RUN_STYLES].find((x) => x.id === id)?.price ?? Infinity;
}

/** Spend coins on a cosmetic. Returns false if unaffordable or unknown. */
export function purchase(d: SaveData, id: string): boolean {
  if (d.unlocked.includes(id)) return true;
  const price = priceOf(id);
  if (!Number.isFinite(price) || d.coins < price) return false;
  d.coins -= price;
  d.unlocked.push(id);
  return true;
}

export { ROUTES };
