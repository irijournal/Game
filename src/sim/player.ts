import {
  COYOTE_TIME,
  FAST_FALL_V,
  GRAVITY,
  JUMP_V,
  LANE_SPEED,
  LANE_X,
  PLAYER_SLIDE_H,
  PLAYER_STAND_H,
  SLIDE_TIME,
} from './constants';
import type { Lane } from './types';

export interface PlayerStepResult {
  landed: boolean;
  slideStarted: boolean;
}

/**
 * Pure runner physics. The intended lane (`lane`) is tracked separately from
 * the rendered position (`x`), so repeated inputs can never leave the runner
 * stuck between lanes: `x` always converges on LANE_X[lane].
 */
export class Player {
  lane: Lane = 1;
  prevLane: Lane = 1;
  x: number = LANE_X[1];
  y = 0;
  vy = 0;
  grounded = true;
  airTime = 0;
  jumpedThisAir = false;
  sliding = false;
  slideT = 0;
  slideQueued = false;
  bumpT = 0;

  reset(lane: Lane = 1): void {
    this.lane = lane;
    this.prevLane = lane;
    this.x = LANE_X[lane];
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.airTime = 0;
    this.jumpedThisAir = false;
    this.sliding = false;
    this.slideT = 0;
    this.slideQueued = false;
    this.bumpT = 0;
  }

  clone(): Player {
    const p = new Player();
    Object.assign(p, this);
    return p;
  }

  get height(): number {
    return this.sliding ? PLAYER_SLIDE_H : PLAYER_STAND_H;
  }

  /** True while the runner is between lane centres. */
  get changingLane(): boolean {
    return Math.abs(this.x - LANE_X[this.lane]) > 0.02;
  }

  moveLeft(): boolean {
    if (this.lane === 0) return false;
    this.prevLane = this.lane;
    this.lane = (this.lane - 1) as Lane;
    return true;
  }

  moveRight(): boolean {
    if (this.lane === 2) return false;
    this.prevLane = this.lane;
    this.lane = (this.lane + 1) as Lane;
    return true;
  }

  /** Side bump: return to the lane we came from. */
  bounceBack(): void {
    const back = this.prevLane;
    this.prevLane = this.lane;
    this.lane = back;
    this.bumpT = 0.35;
  }

  canJump(): boolean {
    if (this.jumpedThisAir) return false;
    return this.grounded || this.airTime < COYOTE_TIME;
  }

  jump(): boolean {
    if (!this.canJump()) return false;
    this.vy = JUMP_V;
    this.grounded = false;
    this.jumpedThisAir = true;
    this.sliding = false;
    this.slideT = 0;
    this.slideQueued = false;
    return true;
  }

  /** Grounded: start a slide. Airborne: fast-fall, then slide on landing. */
  slide(): boolean {
    if (!this.grounded) {
      this.vy = Math.min(this.vy, -FAST_FALL_V);
      this.slideQueued = true;
      return true;
    }
    this.sliding = true;
    this.slideT = SLIDE_TIME;
    return true;
  }

  /**
   * @param groundY  height of the surface under the runner (0 = road, or the
   *                 top of a low obstacle the runner landed on)
   * @param underOverhead  true while a hanging obstacle is directly above;
   *                 the slide is extended so the runner cannot stand up into it
   */
  step(dt: number, groundY: number, underOverhead: boolean): PlayerStepResult {
    const res: PlayerStepResult = { landed: false, slideStarted: false };

    const tx = LANE_X[this.lane];
    const dx = tx - this.x;
    const maxStep = LANE_SPEED * dt;
    this.x += Math.abs(dx) <= maxStep ? dx : Math.sign(dx) * maxStep;

    if (this.grounded) {
      if (groundY < this.y - 0.001) {
        // Walked off the top of a low obstacle.
        this.grounded = false;
        this.airTime = 0;
        this.vy = 0;
      } else {
        this.y = groundY;
      }
    }
    if (!this.grounded) {
      // Exact for constant gravity, so the arc is identical at any step size.
      this.y += this.vy * dt - 0.5 * GRAVITY * dt * dt;
      this.vy -= GRAVITY * dt;
      this.airTime += dt;
      if (this.y <= groundY && this.vy <= 0) {
        this.y = groundY;
        this.vy = 0;
        this.grounded = true;
        this.airTime = 0;
        this.jumpedThisAir = false;
        res.landed = true;
        if (this.slideQueued) {
          this.slideQueued = false;
          this.sliding = true;
          this.slideT = SLIDE_TIME;
          res.slideStarted = true;
        }
      }
    }

    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) {
        if (underOverhead) this.slideT = 0.02;
        else this.sliding = false;
      }
    }
    if (this.bumpT > 0) this.bumpT = Math.max(0, this.bumpT - dt);
    return res;
  }
}
