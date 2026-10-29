import { LANE_CHANGE_TIME, LANE_X, PLAYER_HALF_D } from './constants';
import { OBSTACLES, THEME_OBSTACLES, type ClassWeights } from './obstacles';
import type { Rng } from './rng';
import type { Lane, ObstacleClass, ObstacleKind, PickupKind, Row, RowCell, ThemeId } from './types';

export type ChunkKind = 'normal' | 'chase' | 'development' | 'coinRush';

export interface GenContext {
  kind: ChunkKind;
  theme: ThemeId;
  /** Track position used to gate when obstacle types are introduced. */
  distance: number;
  /** 0 = gentle, 1 = hardest. */
  diff: number;
  /** Conservative (upper-bound) running speed at a track position. */
  vAt: (s: number) => number;
  /** Optional upper bound on how many rows the chunk may contain. */
  maxRows?: number;
}

const T1 = ['L..', '.L.', '..L', 'H..', '.H.', '..H', 'W..', '.W.', '..W', 'G..', '.G.', '..G'];
const T2 = [
  'WW.', 'W.W', '.WW', 'LL.', '.LL', 'L.L', 'HH.', '.HH', 'H.H', 'WL.', '.LW', 'LW.', 'W.L', 'L.W', 'H.W',
  'W.H', 'WH.', '.HW', 'HW.', '.WH', 'LLL', 'HHH', 'LH.', '.HL', 'L.H',
];
const T3 = ['WWL', 'LWW', 'WWH', 'HWW', 'WLW', 'WHW', 'LHL', 'HLH', 'GGG', 'WGW', 'GWL', 'LWG', 'LGH', 'HGL', 'WLH', 'HLW'];
const COIN_RUSH = ['L..', '..L', '.L.', '...', '...'];

const CHAR_CLASS: Record<string, ObstacleClass | null> = { L: 'low', H: 'high', W: 'wall', G: 'gap', '.': null };

export const EMPTY_CELL: RowCell = { cls: null, kind: null, depth: 0 };

/** Distance needed to shift `lanes` lanes at speed v, including reaction. */
export function laneChangeDistance(v: number, lanes = 1): number {
  return lanes * v * LANE_CHANGE_TIME * 1.15 + 2 * PLAYER_HALF_D + 0.6 + v * 0.12;
}

/** Minimum time between two vertical actions (jump / slide) in one lane. */
export const VERTICAL_RECOVERY_T = 0.78;

export function needsVertical(c: RowCell): boolean {
  return c.cls === 'low' || c.cls === 'high' || c.cls === 'gap';
}

export function passable(row: Row, lane: number): boolean {
  return row.cells[lane].cls !== 'wall';
}

export function cellEnd(row: Row, lane: number): number {
  return row.s + row.cells[lane].depth;
}

/**
 * Can a runner who passed `prev` in lane `a` be safely in lane `b` when it
 * reaches `row`? `startS` is used when there is no previous row.
 */
export function canTransition(
  prev: Row | null,
  row: Row,
  a: number,
  b: number,
  vAt: (s: number) => number,
  startS: number,
): boolean {
  if (!passable(row, b)) return false;
  const v = vAt(row.s);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let start = startS;
  if (prev) for (let l = lo; l <= hi; l++) start = Math.max(start, cellEnd(prev, l));
  const window = row.s - start;
  if (a === b) {
    if (prev && needsVertical(prev.cells[a]) && needsVertical(row.cells[b])) {
      return window >= VERTICAL_RECOVERY_T * v;
    }
    return window >= 0;
  }
  return window >= laneChangeDistance(v, hi - lo);
}

/** Forward reachability: lanes a runner can occupy at each row. */
export function reachableSets(
  rows: Row[],
  startLanes: readonly number[],
  vAt: (s: number) => number,
  startS: number,
): number[][] {
  const out: number[][] = [];
  let R = [...startLanes];
  for (let i = 0; i < rows.length; i++) {
    const prev = i > 0 ? rows[i - 1] : null;
    const next: number[] = [];
    for (let b = 0; b < 3; b++) {
      if (R.some((a) => canTransition(prev, rows[i], a, b, vAt, startS))) next.push(b);
    }
    out.push(next);
    if (!next.length) break;
    R = next;
  }
  return out;
}

/**
 * Route-validity checker. A row sequence is accepted only if a runner who
 * starts in *any* of `startLanes` can reach the end without a collision,
 * taking lane-change time, jump/slide recovery and obstacle lengths into
 * account. Rows must be sorted and non-overlapping.
 */
