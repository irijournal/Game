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
}

/**
 * Collision volumes. The rules are deliberately consistent so players can
 * learn them:
 *  - low  (knee height, yellow/black): jump over or change lane
 *  - high (hanging at head height, red/white): slide under or change lane
 *  - wall (taller than any jump): change lane
 *  - gap  (hole in the road with hazard edging): jump over or change lane
 */
export const OBSTACLES: Record<ObstacleKind, ObstacleDef> = {
  barricade: { cls: 'low', depth: 0.5, bottom: 0, top: 1.0, halfW: 0.95, introAt: 0, label: 'Traffic barricade' },
  cones: { cls: 'low', depth: 0.6, bottom: 0, top: 0.9, halfW: 0.95, introAt: 0, label: 'Development-zone cones' },
  fileStack: { cls: 'low', depth: 0.9, bottom: 0, top: 0.95, halfW: 0.85, introAt: 0, label: 'File pile' },
  aframeSign: { cls: 'low', depth: 0.7, bottom: 0, top: 1.05, halfW: 0.85, introAt: 80, label: 'Gundaraj warning sign' },
  pothole: { cls: 'gap', depth: 1.8, bottom: -1, top: 0, halfW: 0.85, introAt: 250, label: 'Pothole' },
  roadGap: { cls: 'gap', depth: 3.0, bottom: -1, top: 0, halfW: 1.0, introAt: 450, label: 'Broken road' },
  wideGap: { cls: 'gap', depth: 4.2, bottom: -1, top: 0, halfW: 1.0, introAt: Infinity, label: 'Wide road gap' },
  bannerArch: { cls: 'high', depth: 0.35, bottom: 1.25, top: 2.5, halfW: 0.98, introAt: 120, label: 'Rally banner' },
  boomBarrier: { cls: 'high', depth: 0.3, bottom: 1.25, top: 1.65, halfW: 0.98, introAt: 180, label: 'Checkpoint boom' },
  scaffold: { cls: 'high', depth: 0.6, bottom: 1.25, top: 2.2, halfW: 0.98, introAt: 320, label: 'Scaffold beam' },
  gundarajBoard: { cls: 'wall', depth: 0.6, bottom: 0, top: 3.0, halfW: 0.95, introAt: 0, label: 'GUNDARAJ? board' },
  constructionWall: { cls: 'wall', depth: 0.5, bottom: 0, top: 2.6, halfW: 0.98, introAt: 0, label: 'Development barrier' },
  fileMountain: { cls: 'wall', depth: 1.4, bottom: 0, top: 2.8, halfW: 0.9, introAt: 280, label: 'File mountain' },
  mediaVan: { cls: 'wall', depth: 5.0, bottom: 0, top: 2.7, halfW: 0.95, introAt: 500, label: 'Media van' },
  bus: { cls: 'wall', depth: 8.0, bottom: 0, top: 3.1, halfW: 1.0, introAt: 900, label: 'Traffic jam bus' },
  truck: { cls: 'wall', depth: 6.0, bottom: 0, top: 3.0, halfW: 1.0, introAt: 700, label: 'Traffic jam truck' },
};

type KindWeights = Partial<Record<ObstacleKind, number>>;
export type ClassWeights = Record<ObstacleClass, KindWeights>;

export const THEME_OBSTACLES: Record<ThemeId | 'development' | 'chase', ClassWeights> = {
  lucknow: {
    low: { barricade: 3, fileStack: 2, aframeSign: 3, cones: 1 },
    high: { bannerArch: 3, boomBarrier: 2 },
    wall: { gundarajBoard: 3, mediaVan: 2, fileMountain: 2, truck: 1, bus: 1, constructionWall: 1 },
    gap: { pothole: 3, roadGap: 1 },
  },
  heritage: {
    low: { barricade: 2, aframeSign: 2, fileStack: 1, cones: 1 },
    high: { bannerArch: 3, boomBarrier: 1 },
    wall: { gundarajBoard: 2, fileMountain: 2, mediaVan: 2, bus: 1 },
    gap: { pothole: 3, roadGap: 1 },
  },
  modern: {
    low: { cones: 3, barricade: 2, fileStack: 1 },
    high: { scaffold: 3, boomBarrier: 2 },
    wall: { constructionWall: 3, truck: 2, mediaVan: 1, gundarajBoard: 1 },
    gap: { roadGap: 2, pothole: 1 },
  },
  festival: {
    low: { aframeSign: 2, barricade: 2, fileStack: 1 },
    high: { bannerArch: 4, boomBarrier: 1 },
    wall: { mediaVan: 3, gundarajBoard: 2, bus: 1, fileMountain: 1 },
    gap: { pothole: 2 },
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
