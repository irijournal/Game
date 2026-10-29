import * as THREE from 'three';
import { CHASER_LANE_X, CINEMATIC_FULL } from '../../sim/constants';
import type { Simulation } from '../../sim/simulation';
import type { CharacterId } from '../../sim/types';
import { buildCharacter, disposeRig } from './characterModels';
import type { CharacterRig } from './characterRig';
import type { Particles } from './effects';
import { basic, box, cone, disposeOwned, lambert, mesh, plane, toon } from './materials';
import { blobShadow, canvasTexture, sunburst } from './textures';
import { buildBulldozer, buildCycle, type Vehicle } from './vehicles';

export interface CamShot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

const CHASE_Z = 4.3;
const STAGE = new THREE.Vector3(CHASER_LANE_X + 0.4, 0, -5.5);
const STAGE_H = 1.1;

interface Debris {
  root: THREE.Group;
  s: number;
  pushed: number;
  vx: number;
  vy: number;
  spin: number;
}

/**
 * Stages the rival entrance, chase, exit and victory beats around the
 * runner. Purely visual: it reads the simulation and never affects
 * gameplay. The chaser always stays on the shoulder lane behind the runner.
 */
export class RivalDirector {
  readonly group = new THREE.Group();
  private rival: CharacterRig | null = null;
  private rivalId: CharacterId | null = null;
  private vehicle: Vehicle | null = null;
  private vehicleKind: 'bulldozer' | 'cycle' | null = null;
  private stage: THREE.Group;
  private burst: THREE.Mesh;
  private shadow: THREE.Mesh;
  private debris: Debris[] = [];
  private nextDebrisS = 0;
  private lastState = '';
  private exitT = 0;
  private confettiFired = false;
  private dustAcc = 0;
  private leapFrom = new THREE.Vector3();
  colors: number[] = [0xff8c1a, 0xffb347, 0xffffff];

