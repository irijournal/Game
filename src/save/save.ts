import { CHARACTERS, CHARACTER_ORDER, ROUTES, RUN_STYLES, TRAILS } from '../sim/characters';
import { dayKey, missionById, missionsForDay, type ActiveMission } from '../sim/missions';
import type { RunSummary } from '../sim/simulation';
import { THEME_ORDER, type CharacterId, type ModeId, type ThemeId } from '../sim/types';

export const SAVE_KEY = 'uprun.save';
export const LEGACY_KEY = 'uprun.save.v1';
export const SAVE_VERSION = 2;
const MAX_NUM = 1e9;

export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  shortCinematics: boolean;
  quality: Quality;
  debugColliders: boolean;
}

export interface Equipped {
  outfit: string;
  trail: string;
  runStyle: string;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  coins: number;
  best: Record<ModeId, number> & { overall: number };
  bestDistance: number;
  showdown: { day: string; best: Record<CharacterId, number> };
  stats: {
    runs: number;
    totalDistance: number;
    totalCoins: number;
    chasesSurvived: number;
    jumps: number;
    heritageTokens: number;
  };
  missions: { day: string; ids: string[]; progress: Record<string, number>; completed: string[] };
  unlocked: string[];
  equipped: Record<CharacterId, Equipped>;
  selectedCharacter: CharacterId;
  startRoute: ThemeId;
  discovered: ThemeId[];
  flags: { introSeen: boolean; tutorialDone: boolean };
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  sfx: true,
  reducedMotion: false,
  shortCinematics: false,
  quality: 'auto',
  debugColliders: false,
};

export function allCosmeticIds(): Set<string> {
  const ids = new Set<string>();
  for (const id of CHARACTER_ORDER) {
    ids.add('char.' + id);
    for (const o of CHARACTERS[id].outfits) ids.add(o.id);
  }
  for (const c of [...TRAILS, ...RUN_STYLES, ...ROUTES]) ids.add(c.id);
  return ids;
}

