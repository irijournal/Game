import type { ObstacleClass, ObstacleKind, ThemeId } from './types';

export interface ObstacleDef {
  cls: ObstacleClass;
  depth: number;
  bottom: number;
  top: number;
  halfW: number;
  /** Distance (m) before which this kind is never spawned in normal runs. */
  introAt: number;
  label: string;
  /** The bulldozer power-up may push this aside (debris, red tape, cones). */
  clearable: boolean;
}

const low = (depth: number, top: number, halfW: number, introAt: number, label: string, clearable = true): ObstacleDef => ({
  cls: 'low',
  depth,
  bottom: 0,
  top,
  halfW,
  introAt,
  label,
  clearable,
});
const high = (depth: number, top: number, introAt: number, label: string): ObstacleDef => ({
  cls: 'high',
  depth,
  bottom: 1.25,
  top,
  halfW: 0.98,
  introAt,
  label,
  clearable: false,
});
const wall = (depth: number, top: number, halfW: number, introAt: number, label: string): ObstacleDef => ({
  cls: 'wall',
  depth,
  bottom: 0,
  top,
  halfW,
  introAt,
  label,
  clearable: false,
});
const gap = (depth: number, halfW: number, introAt: number, label: string): ObstacleDef => ({
  cls: 'gap',
  depth,
  bottom: -1,
  top: 0,
  halfW,
  introAt,
  label,
  clearable: true,
});

/**
 * Collision volumes. The rules are deliberately consistent so players can
 * learn them:
 *  - low  (knee height, hazard striped): jump over or change lane
 *  - high (hanging at head height): slide under or change lane
 *  - wall (always taller than any jump, >= 2.6 m): change lane
 *  - gap  (hole / canal / drain in the road): jump over or change lane
 */
export const OBSTACLES: Record<ObstacleKind, ObstacleDef> = {
  barricade: low(0.5, 1.0, 0.95, 0, 'Traffic barricade'),
  cones: low(0.6, 0.9, 0.95, 0, 'Work-zone cones'),
  fileStack: low(0.9, 0.95, 0.85, 0, 'Red-tape file pile'),
  aframeSign: low(0.7, 1.05, 0.85, 60, 'GUNDARAJ? warning sign', false),
  flowerCart: low(1.0, 1.0, 0.9, 0, 'Flower cart', false),
  luggageCart: low(1.2, 1.0, 0.9, 0, 'Luggage trolleys', false),
  brokenPipe: low(0.6, 0.85, 0.95, 0, 'Broken irrigation pipe'),
  hayBale: low(1.0, 1.0, 0.9, 0, 'Hay bales', false),
  queueBarrier: low(0.5, 1.0, 0.95, 0, 'Queue barrier'),
  delaySign: low(0.6, 1.0, 0.9, 0, '“DELAYED” sign'),
  pallet: low(1.0, 0.95, 0.9, 0, 'Loaded pallet'),
  droneCrate: low(0.8, 1.0, 0.85, 0, 'Delivery-drone crate', false),

  pothole: gap(1.8, 0.85, 220, 'Pothole'),
  roadGap: gap(3.0, 1.0, 400, 'Work-zone gap'),
  wideGap: gap(4.2, 1.0, Infinity, 'Wide gap'),
  canalGap: gap(2.6, 1.0, 150, 'Irrigation canal'),
  openDrain: gap(2.0, 1.0, 180, 'Open drain'),

  bannerArch: high(0.35, 2.5, 100, 'Campaign banner'),
  boomBarrier: high(0.3, 1.65, 140, 'Checkpoint / toll boom'),
  scaffold: high(0.6, 2.2, 260, 'Scaffold beam'),
  toranaArch: high(0.4, 2.6, 80, 'Festival torana'),
  flightBoard: high(0.4, 2.4, 80, 'Flight information board'),
  conveyor: high(0.8, 2.0, 80, 'Overhead conveyor'),
  holoGate: high(0.3, 2.4, 80, 'Hologram gate'),

  gundarajBoard: wall(0.6, 3.0, 0.95, 0, 'GUNDARAJ? board'),
  constructionWall: wall(0.5, 2.6, 0.98, 0, 'Development barrier'),
  fileMountain: wall(1.4, 2.8, 0.9, 200, 'File mountain'),
  mediaVan: wall(5.0, 2.7, 0.95, 400, 'News van'),
  bus: wall(8.0, 3.1, 1.0, 700, 'Bus'),
  truck: wall(6.0, 3.0, 1.0, 300, 'Truck'),
  chariotFloat: wall(4.0, 3.0, 1.0, 200, 'Festival float'),
  baggageTug: wall(4.5, 2.7, 0.95, 150, 'Baggage loader'),
  crateStack: wall(1.4, 2.7, 0.95, 0, 'Crate stack'),
  tractor: wall(3.6, 2.7, 1.0, 150, 'Parked tractor'),
  unfinishedSign: wall(0.6, 2.8, 0.95, 0, '“UNFINISHED PROJECT” board'),
  forklift: wall(2.6, 2.8, 0.95, 100, 'Forklift'),
  maglevPod: wall(5.0, 2.8, 1.0, 150, 'Maglev pod'),
};

