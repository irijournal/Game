import type { RunResultInfo } from '../save/save';
import type { RunSummary } from '../sim/simulation';
import type { CharacterId, EncounterKind, ModeId, SimState, ThemeId, TokenVariant } from '../sim/types';

export type CaptionTone = 'challenge' | 'showdown' | 'chase' | 'success' | 'go' | 'warn' | 'info';
export type ToastTone = 'mission' | 'discovery' | 'bonus' | 'info' | 'warn' | 'powerup';

export type UiEvent =
  | { type: 'caption'; text: string; sub?: string; tone: CaptionTone; ms: number }
  | { type: 'clearCaptions' }
  | { type: 'comic'; text: string }
  | { type: 'toast'; text: string; sub?: string; tone: ToastTone }
  | { type: 'hint'; text: string }
  | { type: 'infoCard'; title: string; body: string }
  | { type: 'factCard'; factId: string; heading: string }
  | { type: 'gameOver'; summary: RunSummary; info: RunResultInfo }
  | { type: 'paused'; paused: boolean; reason?: string }
  | { type: 'introDone' }
  | { type: 'error'; message: string };

export interface HudSnapshot {
  active: boolean;
  score: number;
  distance: number;
  coins: number;
  meter: number;
  guardReady: boolean;
  guardT: number;
  state: SimState | 'NONE';
  chase: { remaining: number; total: number; escapes: number; kind: 'bulldozer' | 'cycle'; stage: number } | null;
  power: { kind: 'magnet' | 'vikas' | 'speedRun' | 'bulldozer'; t: number; total: number } | null;
  /** Campaign level progress. */
  level: { id: ThemeId; num: number; name: string; progress: number; tokens: number; goal: number; token: TokenVariant } | null;
  /** Development Race progress (0..1 for both runners). */
  race: { progress: number; rival: number } | null;
  /** Accountability Gate being approached or just passed. */
  quiz: { id: string; q: string; options: [string, string, string]; metres: number; chosen: number | null; correct: boolean | null } | null;
  /** Red Cap Challenge / Promises vs Performance in progress. */
  encounter: { kind: EncounterKind; got: number; total: number; failed: boolean; metres: number } | null;
  devTokens: number;
  stage: number;
  mode: ModeId;
  character: CharacterId;
  rival: CharacterId;
  theme: ThemeId;
  skippable: boolean;
  multiplier: number;
}

export const EMPTY_HUD: HudSnapshot = {
  active: false,
  score: 0,
  distance: 0,
  coins: 0,
  meter: 0,
  guardReady: true,
  guardT: 0,
  state: 'NONE',
  chase: null,
  power: null,
  level: null,
  race: null,
  quiz: null,
  encounter: null,
  devTokens: 0,
  stage: 1,
  mode: 'campaign',
  character: 'yogi',
  rival: 'akhilesh',
  theme: 'expressway',
  skippable: false,
  multiplier: 1,
};

/** Minimal external store for useSyncExternalStore. */
export class HudStore {
  private snap: HudSnapshot = EMPTY_HUD;
  private listeners = new Set<() => void>();
  get = (): HudSnapshot => this.snap;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  set(next: HudSnapshot): void {
    const a = this.snap;
    if (
      a.active === next.active &&
      a.score === next.score &&
      a.distance === next.distance &&
      a.coins === next.coins &&
      a.meter === next.meter &&
      a.guardReady === next.guardReady &&
      Math.round(a.guardT) === Math.round(next.guardT) &&
      a.state === next.state &&
      a.skippable === next.skippable &&
      a.multiplier === next.multiplier &&
      a.theme === next.theme &&
      a.devTokens === next.devTokens &&
      a.stage === next.stage &&
      JSON.stringify(a.chase) === JSON.stringify(next.chase) &&
      JSON.stringify(a.power) === JSON.stringify(next.power) &&
      JSON.stringify(a.level) === JSON.stringify(next.level) &&
      JSON.stringify(a.race) === JSON.stringify(next.race) &&
      JSON.stringify(a.quiz) === JSON.stringify(next.quiz) &&
      JSON.stringify(a.encounter) === JSON.stringify(next.encounter)
    )
      return;
    this.snap = next;
    this.listeners.forEach((l) => l());
  }
}
