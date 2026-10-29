import { describe, expect, it } from 'vitest';
import { JUMP_AIRTIME, JUMP_PEAK, LANE_X, PLAYER_SLIDE_H, PLAYER_STAND_H, SIM_DT, SLIDE_TIME } from '../constants';
import { Player } from '../player';

function run(p: Player, seconds: number, ground = 0, under = false) {
  for (let t = 0; t < seconds; t += SIM_DT) p.step(SIM_DT, ground, under);
}

describe('Player lanes', () => {
  it('moves between lane centres and never gets stuck between lanes', () => {
    const p = new Player();
    p.reset(1);
    p.moveLeft();
    run(p, 0.05);
    expect(p.x).toBeGreaterThan(LANE_X[0]);
    expect(p.x).toBeLessThan(LANE_X[1]);
    run(p, 0.3);
    expect(p.x).toBeCloseTo(LANE_X[0], 5);
  });

  it('clamps at the edges and survives input spam', () => {
    const p = new Player();
    p.reset(1);
    for (let i = 0; i < 20; i++) {
      i % 3 === 0 ? p.moveRight() : p.moveLeft();
      run(p, 0.01);
    }
    expect([0, 1, 2]).toContain(p.lane);
    run(p, 0.5);
    expect(p.x).toBeCloseTo(LANE_X[p.lane], 5);
    expect(p.moveLeft()).toBe(p.lane !== 0 ? true : false);
  });

  it('bounces back to the previous lane after a side bump', () => {
    const p = new Player();
    p.reset(1);
    p.moveRight();
    run(p, 0.05);
    p.bounceBack();
    expect(p.lane).toBe(1);
    run(p, 0.4);
    expect(p.x).toBeCloseTo(LANE_X[1], 5);
  });
});

describe('Player jump and slide', () => {
  it('jumps with the designed peak and airtime', () => {
    const p = new Player();
    expect(p.jump()).toBe(true);
    let peak = 0;
    let t = 0;
    while (!p.grounded || t === 0) {
      p.step(SIM_DT, 0, false);
      peak = Math.max(peak, p.y);
      t += SIM_DT;
      if (t > 2) break;
    }
    expect(peak).toBeGreaterThan(JUMP_PEAK - 0.05);
    expect(peak).toBeLessThan(JUMP_PEAK + 0.05);
    expect(t).toBeGreaterThan(JUMP_AIRTIME - 0.03);
    expect(t).toBeLessThan(JUMP_AIRTIME + 0.03);
  });

  it('cannot double jump', () => {
    const p = new Player();
    p.jump();
    run(p, 0.2);
    expect(p.jump()).toBe(false);
  });

  it('shrinks the collision height while sliding and restores it', () => {
    const p = new Player();
    p.slide();
    expect(p.height).toBe(PLAYER_SLIDE_H);
    run(p, SLIDE_TIME + 0.05);
    expect(p.height).toBe(PLAYER_STAND_H);
  });

  it('keeps sliding while under an overhead obstacle', () => {
    const p = new Player();
    p.slide();
    run(p, SLIDE_TIME + 0.4, 0, true);
    expect(p.sliding).toBe(true);
    run(p, 0.05, 0, false);
    expect(p.sliding).toBe(false);
  });

  it('fast-falls and slides when slide is pressed in the air', () => {
    const p = new Player();
    p.jump();
    run(p, 0.1);
    p.slide();
    let t = 0;
    while (!p.grounded && t < 1) {
      p.step(SIM_DT, 0, false);
      t += SIM_DT;
    }
    expect(t).toBeLessThan(0.2);
    expect(p.sliding).toBe(true);
  });
});
