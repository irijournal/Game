export type Lane = 0 | 1 | 2;
export type ObstacleClass = 'low' | 'high' | 'wall' | 'gap';

export type ObstacleKind =
  | 'barricade'
  | 'cones'
  | 'fileStack'
  | 'aframeSign'
  | 'pothole'
  | 'roadGap'
  | 'wideGap'
  | 'bannerArch'
  | 'boomBarrier'
  | 'scaffold'
  | 'gundarajBoard'
  | 'constructionWall'
  | 'fileMountain'
  | 'mediaVan'
  | 'bus'
  | 'truck';

export type PickupKind = 'coin' | 'magnet' | 'vikas' | 'chaseToken' | 'heritageToken';

export type ThemeId = 'lucknow' | 'heritage' | 'modern' | 'festival';
export const THEME_ORDER: readonly ThemeId[] = ['lucknow', 'heritage', 'modern', 'festival'];

export type CharacterId = 'akhilesh' | 'yogi' | 'ummeedwar';
export type ModeId = 'A' | 'B' | 'C';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  cls: ObstacleClass;
  lane: Lane;
  /** Track position of the near (front) face. */
  s: number;
  depth: number;
  bottom: number;
  top: number;
  halfW: number;
  rowId: number;
  /** Render hint: first overhead cell of a row draws the shared gantry. */
  gantry: boolean;
  /** Per-step contact bookkeeping (see collision.ts). */
  flags: number;
  /** Set after a recoverable hit; the obstacle is knocked away and inert. */
  hit: boolean;
  passed: boolean;
}

export interface RowCell {
  cls: ObstacleClass | null;
  kind: ObstacleKind | null;
  depth: number;
}

export interface Row {
  id: number;
  s: number;
  /** Track position where the longest obstacle in the row ends. */
  end: number;
  cells: [RowCell, RowCell, RowCell];
  passed: boolean;
  chase: boolean;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  s: number;
  x: number;
  y: number;
  lane: Lane;
  collected: boolean;
  magnetized: boolean;
}

export type SimState =
  | 'RUNNING'
  | 'EVENT_PENDING'
  | 'STUMBLE'
  | 'CINEMATIC'
  | 'CHASE'
  | 'SUCCESS'
  | 'FAILURE'
  | 'GAME_OVER';

export type Action = 'left' | 'right' | 'jump' | 'slide' | 'skip';

export type DirectorEventKind = 'posterAlley' | 'developmentRoute' | 'coinRush' | 'speedRun';

export interface PlannedEvent {
  kind: DirectorEventKind;
  s0: number;
  s1: number;
  started: boolean;
  ended: boolean;
}