export function validateRows(
  rows: Row[],
  startLanes: readonly number[],
  vAt: (s: number) => number,
  startS: number,
): boolean {
  for (let i = 1; i < rows.length; i++) if (rows[i].s < rows[i - 1].end) return false;
  for (const lane of startLanes) {
    const sets = reachableSets(rows, [lane], vAt, startS);
    if (sets.length < rows.length || sets[sets.length - 1].length === 0) return false;
  }
  return true;
}

function weightsFor(ctx: GenContext): ClassWeights {
  if (ctx.kind === 'chase') return THEME_OBSTACLES.chase;
  if (ctx.kind === 'development') return THEME_OBSTACLES.development;
  return THEME_OBSTACLES[ctx.theme];
}

function allowedKinds(ctx: GenContext, cls: ObstacleClass): Partial<Record<ObstacleKind, number>> {
  const w = weightsFor(ctx)[cls];
  const out: Partial<Record<ObstacleKind, number>> = {};
  for (const k in w) {
    const kind = k as ObstacleKind;
    const def = OBSTACLES[kind];
    const ok = ctx.kind === 'chase' ? true : def.introAt <= ctx.distance;
    if (ok) out[kind] = w[kind];
  }
  return out;
}

function hasAny(o: object): boolean {
  return Object.keys(o).length > 0;
}

/** Resolve a class to a concrete kind, downgrading classes not yet introduced. */
export function pickKind(rng: Rng, ctx: GenContext, cls: ObstacleClass): ObstacleKind {
  let c: ObstacleClass = cls;
  let kinds = allowedKinds(ctx, c);
  if (!hasAny(kinds) && c === 'gap') kinds = allowedKinds(ctx, (c = 'low'));
  if (!hasAny(kinds) && c === 'high') kinds = allowedKinds(ctx, (c = 'low'));
  if (!hasAny(kinds)) return c === 'wall' ? 'gundarajBoard' : 'barricade';
  return rng.weighted(kinds);
}

export function pickTemplate(rng: Rng, ctx: GenContext): string {
  if (ctx.kind === 'coinRush') return rng.pick(COIN_RUSH);
  const d = ctx.diff;
  const w1 = 0.8 - 0.55 * d;
  const w3 = 0.3 * d;
  const r = rng.next();
  if (r < w1) return rng.pick(T1);
  if (r < 1 - w3) return rng.pick(T2);
  return rng.pick(T3);
}

function makeCells(rng: Rng, ctx: GenContext, template: string): [RowCell, RowCell, RowCell] {
  const cells: RowCell[] = [];
  for (let i = 0; i < 3; i++) {
    const cls = CHAR_CLASS[template[i]] ?? null;
    if (!cls) {
      cells.push(EMPTY_CELL);
      continue;
    }
    const kind = pickKind(rng, ctx, cls);
    const def = OBSTACLES[kind];
    cells.push({ cls: def.cls, kind, depth: def.depth });
  }
  return cells as [RowCell, RowCell, RowCell];
}

export function rowGapTime(ctx: GenContext): number {
  if (ctx.kind === 'chase') return 1.5 - 0.5 * ctx.diff;
  if (ctx.kind === 'coinRush') return 1.6;
  return 1.35 - 0.47 * ctx.diff;
}

export function leadGap(v: number): number {
  return Math.max(laneChangeDistance(v, 2) + 2, 0.9 * v);
}

let rowIdCounter = 1;

/** Build one validated chunk of rows starting at `startS`. Never throws. */
export function buildChunk(rng: Rng, ctx: GenContext, startS: number): Row[] {
  for (let attempt = 0; attempt < 16; attempt++) {
    const n = Math.min(ctx.maxRows ?? 99, rng.int(3, 6));
    const rows: Row[] = [];
    let cursor = startS + leadGap(ctx.vAt(startS));
    for (let k = 0; k < n; k++) {
      const cells = makeCells(rng, ctx, pickTemplate(rng, ctx));
      if (k > 0) {
        const v = ctx.vAt(cursor);
        cursor += Math.max(9, rowGapTime(ctx) * rng.range(1, 1.3) * v);
      }
      const end = cursor + Math.max(...cells.map((c) => c.depth), 0.3);
      rows.push({ id: 0, s: cursor, end, cells, passed: false, chase: ctx.kind === 'chase' });
      cursor = end;
    }
    if (validateRows(rows, [0, 1, 2], ctx.vAt, startS)) {
      for (const r of rows) r.id = rowIdCounter++;
      return rows;
    }
  }
  // Fallback that is always valid: a single low barricade in the middle.
  const s = startS + leadGap(ctx.vAt(startS));
  const def = OBSTACLES.barricade;
  return [
    {
      id: rowIdCounter++,
      s,
      end: s + def.depth,
      cells: [EMPTY_CELL, { cls: 'low', kind: 'barricade', depth: def.depth }, EMPTY_CELL],
      passed: false,
      chase: ctx.kind === 'chase',
    },
  ];
}

