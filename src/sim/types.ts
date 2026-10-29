export type Lane = 0 | 1 | 2;
export type ObstacleClass = 'low' | 'high' | 'wall' | 'gap';

export type ObstacleKind =
  // low (jump or change lane)
  | 'barricade'
  | 'cones'
  | 'fileStack'
  | 'aframeSign'
  | 'flowerCart'
  | 'luggageCart'
  | 'brokenPipe'
  | 'hayBale'
  | 'queueBarrier'
  | 'delaySign'
  | 'pallet'
  | 'droneCrate'
  | 'laptopPile'
  | 'cycleHeap'
  // gaps (jump or change lane)
  | 'pothole'
  | 'roadGap'
  | 'wideGap'
  | 'canalGap'
  | 'openDrain'
  // hanging (slide or change lane)
  | 'bannerArch'
  | 'boomBarrier'
  | 'scaffold'
  | 'toranaArch'
  | 'flightBoard'
  | 'conveyor'
  | 'holoGate'
  // walls (change lane)
  | 'gundarajBoard'
  | 'constructionWall'
  | 'fileMountain'
  | 'mediaVan'
  | 'bus'
  | 'truck'
  | 'chariotFloat'
  | 'baggageTug'
  | 'crateStack'
  | 'tractor'
  | 'unfinishedSign'
  | 'forklift'
  | 'maglevPod'
  | 'familyMeeting'
  | 'kaamPoster';

/** Development tokens look different in every environment. */
export type TokenVariant = 'road' | 'diya' | 'plane' | 'wheat' | 'welfare' | 'shield' | 'gear' | 'star';

export type PickupKind = 'coin' | 'magnet' | 'vikas' | 'chaseToken' | 'devToken' | 'reportCard' | 'promise' | 'bulldozer';

/** Playable environments (each campaign level has its own). */
export type ThemeId = 'expressway' | 'ayodhya' | 'airport' | 'kisan' | 'jankalyan' | 'lawandorder' | 'startup' | 'viksit';
export const THEME_ORDER: readonly ThemeId[] = ['expressway', 'ayodhya', 'airport', 'kisan', 'jankalyan', 'lawandorder', 'startup', 'viksit'];

export type CharacterId = 'yogi' | 'akhilesh' | 'karyakarta';

/**
 * campaign: the eight development levels (hero)
 * rivalry:  play as the rival; stages end in a Governance Showdown chase
 * race:     Development Race against the rival on a parallel route
 * free:     endless free run with any unlocked character
 */
export type ModeId = 'campaign' | 'rivalry' | 'race' | 'free';

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
  /** Road debris placed for the bulldozer power-up to clear. */
  debris: boolean;
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
  variant: TokenVariant | null;
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
  warned?: boolean;
}

/** Scripted rival/level encounters placed along a course. */
export type EncounterKind = 'redCap' | 'promises' | 'quiz' | 'bulldozer';

export interface Encounter {
  kind: EncounterKind;
  /** Start of the encounter (or the gate position for a quiz). */
  s0: number;
  s1: number;
  quizId?: string;
  announced: boolean;
  started: boolean;
  ended: boolean;
  failed: boolean;
  /** Promises vs Performance bookkeeping. */
  total: number;
  got: number;
  /** Quiz: lane chosen and whether it was correct. */
  chosen?: number;
  correct?: boolean;
}
