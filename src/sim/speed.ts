import { BASE_SPEED, MAX_SPEED, SPEED_RAMP_DIST } from './constants';

/** Base running speed for a track position. Bounded: never exceeds MAX_SPEED. */
export function baseSpeedAt(s: number): number {
  const d = Math.max(0, s);
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * (1 - Math.exp(-d / SPEED_RAMP_DIST));
}

/** Campaign levels: faster for later levels, gently ramping within a level. */
export function levelSpeed(diff: number, progress: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + 6 * diff + 1.5 * Math.min(1, Math.max(0, progress)));
}

/** 0 at the start of a run, 1 at "hard" (4 km). */
export function difficultyAt(s: number): number {
  return Math.min(1, Math.max(0, s / 4000));
}
