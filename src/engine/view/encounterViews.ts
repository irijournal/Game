import * as THREE from 'three';
import { quizById } from '../../content/quiz';
import { CHASER_LANE_X, LANE_X, ROAD_HALF_WIDTH } from '../../sim/constants';
import { DROP_KINDS } from '../../sim/obstacles';
import type { Simulation } from '../../sim/simulation';
import type { CharacterId, Encounter } from '../../sim/types';
import { buildCharacter, disposeRig } from './characterModels';
import type { CharacterRig } from './characterRig';
import type { Particles } from './effects';
import { basic, box, cyl, lambert, mergeStatic, mesh, plane, sphere, toon, torus } from './materials';
import { buildProp } from './scenery';
import { blobShadow, bunting, drawSign, sign } from './textures';
import { buildBulldozer, buildCycle, type Vehicle } from './vehicles';

const GATE_COLORS: [string, string][] = [
  ['#ff8c1a', '#ffffff'],
  ['#ffffff', '#c25400'],
  ['#1f8a4c', '#ffffff'],
];
const LETTERS = ['A', 'B', 'C'];
const RIVAL_X = -CHASER_LANE_X;
/** Metres before a level's finish where the Ribbon Race begins. */
export const RIBBON_RACE = 160;

/** Manifesto Mayhem: crates fall from DROP_FROM to the road at DROP_LAND (z, metres ahead). */
const DROP_FROM = -82;
const DROP_LAND = -44;
const DROP_HEIGHT = 9;

/** Height of a dropped crate above its landing spot (0 once landed). */
export function dropHeight(z: number): number {
  return Math.max(0, Math.min(1, (DROP_LAND - z) / (DROP_LAND - DROP_FROM))) * DROP_HEIGHT;
}

interface Gate {
  root: THREE.Group;
  boards: THREE.Mesh[];
  /** The gate's own board textures, repainted for each question. */
  boardTex: THREE.CanvasTexture[];
  quizId: string;
  enc: Encounter | null;
}

const BOARD_W = 512;
const BOARD_H = 384;

/**
 * Visuals for the scripted parts of a level: finish arch, Accountability
 * Gates, the rival runner (Development Race / Red Cap Challenge) and the
 * helper bulldozer of the power-up. Purely visual: reads the simulation,
 * never changes it.
 */
export class EncounterViews {
  readonly group = new THREE.Group();
  private finish: THREE.Group;
  private crowds: THREE.Group[] = [];
  private gates: Gate[] = [];
  private runner: CharacterRig | null = null;
  private runnerId: CharacterId | null = null;
  private runnerShadow: THREE.Mesh;
  private runnerZ = 20;
  private runnerX = RIVAL_X;
  private helper: Vehicle;
  private helperAmt = 0;
  private finishCelebrated = false;
  /** Inauguration ribbon across the finish: two halves that flutter apart when cut. */
  private ribbon: THREE.Group[] = [];
  private ribbonCut = 0;
  /** Giant scissors the rival brings to the Ribbon Race. */
  private scissors: THREE.Group;
  /** Manifesto Mayhem: the rival's cycle-copter, its pilot and landing markers. */
  private copter: THREE.Group;
  private copterBike: Vehicle;
  private rotor: THREE.Group;
  private pilot: CharacterRig | null = null;
  private pilotId: CharacterId | null = null;
  private markers: THREE.Mesh[] = [];
  private landed = new Set<number>();
  private copterX = 0;
  private copterExit = 0;
  /** Red Cap result beat: +1 overtaken (rival drops back), -1 rival pulls away. */
  private redCapExit = 0;

  constructor() {
    this.finish = this.buildFinish();
    this.finish.visible = false;
    this.group.add(this.finish);
    this.runnerShadow = mesh(plane(1, 1), basic(0xffffff, { map: blobShadow(), transparent: true, key: 'shadow' }), 0, 0.02, 0);
    this.runnerShadow.rotation.x = -Math.PI / 2;
    this.runnerShadow.visible = false;
    this.group.add(this.runnerShadow);
    this.scissors = this.buildScissors();
    this.copterBike = buildCycle();
    this.rotor = new THREE.Group();
    this.copter = this.buildCopter();
    for (let i = 0; i < 8; i++) {
      const m = mesh(new THREE.RingGeometry(0.55, 0.85, 20), basic(0xff3030, { transparent: true, opacity: 0.75, side: THREE.DoubleSide, key: 'dropMark' }), 0, 0.04, 0);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.markers.push(m);
    }
    this.helper = buildBulldozer();
    this.helper.root.visible = false;
    this.helper.root.scale.setScalar(0.85);
    this.group.add(this.helper.root);
  }