export interface PickupSpec {
  kind: PickupKind;
  s: number;
  lane: Lane;
  x: number;
  y: number;
}

/** Pick one valid lane per row (a route), preferring to stay in lane. */
export function pickRoute(
  rng: Rng,
  rows: Row[],
  startLane: number,
  vAt: (s: number) => number,
  startS: number,
): number[] | null {
  const sets = reachableSets(rows, [startLane], vAt, startS);
  if (sets.length < rows.length || !sets[sets.length - 1].length) return null;
  const route = new Array<number>(rows.length);
  const last = sets[rows.length - 1];
  route[rows.length - 1] = rng.pick(last);
  for (let i = rows.length - 2; i >= 0; i--) {
    const target = route[i + 1];
    const options = sets[i].filter((a) => canTransition(rows[i], rows[i + 1], a, target, vAt, startS));
    route[i] = options.includes(target) ? target : rng.pick(options.length ? options : sets[i]);
  }
  return route;
}

/**
 * Coins that follow a valid route: on the ground between rows, in an arc over
 * low obstacles and gaps, and low under hanging ones. Coins are never placed
 * inside a wall or inside any collision volume.
 */
export function placeCoins(
  rng: Rng,
  rows: Row[],
  startS: number,
  vAt: (s: number) => number,
  extraKinds: PickupKind[] = [],
): PickupSpec[] {
  if (!rows.length) return [];
  const startLane = rng.int(0, 2);
  const route = pickRoute(rng, rows, startLane, vAt, startS);
  if (!route) return [];
  const out: PickupSpec[] = [];
  const add = (s: number, lane: number, y: number, kind: PickupKind = 'coin') =>
    out.push({ kind, s, lane: lane as Lane, x: LANE_X[lane], y });

  let prevLane = startLane;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;
    const lane = route[i];
    const v = vAt(row.s);
    const lo = Math.min(prevLane, lane);
    const hi = Math.max(prevLane, lane);
    let segStart = prev ? prev.s : startS + 4;
    if (prev) for (let l = lo; l <= hi; l++) segStart = Math.max(segStart, cellEnd(prev, l) + 2.5);
    if (lane !== prevLane) segStart += laneChangeDistance(v, hi - lo);
    const cell = row.cells[lane];
    const arcStart = cell.cls === 'low' || cell.cls === 'gap' ? row.s - 3.2 : row.s - 1.6;
    for (let s = segStart; s < arcStart - 0.5; s += 2.4) add(s, lane, 0.9);
    if (cell.cls === 'low' || cell.cls === 'gap') {
      const a = row.s - 3;
      const b = row.s + cell.depth + 3;
      for (let s = a; s <= b + 0.01; s += 1.5) {
        const t = (s - a) / (b - a);
        add(s, lane, 1.1 + 1.5 * Math.sin(Math.PI * t));
      }
    } else if (cell.cls === 'high') {
      for (let s = row.s - 1.5; s <= row.end + 1.5; s += 1.5) add(s, lane, 0.45);
    } else {
      for (let s = arcStart; s <= row.end + 1; s += 2.4) add(s, lane, 0.9);
    }
    prevLane = lane;
  }

  // Swap a few ground coins for special pickups.
  for (const kind of extraKinds) {
    const ground = out.filter((c) => c.kind === 'coin' && c.y === 0.9);
    if (!ground.length) break;
    const c = rng.pick(ground);
    c.kind = kind;
  }
  return out.filter((c) => !coinInsideObstacle(c, rows));
}

export function coinInsideObstacle(c: { s: number; lane: number; y: number }, rows: Row[]): boolean {
  for (const row of rows) {
    const cell = row.cells[c.lane];
    if (!cell.cls || !cell.kind) continue;
    const def = OBSTACLES[cell.kind];
    if (c.s < row.s - 0.35 || c.s > row.s + cell.depth + 0.35) continue;
    if (cell.cls === 'wall') return true;
    if (cell.cls === 'low' && c.y < def.top + 0.35) return true;
    if (cell.cls === 'high' && c.y > def.bottom - 0.35) return true;
  }
  return false;
}
