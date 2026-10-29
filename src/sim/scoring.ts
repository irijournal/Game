/**
 * Central scoring rules. Every point in a run is awarded through ScoreKeeper,
 * so the final score is always the sum of the breakdown on the results
 * screen. The score is a fictional game score: it measures your run, not any
 * government's real performance.
 */
export const POINTS = {
  perMetre: 1,
  perCoin: 5,
  perDodge: 10,
  perOverDodge: 15,
  chaseBase: 500,
  chasePerEscape: 25,
  chaseToken: 150,
  mission: 250,
  discovery: 250,
  devToken: 25,
  reportCard: 50,
  quiz: 200,
  rivalWin: 300,
  promisesDelivered: 300,
  promise: 20,
  roadCleared: 20,
  levelComplete: 500,
  perStar: 250,
  raceWin: 750,
} as const;

export type BonusKind =
  | 'chase'
  | 'chaseToken'
  | 'mission'
  | 'discovery'
  | 'devToken'
  | 'reportCard'
  | 'quiz'
  | 'rivalWin'
  | 'promisesDelivered'
  | 'promise'
  | 'roadCleared'
  | 'level'
  | 'raceWin';

export interface ScoreBreakdown {
  distance: number;
  coins: number;
  dodges: number;
  chase: number;
  missions: number;
  discovery: number;
  tokens: number;
  rival: number;
  level: number;
  total: number;
}

const DEFAULTS: Partial<Record<BonusKind, number>> = {
  chaseToken: POINTS.chaseToken,
  mission: POINTS.mission,
  discovery: POINTS.discovery,
  devToken: POINTS.devToken,
  reportCard: POINTS.reportCard,
  quiz: POINTS.quiz,
  rivalWin: POINTS.rivalWin,
  promisesDelivered: POINTS.promisesDelivered,
  promise: POINTS.promise,
  roadCleared: POINTS.roadCleared,
  raceWin: POINTS.raceWin,
};

const BUCKET: Record<BonusKind, keyof Omit<ScoreBreakdown, 'total' | 'distance' | 'coins' | 'dodges'>> = {
  chase: 'chase',
  chaseToken: 'chase',
  reportCard: 'chase',
  mission: 'missions',
  discovery: 'discovery',
  devToken: 'tokens',
  roadCleared: 'tokens',
  quiz: 'rival',
  rivalWin: 'rival',
  promisesDelivered: 'rival',
  promise: 'rival',
  raceWin: 'rival',
  level: 'level',
};

export class ScoreKeeper {
  private distancePts = 0;
  private coinPts = 0;
  private dodgePts = 0;
  private buckets = { chase: 0, missions: 0, discovery: 0, tokens: 0, rival: 0, level: 0 };
  /** Multiplier applied to development tokens (Growth Multiplier badge). */
  tokenMultiplier = 1;

  addDistance(metres: number, multiplier = 1): void {
    if (!(metres > 0)) return;
    this.distancePts += metres * POINTS.perMetre * multiplier;
  }

  addCoin(multiplier = 1): number {
    const pts = POINTS.perCoin * multiplier;
    this.coinPts += pts;
    return pts;
  }

  addDodge(over: boolean): number {
    const pts = over ? POINTS.perOverDodge : POINTS.perDodge;
    this.dodgePts += pts;
    return pts;
  }

  addChaseComplete(escapes: number): number {
    const pts = POINTS.chaseBase + POINTS.chasePerEscape * Math.max(0, escapes);
    this.buckets.chase += pts;
    return pts;
  }

  addLevelComplete(stars: number): number {
    const pts = POINTS.levelComplete + POINTS.perStar * Math.max(0, stars);
    this.buckets.level += pts;
    return pts;
  }

  addBonus(kind: BonusKind, amount?: number): number {
    let pts = amount ?? DEFAULTS[kind] ?? 0;
    if (kind === 'devToken') pts = Math.round(pts * this.tokenMultiplier);
    this.buckets[BUCKET[kind]] += pts;
    return pts;
  }

  get total(): number {
    const b = this.buckets;
    return Math.floor(this.distancePts) + this.coinPts + this.dodgePts + b.chase + b.missions + b.discovery + b.tokens + b.rival + b.level;
  }

  breakdown(): ScoreBreakdown {
    return {
      distance: Math.floor(this.distancePts),
      coins: this.coinPts,
      dodges: this.dodgePts,
      ...this.buckets,
      total: this.total,
    };
  }
}
