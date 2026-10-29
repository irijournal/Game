/**
 * Central scoring rules. Every point in a run is awarded through ScoreKeeper,
 * so the final score is always the sum of the breakdown shown on the results
 * screen.
 */
export const POINTS = {
  perMetre: 1,
  perCoin: 5,
  perDodge: 10,
  perOverDodge: 15,
  chaseBase: 500,
  chasePerEscape: 25,
  chaseToken: 150,
  challengeComplete: 1000,
  mission: 250,
  discovery: 250,
  heritageToken: 50,
} as const;

export type BonusKind = 'chase' | 'chaseToken' | 'challenge' | 'mission' | 'discovery' | 'heritageToken';

export interface ScoreBreakdown {
  distance: number;
  coins: number;
  dodges: number;
  chase: number;
  missions: number;
  discovery: number;
  tokens: number;
  total: number;
}

export class ScoreKeeper {
  private distancePts = 0;
  private coinPts = 0;
  private dodgePts = 0;
  private chasePts = 0;
  private missionPts = 0;
  private discoveryPts = 0;
  private tokenPts = 0;

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
    this.chasePts += pts;
    return pts;
  }

  addBonus(kind: BonusKind, amount?: number): number {
    const pts =
      amount ??
      (kind === 'chaseToken'
        ? POINTS.chaseToken
        : kind === 'challenge'
          ? POINTS.challengeComplete
          : kind === 'mission'
            ? POINTS.mission
            : kind === 'discovery'
              ? POINTS.discovery
              : kind === 'heritageToken'
                ? POINTS.heritageToken
                : 0);
    if (kind === 'mission') this.missionPts += pts;
    else if (kind === 'discovery') this.discoveryPts += pts;
    else if (kind === 'chase' || kind === 'chaseToken' || kind === 'challenge') this.chasePts += pts;
    else this.tokenPts += pts;
    return pts;
  }

  get total(): number {
    return (
      Math.floor(this.distancePts) +
      this.coinPts +
      this.dodgePts +
      this.chasePts +
      this.missionPts +
      this.discoveryPts +
      this.tokenPts
    );
  }

  breakdown(): ScoreBreakdown {
    return {
      distance: Math.floor(this.distancePts),
      coins: this.coinPts,
      dodges: this.dodgePts,
      chase: this.chasePts,
      missions: this.missionPts,
      discovery: this.discoveryPts,
      tokens: this.tokenPts,
      total: this.total,
    };
  }
}
