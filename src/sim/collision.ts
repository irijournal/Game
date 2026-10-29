import { LANE_X, PLAYER_HALF_D, PLAYER_HALF_W } from './constants';
import type { Obstacle } from './types';

// Contact flags remembered between steps for each obstacle. Comparing the
// previous step's overlaps with the current ones tells us *how* the runner
// entered an obstacle: from the front (crash), from the side (bump), or from
// above (landing on a low obstacle).
export const F_X = 1;
export const F_Z = 2;
export const F_Y = 4;
export const F_IGNORE = 8;

export type Contact = 'none' | 'crash' | 'bump' | 'land';

export interface ContactResult {
  flags: number;
  contact: Contact;
}

export interface RunnerBox {
  x: number;
  y: number;
  h: number;
  /** Track position of the runner's centre. */
  d: number;
}

type ObstacleShape = Pick<Obstacle, 'cls' | 'lane' | 's' | 'depth' | 'bottom' | 'top' | 'halfW' | 'hit'>;

const GAP_HALF_W = 0.6;
const GAP_INSET = 0.25;

export function xOverlap(r: RunnerBox, ob: ObstacleShape): boolean {
  return Math.abs(r.x - LANE_X[ob.lane]) < PLAYER_HALF_W + ob.halfW;
}

export function zOverlap(r: RunnerBox, ob: ObstacleShape): boolean {
  return r.d + PLAYER_HALF_D > ob.s && r.d - PLAYER_HALF_D < ob.s + ob.depth;
}

export function yOverlap(r: RunnerBox, ob: ObstacleShape): boolean {
  switch (ob.cls) {
    case 'low':
      return r.y < ob.top - 0.02;
    case 'high':
      return r.y + r.h > ob.bottom + 0.02;
    case 'wall':
      return true;
    case 'gap':
      return r.y <= 0.02;
  }
}

/** Height of the surface this low obstacle offers the runner (0 if none). */
export function supportFrom(r: RunnerBox, ob: ObstacleShape): number {
  if (ob.cls !== 'low' || ob.hit) return 0;
  if (r.y < ob.top - 0.06) return 0;
  return xOverlap(r, ob) && zOverlap(r, ob) ? ob.top : 0;
}

/** True when a hanging obstacle is directly above the runner's column. */
export function isOverhead(r: RunnerBox, ob: ObstacleShape): boolean {
  return ob.cls === 'high' && !ob.hit && xOverlap(r, ob) && zOverlap(r, ob);
}

/**
 * Classify the contact between the runner and one obstacle for this step.
 * Pure: takes the previous flags and returns the new ones.
 */
export function contactFor(r: RunnerBox, ob: ObstacleShape, prevFlags: number): ContactResult {
  if (ob.hit) return { flags: 0, contact: 'none' };

  if (ob.cls === 'gap') {
    // Gaps only matter for the runner's centre: you fall in when your feet
    // are on the road over the hole, so edges are forgiving.
    const inX = Math.abs(r.x - LANE_X[ob.lane]) < GAP_HALF_W;
    const inZ = r.d > ob.s + GAP_INSET && r.d < ob.s + ob.depth - GAP_INSET;
    const grounded = r.y <= 0.02;
    return { flags: 0, contact: inX && inZ && grounded ? 'crash' : 'none' };
  }

  const xo = xOverlap(r, ob);
  const zo = zOverlap(r, ob);
  const yo = yOverlap(r, ob);
  let flags = (xo ? F_X : 0) | (zo ? F_Z : 0) | (yo ? F_Y : 0);
  const full = xo && zo && yo;

  if (!full) return { flags, contact: 'none' };
  if (prevFlags & F_IGNORE) return { flags: flags | F_IGNORE, contact: 'none' };

  let contact: Contact;
  if (!(prevFlags & F_Z)) contact = 'crash';
  else if (!(prevFlags & F_X)) contact = 'bump';
  else if (!(prevFlags & F_Y)) contact = ob.cls === 'low' ? 'land' : 'crash';
  else contact = 'crash';

  if (contact === 'bump' || contact === 'land') flags |= F_IGNORE;
  return { flags, contact };
}