type KindWeights = Partial<Record<ObstacleKind, number>>;
export type ClassWeights = Record<ObstacleClass, KindWeights>;

export type WeightKey = ThemeId | 'redCap' | 'promises' | 'chase' | 'development';

export const THEME_OBSTACLES: Record<WeightKey, ClassWeights> = {
  expressway: {
    low: { cones: 3, barricade: 2 },
    high: { boomBarrier: 3, bannerArch: 1 },
    wall: { truck: 3, constructionWall: 2, bus: 1 },
    gap: { roadGap: 2, pothole: 1 },
  },
  ayodhya: {
    low: { flowerCart: 3, barricade: 2 },
    high: { toranaArch: 4, bannerArch: 1 },
    wall: { chariotFloat: 3, bus: 1, mediaVan: 1 },
    gap: { openDrain: 1, pothole: 1 },
  },
  airport: {
    low: { luggageCart: 4, cones: 1 },
    high: { flightBoard: 3, boomBarrier: 1 },
    wall: { baggageTug: 3, constructionWall: 2, bus: 1 },
    gap: { roadGap: 1 },
  },
  kisan: {
    low: { hayBale: 3, brokenPipe: 3 },
    high: { bannerArch: 2, boomBarrier: 1 },
    wall: { tractor: 3, crateStack: 3 },
    gap: { canalGap: 3 },
  },
  jankalyan: {
    low: { queueBarrier: 3, fileStack: 2, delaySign: 1 },
    high: { bannerArch: 3 },
    wall: { fileMountain: 2, unfinishedSign: 1, mediaVan: 1, bus: 1 },
    gap: { openDrain: 3, pothole: 1 },
  },
  lawandorder: {
    low: { aframeSign: 3, barricade: 3 },
    high: { boomBarrier: 3, bannerArch: 1 },
    wall: { gundarajBoard: 3, mediaVan: 2, bus: 1, truck: 1 },
    gap: { pothole: 2 },
  },
  startup: {
    low: { pallet: 3, cones: 2 },
    high: { conveyor: 3, scaffold: 2 },
    wall: { forklift: 3, constructionWall: 2, crateStack: 1, truck: 1 },
    gap: { roadGap: 1 },
  },
  viksit: {
    low: { droneCrate: 3, cones: 1 },
    high: { holoGate: 4 },
    wall: { maglevPod: 3, constructionWall: 1 },
    gap: { roadGap: 1 },
  },
  redCap: {
    low: { barricade: 2, aframeSign: 2, fileStack: 1 },
    high: { bannerArch: 2, boomBarrier: 1 },
    wall: { gundarajBoard: 2, constructionWall: 1, unfinishedSign: 1 },
    gap: { pothole: 1 },
  },
  promises: {
    low: { fileStack: 3, delaySign: 3 },
    high: { bannerArch: 1 },
    wall: { unfinishedSign: 3, fileMountain: 2 },
    gap: { pothole: 1 },
  },
  development: {
    low: { cones: 3, barricade: 3 },
    high: { scaffold: 3, boomBarrier: 1 },
    wall: { constructionWall: 4, truck: 1 },
    gap: { roadGap: 2, pothole: 1 },
  },
  chase: {
    low: { cones: 2, barricade: 2, fileStack: 1 },
    high: { scaffold: 2, boomBarrier: 2, bannerArch: 1 },
    wall: { constructionWall: 3, gundarajBoard: 1, fileMountain: 1 },
    gap: { wideGap: 2, roadGap: 1 },
  },
};

/** Kinds the bulldozer power-up drops ahead to push aside. */
export const DEBRIS_KINDS: readonly ObstacleKind[] = ['cones', 'barricade', 'fileStack', 'pothole', 'delaySign'];