  private buildFinish(): THREE.Group {
    const g = new THREE.Group();
    const x = ROAD_HALF_WIDTH + 0.6;
    const pillar = (side: number, color: number) => {
      g.add(mesh(box(0.8, 6, 0.8), toon(color), side * x, 3, 0));
      g.add(mesh(box(1.1, 0.3, 1.1), toon(0xffd23a), side * x, 6.1, 0));
    };
    pillar(-1, 0xff8c1a);
    pillar(1, 0x1f8a4c);
    g.add(mesh(box(x * 2 + 0.8, 1.6, 0.4), toon(0xffffff), 0, 5.4, 0));
    const banner = mesh(plane(x * 2, 1.4), lambert(0xffffff, { map: sign('FINISH', { bg: '#ffffff', fg: '#c25400', border: '#ff8c1a', sub: 'Viksit UP route • UP RUN', subColor: '#1f8a4c', w: 1024, h: 180 }) }), 0, 5.4, 0.21);
    g.add(banner);
    g.add(mesh(plane(x * 2, 0.6), basic(0xffffff, { map: bunting(), transparent: true, side: THREE.DoubleSide, key: 'bunting' }), 0, 4.35, 0.1));
    // Chequered start/finish strip on the road.
    const strip = mesh(plane(ROAD_HALF_WIDTH * 2, 1.2), basic(0xffffff), 0, 0.02, 0);
    strip.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      for (let r = 0; r < 2; r++) {
        if ((i + r) % 2) continue;
        const sq = mesh(plane((ROAD_HALF_WIDTH * 2) / 12, 0.6), basic(0x111111), -ROAD_HALF_WIDTH + (i + 0.5) * ((ROAD_HALF_WIDTH * 2) / 12), 0.025, -0.3 + r * 0.6);
        sq.rotation.x = -Math.PI / 2;
        g.add(sq);
      }
    }
    g.add(strip);
    const merged = mergeStatic(g);
    // The ribbon stays separate so it can be cut.
    const ribbonMat = toon(0xd8202a, { side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * x, 1.3, 0);
      const half = mesh(box(x, 0.22, 0.03), ribbonMat, -side * (x / 2), 0, 0);
      pivot.add(half);
      merged.add(pivot);
      this.ribbon.push(pivot);
    }
    merged.add(mesh(sphere(0.28, 10, 8), toon(0xd8202a), 0, 1.3, 0.05));
    for (const [cx, cz, kind] of [
      [-8.8, 1.5, 'crowdTown'],
      [8.8, 1.5, 'crowdFarm'],
      [-8.8, -2.5, 'crowdTech'],
      [8.8, -2.5, 'crowdPilgrim'],
    ] as const) {
      const c = mergeStatic(buildProp(kind));
      c.position.set(cx, 0.2, cz);
      c.rotation.y = Math.atan2(-Math.sign(cx), 0.6);
      merged.add(c);
      this.crowds.push(c);
    }
    return merged;
  }

  private buildCopter(): THREE.Group {
    // A campaign cycle with a helicopter rotor: comic, not a party symbol.
    const g = new THREE.Group();
    g.add(this.copterBike.root);
    this.copterBike.root.scale.setScalar(0.6);
    const mast = mesh(cyl(0.05, 0.05, 1.4, 6), toon(0x555555), 0, 2.3, 0.1);
    g.add(mast);
    this.rotor.position.set(0, 3.0, 0.1);
    for (let i = 0; i < 2; i++) {
      const blade = mesh(box(4.2, 0.05, 0.3), toon(0x30343c), 0, 0, 0);
      blade.rotation.y = (i * Math.PI) / 2;
      this.rotor.add(blade);
    }
    g.add(this.rotor);
    const banner = mesh(plane(3.2, 0.7), lambert(0xffffff, { map: sign('MANIFESTO', { bg: '#d8202a', fg: '#ffffff', sub: 'fictional promises inside', subColor: '#fff3c4', w: 512, h: 112 }), side: THREE.DoubleSide }), 0, 0.2, 2.6);
    g.add(banner);
    g.add(mesh(box(1.4, 0.7, 0.9), toon(0xc9a06a), 0, 0.6, -0.9));
    g.scale.setScalar(1.7);
    g.visible = false;
    this.group.add(g);
    return g;
  }

  private buildScissors(): THREE.Group {
    const g = new THREE.Group();
    const steel = toon(0xd8dee6);
    for (const r of [-0.25, 0.25]) {
      const blade = mesh(box(0.06, 0.75, 0.03), steel, 0, -0.42, 0);
      blade.rotation.z = r;
      g.add(blade);
    }
    for (const x of [-0.12, 0.12]) g.add(mesh(torus(0.1, 0.03, Math.PI * 2, 6, 14), toon(0xd8202a), x, 0.02, 0));
    g.visible = false;
    return g;
  }

  private buildGate(): Gate {
    const root = new THREE.Group();
    const x = ROAD_HALF_WIDTH + 0.4;
    for (const s of [-1, 1]) root.add(mesh(cyl(0.14, 0.16, 6.2, 10), toon(0x6b6b74), s * x, 3.1, 0));
    root.add(mesh(box(x * 2 + 0.4, 0.28, 0.28), toon(0x6b6b74), 0, 6.1, 0));
    const boards: THREE.Mesh[] = [];
    const boardTex: THREE.CanvasTexture[] = [];
    for (let i = 0; i < 3; i++) {
      const [bg, fg] = GATE_COLORS[i];
      const canvas = document.createElement('canvas');
      canvas.width = BOARD_W;
      canvas.height = BOARD_H;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      boardTex.push(tex);
      const b = mesh(box(2.0, 1.5, 0.1), new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex }), LANE_X[i], 5.15, 0);
      root.add(b);
      boards.push(b);
      // Lane marker painted on the road so the choice is readable at speed.
      const mark = mesh(plane(1.9, 2.4), basic(0xffffff, { map: sign(LETTERS[i], { bg, fg, w: 256, h: 320 }), transparent: true, opacity: 0.85 }), LANE_X[i], 0.03, 2.5);
      mark.rotation.x = -Math.PI / 2;
      root.add(mark);
    }
    root.add(mesh(plane(x * 2, 0.5), basic(0xffffff, { map: sign('ACCOUNTABILITY GATE', { bg: '#1a1a1a', fg: '#ffd23a', w: 1024, h: 96 }) }), 0, 6.55, 0.15));
    root.visible = false;
    this.group.add(root);
    return { root, boards, boardTex, quizId: '', enc: null };
  }

  /** Paint a question's options onto a gate (the gate's textures are reused). */
  private paintGate(g: Gate, quizId: string): void {
    if (g.quizId === quizId) return;
    const q = quizById(quizId);
    g.boardTex.forEach((tex, i) => {
      const [bg, fg] = GATE_COLORS[i];
      const ctx = (tex.image as HTMLCanvasElement).getContext('2d')!;
      drawSign(ctx, BOARD_W, BOARD_H, LETTERS[i], { bg, fg, border: '#1a1a1a', sub: q ? q.options[i] : '', subColor: fg, w: BOARD_W, h: BOARD_H });
      tex.needsUpdate = true;
    });
    g.quizId = quizId;
  }

  /** The rival who races alongside (Development Race) or runs the Red Cap Challenge. */
  configure(rivalId: CharacterId, outfit: string): void {
    if (this.pilotId !== rivalId) {
      if (this.pilot) disposeRig(this.pilot);
      this.pilot = buildCharacter(rivalId, { outfit });
      this.pilotId = rivalId;
      this.pilot.root.scale.setScalar(0.6);
      this.pilot.root.position.copy(this.copterBike.seat).multiplyScalar(0.6);
      this.pilot.root.position.y -= 0.45;
      this.copter.add(this.pilot.root);
    }
    if (this.runnerId === rivalId) return;
    if (this.runner) disposeRig(this.runner);
    this.runner = buildCharacter(rivalId, { outfit });
    this.runnerId = rivalId;
    this.runner.root.visible = false;
    this.group.add(this.runner.root);
    this.scissors.removeFromParent();
    this.scissors.position.set(0, -0.38, -0.05);
    this.runner.joints.elR.add(this.scissors);
  }

  reset(): void {
    this.finish.visible = false;
    for (const g of this.gates) {
      g.root.visible = false;
      g.enc = null;
    }
    if (this.runner) this.runner.root.visible = false;
    this.runnerShadow.visible = false;
    this.runnerZ = 20;
    this.helperAmt = 0;
    this.helper.root.visible = false;
    this.finishCelebrated = false;
    this.redCapExit = 0;
    this.ribbonCut = 0;
    this.ribbon.forEach((p) => p.rotation.set(0, 0, 0));
    this.scissors.visible = false;
    this.copter.visible = false;
    this.copterExit = 0;
    this.landed.clear();
    this.markers.forEach((m) => (m.visible = false));
  }

  update(dt: number, sim: Simulation, time: number, fx: Particles): void {
    const d = sim.d;
    // Finish arch (campaign levels and races).
    const finishS = sim.cfg.level ? sim.cfg.level.length : sim.cfg.race ? sim.cfg.race.length - sim.raceBoost : -1;
    const fz = -(finishS - d);
    this.finish.visible = finishS > 0 && fz > -190 && fz < 30;
    if (this.finish.visible) {
      this.finish.position.z = fz;
      this.crowds.forEach((c, i) => (c.position.y = 0.2 + Math.abs(Math.sin(time * 6 + i)) * 0.22));
      // The runner cuts the ribbon by crossing it; the halves flutter down.
      if (fz > -0.3 && sim.cfg.level) this.ribbonCut = Math.min(1, this.ribbonCut + dt * 2.5);
      this.ribbon.forEach((p, i) => (p.rotation.z = (i ? 1 : -1) * this.ribbonCut * 1.25));
      if (!this.finishCelebrated && fz > -2 && sim.state === 'GAME_OVER') {
        this.finishCelebrated = true;
        fx.fireworks({ x: -4, y: 6, z: fz - 4 });
        fx.fireworks({ x: 4, y: 6, z: fz - 4 });
      }
    }

    // Accountability Gates.
    for (const e of sim.encounters) {
      if (e.kind !== 'quiz' || !e.quizId) continue;
      const z = -(e.s0 - d);
      if (z < -190 || z > 30) continue;
      let gate = this.gates.find((g) => g.enc === e);
      if (!gate) {
        // Gates are pooled; a free one is repainted for this question.
        gate = this.gates.find((g) => !g.enc && g.quizId === e.quizId) ?? this.gates.find((g) => !g.enc);
        if (!gate) {
          gate = this.buildGate();
          this.gates.push(gate);
        }
        this.paintGate(gate, e.quizId);
        gate.enc = e;
      }
      gate.root.visible = true;
      gate.root.position.z = z;
      gate.boards.forEach((b, i) => {
        const result = e.ended && i === e.chosen;
        b.scale.setScalar(result ? 1 + Math.abs(Math.sin(time * 8)) * 0.12 : 1);
        b.position.y = 5.15 + (result ? 0.15 : 0);
      });
    }
    for (const g of this.gates) {
      if (!g.enc) continue;
      if (!sim.encounters.includes(g.enc) || -(g.enc.s0 - d) > 30) {
        g.root.visible = false;
        g.enc = null;
      }
    }

    // Rival runner: Development Race (parallel lane) or Red Cap Challenge.
    const runner = this.runner;
    if (runner) {
      let want: { z: number; x: number } | null = null;
      if (sim.cfg.race) {
        want = { z: Math.max(-80, Math.min(16, -(sim.rivalD - (d + sim.raceBoost)))), x: RIVAL_X };
      } else {
        const rc = sim.encounters.find((e) => e.kind === 'redCap' && e.started && (!e.ended || d - e.s1 < 40));
        const lv = sim.cfg.level;
        const left = lv ? lv.length - d : Infinity;
        if (!rc && lv && left < RIBBON_RACE) {
          // Ribbon Race: the rival sprints for the ribbon with giant
          // scissors… and the runner overtakes just before the line.
          const k = Math.max(0, Math.min(1, 1 - left / RIBBON_RACE));
          // At the line it pulls up beside the winner, a step too late.
          want = sim.state === 'GAME_OVER' ? { z: -(lv.length - d) + 1.2, x: sim.player.x - 1.9 } : { z: -20 + k * 26, x: RIVAL_X };
        } else if (rc) {
          if (!rc.ended) {
            this.redCapExit = 0;
            want = { z: -11 + Math.sin(time * 0.7) * 3, x: RIVAL_X };
          } else {
            if (this.redCapExit === 0) this.redCapExit = rc.failed ? -1 : 1;
            want = { z: this.redCapExit > 0 ? 18 : -90, x: RIVAL_X };
          }
        }
      }
      if (want) {
        if (!runner.root.visible) {
          runner.root.visible = true;
          this.runnerZ = want.z > 0 ? want.z : Math.min(want.z, -40);
        }
        this.runnerZ += (want.z - this.runnerZ) * Math.min(1, dt * 1.6);
        this.runnerX += (want.x - this.runnerX) * Math.min(1, dt * 3);
        runner.root.position.set(this.runnerX, 0, this.runnerZ);
        runner.root.rotation.set(0, 0, 0);
        const ribbonRace = !!sim.cfg.level && !sim.encounters.some((e) => e.kind === 'redCap' && e.started && !e.ended) && sim.cfg.level.length - d < RIBBON_RACE;
        this.scissors.visible = ribbonRace;
        runner.setAnim(sim.state === 'GAME_OVER' ? (sim.summary?.race?.won === false ? 'victory' : ribbonRace && Math.abs(this.runnerZ - want.z) > 1 ? 'run' : 'idle') : 'run');
        runner.update(dt, sim.state === 'GAME_OVER' ? 0 : sim.speed);
        this.runnerShadow.visible = true;
        this.runnerShadow.position.set(this.runnerX, 0.02, this.runnerZ);
        if (this.runnerZ > 16 || this.runnerZ < -85) runner.root.visible = this.runnerShadow.visible = false;
      } else {
        runner.root.visible = false;
        this.runnerShadow.visible = false;
      }
    }

    if (sim.isMayhem) this.updateMayhem(dt, sim, time, fx);

    // Helper bulldozer: drives ahead of the runner pushing debris aside.
    const target = sim.bulldozerT > 0 ? 1 : 0;
    this.helperAmt += Math.max(-dt * 1.5, Math.min(dt * 1.5, target - this.helperAmt));
    const h = this.helper.root;
    h.visible = this.helperAmt > 0.01;
    if (h.visible) {
      const k = this.helperAmt;
      h.position.set(CHASER_LANE_X + (sim.player.x - CHASER_LANE_X) * k, 0, -9.5 - (1 - k) * 6);
      this.helper.update(dt, sim.speed, time);
      if (k > 0.5 && Math.random() < dt * 20) fx.dust({ x: h.position.x + (Math.random() - 0.5) * 2, y: 0.3, z: h.position.z - 2.6 }, 1);
    }
  }

  /** Cycle-copter hovering ahead, dropping fictional-promise crates. */
  private updateMayhem(dt: number, sim: Simulation, time: number, fx: Particles): void {
    const c = this.copter;
    c.visible = true;
    // Steer over the next crate that is still in the air.
    let target: number | null = null;
    let best = Infinity;
    let mi = 0;
    for (const ob of sim.obstacles) {
      if (!DROP_KINDS.has(ob.kind)) continue;
      const z = -(ob.s - sim.d);
      if (z < -110 || z > 30) continue;
      const h = dropHeight(z);
      if (h > 0) {
        const dist = Math.abs(z + 70);
        if (dist < best) {
          best = dist;
          target = LANE_X[ob.lane];
        }
        if (mi < this.markers.length) {
          const m = this.markers[mi++];
          m.visible = true;
          m.position.set(LANE_X[ob.lane], 0.04, z - ob.depth / 2);
          m.scale.setScalar(1.6 - (h / 9) * 0.8);
        }
      } else if (!this.landed.has(ob.id)) {
        this.landed.add(ob.id);
        if (z > -120) fx.dust({ x: LANE_X[ob.lane], y: 0.3, z }, 6, 0xd9cbb5);
      }
    }
    for (; mi < this.markers.length; mi++) this.markers[mi].visible = false;
    if (this.landed.size > 300) this.landed.clear();
    const done = sim.state === 'GAME_OVER';
    if (done) this.copterExit = Math.min(1, this.copterExit + dt * 0.4);
    const tx = target ?? Math.sin(time * 0.6) * 2.5;
    this.copterX += (tx - this.copterX) * Math.min(1, dt * 3);
    // Hovers right where the crates leave it (DROP_FROM), big enough to read.
    c.position.set(this.copterX, DROP_HEIGHT + 0.8 + Math.sin(time * 2.2) * 0.3 + this.copterExit * 14, DROP_FROM + 2 + this.copterExit * -40);
    c.rotation.set(Math.sin(time * 1.7) * 0.05, Math.PI, (this.copterX - tx) * -0.08);
    this.rotor.rotation.y += dt * (done ? 8 : 22);
    this.copterBike.update(dt, 6, time);
    if (this.pilot) {
      this.pilot.setAnim(done && sim.summary?.completed ? 'stumble' : 'talk');
      this.pilot.update(dt, 6);
    }
  }

  get helperX(): number {
    return this.helper.root.position.x;
  }
}