export function defaultSave(day = dayKey()): SaveData {
  const equipped = {} as Record<CharacterId, Equipped>;
  for (const id of CHARACTER_ORDER) {
    equipped[id] = { outfit: CHARACTERS[id].outfits[0].id, trail: 'trail.none', runStyle: 'run.classic' };
  }
  const freebies = [
    'char.akhilesh',
    'char.yogi',
    ...CHARACTER_ORDER.map((id) => CHARACTERS[id].outfits[0].id),
    'trail.none',
    'run.classic',
    'route.lucknow',
  ];
  return {
    version: SAVE_VERSION,
    coins: 0,
    best: { overall: 0, A: 0, B: 0, C: 0 },
    bestDistance: 0,
    showdown: { day, best: { akhilesh: 0, yogi: 0, ummeedwar: 0 } },
    stats: { runs: 0, totalDistance: 0, totalCoins: 0, chasesSurvived: 0, jumps: 0, heritageTokens: 0 },
    missions: { day, ids: missionsForDay(day).map((m) => m.id), progress: {}, completed: [] },
    unlocked: freebies,
    equipped,
    selectedCharacter: 'akhilesh',
    startRoute: 'lucknow',
    discovered: ['lucknow'],
    flags: { introSeen: false, tutorialDone: false },
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

/** Bring older save formats up to the current schema shape. */
export function migrate(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  if (raw.version === 1 || raw.version === undefined) {
    // v1 stored a single best score and a coin wallet.
    const best = num(raw.best, 0);
    return { version: 2, coins: raw.coins, best: { overall: best, A: best, B: 0, C: 0 } };
  }
  return raw;
}

/**
 * Turn anything (missing, corrupted, hand-edited, from a newer version) into
 * a valid SaveData. Invalid fields fall back to defaults individually, so one
 * bad value never wipes the rest of the player's progress.
 */
export function validateSave(input: unknown, day = dayKey()): SaveData {
  const def = defaultSave(day);
  const raw = migrate(input);
  if (!isObj(raw)) return def;
  const out = defaultSave(day);
  out.coins = num(raw.coins, def.coins);
  if (isObj(raw.best)) {
    out.best = {
      overall: num(raw.best.overall, 0),
      A: num(raw.best.A, 0),
      B: num(raw.best.B, 0),
      C: num(raw.best.C, 0),
    };
    out.best.overall = Math.max(out.best.overall, out.best.A, out.best.B, out.best.C);
  }
  out.bestDistance = num(raw.bestDistance, 0);
  if (isObj(raw.showdown) && raw.showdown.day === day && isObj(raw.showdown.best)) {
    for (const id of CHARACTER_ORDER) out.showdown.best[id] = num(raw.showdown.best[id], 0);
  }
  if (isObj(raw.stats)) {
    const s = raw.stats;
    out.stats = {
      runs: num(s.runs, 0),
      totalDistance: num(s.totalDistance, 0),
      totalCoins: num(s.totalCoins, 0),
      chasesSurvived: num(s.chasesSurvived, 0),
      jumps: num(s.jumps, 0),
      heritageTokens: num(s.heritageTokens, 0),
    };
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
  const sel = str<CharacterId>(raw.selectedCharacter, CHARACTER_ORDER, 'akhilesh');
  out.selectedCharacter = out.unlocked.includes('char.' + sel) ? sel : 'akhilesh';
  const route = str<ThemeId>(raw.startRoute, THEME_ORDER, 'lucknow');
  out.startRoute = out.unlocked.includes('route.' + route) ? route : 'lucknow';
  out.discovered = [...new Set(['lucknow', ...strArray(raw.discovered, new Set(THEME_ORDER))])] as ThemeId[];
  if (isObj(raw.flags)) {
    out.flags = { introSeen: bool(raw.flags.introSeen, false), tutorialDone: bool(raw.flags.tutorialDone, false) };
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
    };
  }
  return out;
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
    } catch (e) {
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

  /** Roll missions/showdown over to today if the day changed. */
  refreshDay(day = dayKey()): void {
    if (this.data.missions.day === day && this.data.showdown.day === day) return;
    this.update((d) => {
      if (d.missions.day !== day) d.missions = { day, ids: missionsForDay(day).map((m) => m.id), progress: {}, completed: [] };
      if (d.showdown.day !== day) d.showdown = { day, best: { akhilesh: 0, yogi: 0, ummeedwar: 0 } };
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
}

/**
 * Fold a finished run into the save. Pure with respect to `d` (mutates it);
 * the caller persists. `missionProgress` holds the run's final progress for
 * each active mission (already combined with the stored base).
 */
export function applyRun(
  d: SaveData,
  run: RunSummary,
  missionProgress: Record<string, number>,
): RunResultInfo {
  const previousBest = d.best[run.mode];
  const newBest = run.score > previousBest;
  d.best[run.mode] = Math.max(d.best[run.mode], run.score);
  d.best.overall = Math.max(d.best.overall, run.score);
  d.bestDistance = Math.max(d.bestDistance, run.distance);
  if (run.mode === 'C') d.showdown.best[run.character] = Math.max(d.showdown.best[run.character], run.score);

  d.stats.runs += 1;
  d.stats.totalDistance += run.distance;
  d.stats.totalCoins += run.coins;
  d.stats.chasesSurvived += run.stats.chasesSurvived;
  d.stats.jumps += run.stats.jumpsOver;
  d.stats.heritageTokens += run.stats.heritageTokens;

  let missionRewards = 0;
  for (const id of d.missions.ids) {
    if (missionProgress[id] !== undefined) d.missions.progress[id] = Math.max(d.missions.progress[id] ?? 0, missionProgress[id]);
  }
  for (const id of run.missionsCompleted) {
    if (d.missions.completed.includes(id)) continue;
    d.missions.completed.push(id);
    missionRewards += missionById(id)?.reward ?? 0;
  }
  d.coins += run.coins + missionRewards;
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
  return { newBest, previousBest, coinsEarned: run.coins, missionRewards, unlockedNow };
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
  return [...TRAILS, ...RUN_STYLES, ...ROUTES].find((x) => x.id === id)?.price ?? Infinity;
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