  constructor() {
    this.stage = new THREE.Group();
    const cloth = canvasTexture('stageCloth', 128, 64, (c) => {
      c.fillStyle = '#ff8c1a';
      c.fillRect(0, 0, 128, 64);
      c.fillStyle = '#ffd23a';
      for (let x = 0; x < 128; x += 16) {
        c.beginPath();
        c.arc(x + 8, 6, 6, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.25)';
      for (let x = 0; x < 128; x += 8) c.fillRect(x, 14, 2, 50);
    });
    this.stage.add(mesh(box(2.6, STAGE_H, 2.6), lambert(0xffffff, { map: cloth }), 0, STAGE_H / 2, 0));
    this.stage.add(mesh(box(2.8, 0.08, 2.8), toon(0x8a5a2b), 0, STAGE_H + 0.04, 0));
    for (const x of [-1.2, 1.2]) this.stage.add(mesh(cone(0.18, 0.5, 10), toon(0xffd23a), x, STAGE_H + 0.33, 1.2));
    this.stage.visible = false;
    this.group.add(this.stage);

    this.burst = mesh(plane(6, 6), basic(0xffffff, { map: sunburst('#ff9a1a', '#ffd23a'), transparent: true, key: 'burst' }));
    (this.burst.material as THREE.MeshBasicMaterial).blending = THREE.AdditiveBlending;
    this.burst.visible = false;
    this.group.add(this.burst);

    this.shadow = mesh(plane(1, 1), basic(0xffffff, { map: blobShadow(), transparent: true, key: 'shadow' }), 0, 0.02, 0);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.visible = false;
    this.group.add(this.shadow);

    for (let i = 0; i < 6; i++) {
      const root = new THREE.Group();
      if (i % 3 === 0) {
        root.add(mesh(box(0.9, 0.7, 0.9), toon(0xa8742e)));
        root.add(mesh(box(0.92, 0.12, 0.92), toon(0x6b4a1e), 0, 0.2, 0));
      } else if (i % 3 === 1) {
        root.add(mesh(cone(0.25, 0.75, 10), toon(0xff6a00), 0, 0.37, 0));
      } else {
        for (let k = 0; k < 4; k++) root.add(mesh(box(0.4, 0.3, 0.35), toon(0x8d8d92), (k % 2) * 0.35 - 0.2, Math.floor(k / 2) * 0.3, (k % 3) * 0.1));
      }
      if (i === 0) {
        const tag = mesh(plane(0.85, 0.3), lambert(0xffffff, { map: canvasTexture('debrisTag', 256, 90, (c) => {
          c.fillStyle = '#fff';
          c.fillRect(0, 0, 256, 90);
          c.fillStyle = '#222';
          c.font = "900 30px 'Baloo 2', sans-serif";
          c.textAlign = 'center';
          c.fillText('ROAD DEBRIS', 128, 40);
          c.font = "700 22px 'Baloo 2', sans-serif";
          c.fillText('(unoccupied ✓)', 128, 72);
        }) }), 0, 0.2, 0.46);
        root.add(tag);
      }
      root.visible = false;
      this.group.add(root);
      this.debris.push({ root, s: -1, pushed: -1, vx: 0, vy: 0, spin: 0 });
    }
  }

  /** Prepare the rival for this run (character + matching vehicle). */
  configure(rivalId: CharacterId, kind: 'bulldozer' | 'cycle', outfit: string): void {
    if (this.rivalId !== rivalId) {
      if (this.rival) disposeRig(this.rival);
      this.rival = buildCharacter(rivalId, { outfit });
      this.rivalId = rivalId;
      this.group.add(this.rival.root);
    }
    if (this.vehicleKind !== kind) {
      if (this.vehicle) {
        this.vehicle.root.removeFromParent();
        disposeOwned(this.vehicle.root);
      }
      this.vehicle = kind === 'bulldozer' ? buildBulldozer() : buildCycle();
      this.vehicleKind = kind;
      this.group.add(this.vehicle.root);
    }
    this.colors = kind === 'bulldozer' ? [0xff8c1a, 0xffb347, 0xffffff, 0xffd23a] : [0xd8202a, 0x179c3c, 0xffffff];
    const burstMat = this.burst.material as THREE.MeshBasicMaterial;
    burstMat.map = kind === 'bulldozer' ? sunburst('#ff9a1a', '#ffd23a') : sunburst('#e8262c', '#1fae4c');
    this.reset();
  }

  reset(): void {
    this.lastState = '';
    this.hideAll();
    for (const d of this.debris) {
      d.s = -1;
      d.root.visible = false;
    }
    this.nextDebrisS = 0;
  }

  private hideAll(): void {
    if (this.rival) this.rival.root.visible = false;
    if (this.vehicle) this.vehicle.root.visible = false;
    this.stage.visible = false;
    this.burst.visible = false;
    this.shadow.visible = false;
  }

  get kind(): 'bulldozer' | 'cycle' | null {
    return this.vehicleKind;
  }

  private seatWorld(out: THREE.Vector3): THREE.Vector3 {
    const v = this.vehicle!;
    return out.copy(v.seat).applyMatrix4(v.root.matrixWorld);
  }

  /** Returns a camera shot while a scripted beat needs one. */
  update(dt: number, sim: Simulation, camera: THREE.Camera, fx: Particles, time: number): CamShot | null {
    const rival = this.rival;
    const veh = this.vehicle;
    if (!rival || !veh) return null;
    const st = sim.state;
    const t = sim.stateTime;
    const full = sim.cinematic.kind === 'full';
    let shot: CamShot | null = null;

    if (st !== this.lastState) {
      this.onEnter(st, sim);
      this.lastState = st;
    }

    const vRoot = veh.root;
    const isCycle = this.vehicleKind === 'cycle';
    const rideAnim = isCycle ? 'pedal' : 'ride';
    let vehSpeed = sim.speed;

    switch (st) {
      case 'CINEMATIC': {
        vRoot.visible = true;
        if (full) {
          // Stage rises with the rival on it.
          this.stage.visible = t < 3.3;
          const rise = easeOut(t / 0.7);
          const sink = smooth((t - 2.9) / 0.4);
          this.stage.position.set(STAGE.x, -2.4 * (1 - rise) - 2.4 * sink, STAGE.z);
          if (t > 0.5 && !this.confettiFired) {
            this.confettiFired = true;
            fx.confetti({ x: STAGE.x, y: STAGE_H + 1.4, z: STAGE.z }, this.colors, 50, false);
          }
          this.burst.visible = t < 2.6;
          const bs = smooth(t / 0.5) * (1 - smooth((t - 2.2) / 0.4));
          this.burst.scale.setScalar(Math.max(0.01, bs * 0.62));
          // Behind the rival as seen from the camera, so it frames rather than hides them.
          const away = new THREE.Vector3(STAGE.x, STAGE_H + 1.0, STAGE.z).sub(camera.position).setY(0).normalize();
          this.burst.position.set(STAGE.x + away.x * 1.6, STAGE_H + 1.05, STAGE.z + away.z * 1.6);
          this.burst.lookAt(camera.position);
          this.burst.rotateZ(time * 0.6);
          // Vehicle drives up the shoulder from behind.
          const k = easeOut((t - 1.5) / 1.3);
          vRoot.position.set(CHASER_LANE_X, 0, CHASE_Z + 30 * (1 - k));
          vehSpeed = t > 1.5 && t < 2.8 ? 18 : 2;
          if (t > 1.5 && t < 3) this.dust(dt, fx, vRoot.position, 0.03);
          vRoot.updateMatrixWorld(true);
          // Rival: entrance on the stage, then a comic leap onto the vehicle.
          rival.root.visible = true;
          if (t < 2.45) {
            rival.root.position.set(STAGE.x, this.stage.position.y + STAGE_H, STAGE.z);
            rival.root.rotation.y = Math.PI * 0.82;
            if (t > 0.15) rival.setAnim('entrance');
            this.leapFrom.copy(rival.root.position);
          } else if (t < 3.15) {
            const lk = smooth((t - 2.45) / 0.7);
            const to = this.seatWorld(new THREE.Vector3());
            rival.root.position.lerpVectors(this.leapFrom, to, lk);
            rival.root.position.y += Math.sin(lk * Math.PI) * 2.0;
            rival.root.rotation.y = Math.PI * 0.82 * (1 - lk);
            rival.setAnim('leap');
          } else this.seatRival(rideAnim);
          // Camera beats.
          if (t < 1.5) shot = { pos: new THREE.Vector3(-0.8, 2.7, -11.5), look: new THREE.Vector3(3.8, 1.9, -4.5) };
          else if (t < 3.25) shot = { pos: new THREE.Vector3(7.6, 3.4, -10.5), look: new THREE.Vector3(4.2, 1.5, 2.5) };
        } else {
          const k = easeOut(t / 1.0);
          vRoot.position.set(CHASER_LANE_X, 0, CHASE_Z + 26 * (1 - k));
          vehSpeed = t < 1 ? 20 : 4;
          vRoot.updateMatrixWorld(true);
          this.dust(dt, fx, vRoot.position, 0.03);
          this.seatRival(rideAnim);
        }
        break;
      }
      case 'CHASE': {
        vRoot.visible = true;
        vRoot.position.set(CHASER_LANE_X + Math.sin(time * 0.8) * 0.15, 0, CHASE_Z + Math.sin(time * 0.5) * 0.35);
        vRoot.updateMatrixWorld(true);
        this.seatRival(rideAnim);
        this.dust(dt, fx, vRoot.position, isCycle ? 0.09 : 0.05);
        this.updateDebris(dt, sim, fx);
        break;
      }
      case 'SUCCESS': {
        this.exitT += dt;
        const k = this.exitT;
        vRoot.position.z = CHASE_Z + k * k * 9 + k * 4;
        vRoot.position.x = CHASER_LANE_X + Math.max(0, k - 0.5) * 4;
        vRoot.rotation.y = -Math.min(0.7, Math.max(0, k - 0.4) * 0.8);
        vRoot.updateMatrixWorld(true);
        vehSpeed = Math.max(2, sim.speed * (1 - k));
        this.seatRival('victory');
        this.updateDebris(dt, sim, fx);
        if (vRoot.position.z > 40) this.hideAll();
        break;
      }
      case 'FAILURE': {
        if (sim.chaseResult === 'failed') {
          vRoot.visible = true;
          vRoot.updateMatrixWorld(true);
          this.seatRival('victory');
          vehSpeed = 0;
          // High and to the left: above every obstacle, with the chaser in frame.
          shot = { pos: new THREE.Vector3(sim.player.x - 3.8, 4.9, -3.6), look: new THREE.Vector3(sim.player.x + 1.8, 0.7, 1.8) };
        }
        break;
      }
      case 'GAME_OVER':
        if (sim.chaseResult === 'failed') {
          vehSpeed = 0;
          this.seatRival('victory');
        }
        break;
      default:
        break;
    }

    if (vRoot.visible) {
      veh.update(dt, vehSpeed, time);
      this.shadow.visible = true;
      this.shadow.position.set(vRoot.position.x, 0.02, vRoot.position.z);
      this.shadow.scale.set(isCycle ? 1.4 : 3.2, isCycle ? 3 : 5.5, 1);
    }
    if (rival.root.visible) rival.update(dt, vehSpeed);
    return shot;
  }

  private seatRival(anim: 'ride' | 'pedal' | 'victory'): void {
    const rival = this.rival!;
    rival.root.visible = true;
    const p = this.seatWorld(new THREE.Vector3());
    rival.root.position.copy(p);
    rival.root.rotation.y = this.vehicle!.root.rotation.y + (anim === 'victory' ? Math.PI * 0.7 : 0);
    if (anim === 'pedal') rival.root.position.y -= rival.hipsHeight;
    rival.setAnim(anim);
  }

  private onEnter(st: string, sim: Simulation): void {
    if (st === 'CINEMATIC') {
      this.confettiFired = false;
      this.exitT = 0;
      this.vehicle!.root.rotation.set(0, 0, 0);
      this.rival!.setAnim(sim.cinematic.kind === 'full' ? 'idle' : 'ride', true);
    }
    if (st === 'CHASE') {
      this.stage.visible = false;
      this.burst.visible = false;
      this.vehicle!.root.rotation.set(0, 0, 0);
      this.nextDebrisS = sim.d + 30;
    }
    if (st === 'SUCCESS') this.exitT = 0;
    if (st === 'RUNNING') this.hideAll();
    if (st === 'FAILURE' && sim.chaseResult !== 'failed') this.hideAll();
  }

  private dust(dt: number, fx: Particles, at: THREE.Vector3, rate: number): void {
    this.dustAcc += dt;
    while (this.dustAcc > rate) {
      this.dustAcc -= rate;
      fx.dust({ x: at.x + (Math.random() - 0.5) * 2, y: 0.3, z: at.z + 2.2 }, 1, this.vehicleKind === 'cycle' ? 0xd8cbb8 : 0xc9b79a);
    }
  }

  /** Unoccupied debris on the shoulder, pushed aside by the blade. */
  private updateDebris(dt: number, sim: Simulation, fx: Particles): void {
    if (this.vehicleKind !== 'bulldozer') return;
    if (sim.state === 'CHASE' && sim.d + 150 > this.nextDebrisS) {
      const free = this.debris.find((x) => x.s < 0);
      if (free) {
        free.s = this.nextDebrisS;
        free.pushed = -1;
        free.root.visible = true;
        free.root.rotation.set(0, Math.random() * 3, 0);
      }
      this.nextDebrisS += 28 + Math.random() * 20;
    }
    for (const db of this.debris) {
      if (db.s < 0) continue;
      const z = -(db.s - sim.d);
      if (db.pushed < 0) {
        db.root.position.set(CHASER_LANE_X, 0.35, z);
        if (z > CHASE_Z - 2.9) {
          db.pushed = 0;
          db.vx = 5 + Math.random() * 3;
          db.vy = 4;
          db.spin = 6;
          fx.dust({ x: CHASER_LANE_X, y: 0.5, z }, 6);
        }
      } else {
        db.pushed += dt;
        db.root.position.x += db.vx * dt;
        db.vy -= 14 * dt;
        db.root.position.y = Math.max(0.3, db.root.position.y + db.vy * dt);
        db.root.position.z = z;
        db.root.rotation.z += db.spin * dt;
        if (db.pushed > 1.5 || z > 30) {
          db.s = -1;
          db.root.visible = false;
        }
      }
    }
  }
}

/** Opening sequence (~10 s, skippable): aerial city → runner → title. */
export const INTRO_LENGTH = 9.6;

export function introShot(t: number): CamShot & { runner: 'idle' | 'turn' | 'run'; runnerYaw: number; speed: number } {
  if (t < 4.2) {
    const k = smooth(t / 4.2);
    return {
      pos: new THREE.Vector3(55 - 49 * k, 70 - 61 * k, 60 - 46 * k),
      look: new THREE.Vector3(0, 1.2 * k, -70 + 70 * k),
      runner: 'idle',
      runnerYaw: Math.PI,
      speed: 0,
    };
  }
  if (t < 7.0) {
    const k = smooth((t - 4.2) / 2.8);
    return {
      pos: new THREE.Vector3(-2.2 + 0.6 * k, 1.85, 4.3 - 0.6 * k),
      look: new THREE.Vector3(0, 1.45, 0),
      runner: 'idle',
      runnerYaw: Math.PI,
      speed: 0,
    };
  }
  if (t < 7.8) {
    const k = smooth((t - 7.0) / 0.8);
    return {
      pos: new THREE.Vector3(-1.6 * (1 - k), 1.85 + 2 * k, 3.7 + 3.5 * k),
      look: new THREE.Vector3(0, 1.4 - 0.1 * k, -8 * k),
      runner: 'turn',
      runnerYaw: Math.PI * (1 - k),
      speed: 4 * k,
    };
  }
  return { pos: new THREE.Vector3(0, 3.9, 7.2), look: new THREE.Vector3(0, 1.3, -8), runner: 'run', runnerYaw: 0, speed: 12 };
}

export { CINEMATIC_FULL };
