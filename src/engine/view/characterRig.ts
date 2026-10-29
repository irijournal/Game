import * as THREE from 'three';

export type AnimName =
  | 'idle'
  | 'run'
  | 'jump'
  | 'slide'
  | 'stumble'
  | 'victory'
  | 'sad'
  | 'entrance'
  | 'ride'
  | 'pedal'
  | 'fall'
  | 'leap';

export type Expression = 'neutral' | 'happy' | 'shock' | 'determined' | 'sad' | 'smug';

export const JOINTS = ['body', 'spine', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'kneeL', 'hipR', 'kneeR'] as const;
export type JointName = (typeof JOINTS)[number];
type V3 = [number, number, number];
type PoseObj = Partial<Record<JointName, V3>> & { y?: number };

const N = JOINTS.length * 3 + 1;
const Y_INDEX = N - 1;

export interface RigStyle {
  strideAmp: number;
  armAmp: number;
  bounce: number;
  slide: 'duck' | 'lean';
  jumpArms: 'up' | 'forward';
  idle: 'cap' | 'namaste' | 'wave';
  victory: 'arm' | 'blessing';
}

export type RunStyle = 'classic' | 'power' | 'strut';

export interface FaceParts {
  eyes: THREE.Object3D;
  browL: THREE.Object3D;
  browR: THREE.Object3D;
  smile: THREE.Object3D;
  frown: THREE.Object3D;
  open: THREE.Object3D;
}

const ANIM_EXPRESSION: Record<AnimName, Expression> = {
  idle: 'happy',
  run: 'determined',
  jump: 'happy',
  slide: 'determined',
  stumble: 'shock',
  victory: 'happy',
  sad: 'sad',
  entrance: 'smug',
  ride: 'smug',
  pedal: 'determined',
  fall: 'shock',
  leap: 'happy',
};

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * Shared procedural animation interface for every character. One canonical
 * model per character; all animations rotate the same joints, so the
 * character looks identical in every state. Transitions blend from a pose
 * snapshot over BLEND seconds, so switching animation never pops.
 */
export class CharacterRig {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly joints = {} as Record<JointName, THREE.Object3D>;
  readonly dizzy = new THREE.Group();
  face!: FaceParts;
  skirt: THREE.Object3D | null = null;
  hipsHeight = 0.82;
  style: RigStyle;
  runStyle: RunStyle = 'classic';

  anim: AnimName = 'idle';
  animT = 0;
  phase = 0;
  private blendT = 1;
  private readonly BLEND = 0.16;
  private snapshot = new Float32Array(N);
  private target = new Float32Array(N);
  private current = new Float32Array(N);
  private expression: Expression = 'happy';
  private blinkT = 2;
  private forcedExpression: Expression | null = null;

  constructor(style: RigStyle) {
    this.style = style;
    this.root.add(this.body);
    this.dizzy.visible = false;
  }

  setAnim(a: AnimName, restart = false): void {
    if (a === this.anim && !restart) return;
    this.snapshot.set(this.current);
    this.blendT = 0;
    this.anim = a;
    this.animT = 0;
  }

  setExpression(e: Expression | null): void {
    this.forcedExpression = e;
  }

  update(dt: number, speed = 13): void {
    this.animT += dt;
    if (this.anim === 'run' || this.anim === 'pedal') {
      const cyclesPerMetre = this.anim === 'pedal' ? 0.09 : 0.2;
      this.phase += dt * Math.max(6, speed) * cyclesPerMetre * Math.PI * 2;
    }
    this.computePose(this.target);
    if (this.blendT < this.BLEND) {
      this.blendT += dt;
      const w = smooth(this.blendT / this.BLEND);
      for (let i = 0; i < N; i++) this.current[i] = this.snapshot[i] + (this.target[i] - this.snapshot[i]) * w;
    } else this.current.set(this.target);
    this.apply();
    this.updateFace(dt);
    if (this.dizzy.visible || this.anim === 'stumble' || this.anim === 'fall') {
      this.dizzy.visible = this.anim === 'stumble' || this.anim === 'fall' || (this.anim === 'sad' && this.animT < 1.2);
      this.dizzy.rotation.y += dt * 6;
    }
  }

  private apply(): void {
    const c = this.current;
    for (let j = 0; j < JOINTS.length; j++) {
      const o = this.joints[JOINTS[j]];
      if (o) o.rotation.set(c[j * 3], c[j * 3 + 1], c[j * 3 + 2]);
    }
    this.body.position.y = c[Y_INDEX];
    if (this.skirt) {
      const hl = c[JOINTS.indexOf('hipL') * 3];
      const hr = c[JOINTS.indexOf('hipR') * 3];
      this.skirt.rotation.x = Math.max(-0.35, Math.min(0.6, (hl + hr) * 0.35));
      const spread = Math.abs(hl - hr);
      this.skirt.scale.set(1, 1, 1 + spread * 0.18);
    }
  }

  private updateFace(dt: number): void {
    const e = this.forcedExpression ?? ANIM_EXPRESSION[this.anim];
    if (e !== this.expression) this.expression = e;
    const f = this.face;
    if (!f) return;
    f.smile.visible = e === 'happy' || e === 'smug' || e === 'neutral' || e === 'determined';
    f.frown.visible = e === 'sad';
    f.open.visible = e === 'shock';
    f.smile.scale.set(e === 'happy' ? 1.25 : e === 'determined' ? 0.8 : 1, e === 'determined' ? 0.6 : 1, 1);
    let browY = 0;
    let browZ = 0;
    if (e === 'shock') {
      browY = 0.035;
      browZ = -0.15;
    } else if (e === 'determined' || e === 'smug') {
      browY = -0.005;
      browZ = 0.28;
    } else if (e === 'sad') {
      browY = 0.01;
      browZ = -0.35;
    } else if (e === 'happy') browY = 0.015;
    f.browL.position.y = f.browL.userData.baseY + browY;
    f.browR.position.y = f.browR.userData.baseY + browY;
    f.browL.rotation.z = -browZ;
    f.browR.rotation.z = browZ;
    // Blink.
    this.blinkT -= dt;
    let eyeScale = e === 'shock' ? 1.25 : e === 'smug' ? 0.7 : 1;
    if (this.blinkT < 0.12) eyeScale *= 0.12;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 2.5;
    f.eyes.scale.y = eyeScale;
  }

  // ------------------------------------------------------------- poses

  private computePose(out: Float32Array): void {
    out.fill(0);
    const p = this.pose();
    for (let j = 0; j < JOINTS.length; j++) {
      const v = p[JOINTS[j]];
      if (v) {
        out[j * 3] = v[0];
        out[j * 3 + 1] = v[1];
        out[j * 3 + 2] = v[2];
      }
    }
    out[Y_INDEX] = p.y ?? 0;
  }

  private namaste(o: PoseObj): void {
    o.shL = [0.55, 0.15, 0.62];
    o.elL = [1.75, 0, 0.35];
    o.shR = [0.55, -0.15, -0.62];
    o.elR = [1.75, 0, -0.35];
  }

  private pose(): PoseObj {
    const t = this.animT;
    const s = this.style;
    const o: PoseObj = {};
    switch (this.anim) {
      case 'run': {
        const ph = this.phase;
        const sn = Math.sin(ph);
        const cs = Math.cos(ph);
        const power = this.runStyle === 'power';
        const strut = this.runStyle === 'strut';
        const A = s.strideAmp * (power ? 1.08 : 1);
        const arm = s.armAmp * (power ? 1.45 : strut ? 0.6 : 1);
        o.hipL = [sn * A, 0, 0];
        o.hipR = [-sn * A, 0, 0];
        o.kneeL = [-(0.3 + 1.05 * Math.max(0, cs)), 0, 0];
        o.kneeR = [-(0.3 + 1.05 * Math.max(0, -cs)), 0, 0];
        o.shL = [-sn * arm, 0, -0.14 - (strut ? 0.25 : 0)];
        o.shR = [sn * arm, 0, 0.14 + (strut ? 0.25 : 0)];
        o.elL = [power ? 1.7 : 1.25, 0, 0];
        o.elR = [power ? 1.7 : 1.25, 0, 0];
        o.spine = [-0.18, sn * 0.12, strut ? sn * 0.12 : 0];
        o.head = [0.14, -sn * 0.08, strut ? -sn * 0.1 : 0];
        o.y = Math.abs(cs) * s.bounce * (power ? 1.4 : 1) - 0.02;
        break;
      }
      case 'jump': {
        const k = smooth(t / 0.14);
        o.hipL = [0.95 * k, 0, 0];
        o.kneeL = [-1.35 * k, 0, 0];
        o.hipR = [0.25 * k, 0, 0];
        o.kneeR = [-0.7 * k, 0, 0];
        if (s.jumpArms === 'up') {
          o.shL = [2.75 * k, 0, -0.35];
          o.shR = [2.75 * k, 0, 0.35];
          o.elL = [0.25, 0, 0];
          o.elR = [0.25, 0, 0];
        } else {
          o.shL = [1.3 * k, 0, -0.35];
          o.shR = [1.3 * k, 0, 0.35];
          o.elL = [1.4, 0, 0];
          o.elR = [1.4, 0, 0];
        }
        o.spine = [-0.08, 0, 0];
        o.head = [0.12, 0, 0];
        break;
      }
      case 'slide': {
        if (s.slide === 'duck') {
          o.y = -0.5;
          o.spine = [-1.05, 0, 0];
          o.head = [0.8, 0, 0];
          o.hipL = [1.55, 0, -0.1];
          o.kneeL = [-2.1, 0, 0];
          o.hipR = [1.2, 0, 0.1];
          o.kneeR = [-1.95, 0, 0];
          o.shR = [2.95, 0, 0.45];
          o.elR = [1.5, 0, 0];
          o.shL = [0.7, 0, -0.5];
          o.elL = [0.9, 0, 0];
        } else {
          o.y = -0.52;
          o.spine = [0.95, 0, 0];
          o.head = [-0.55, 0, 0];
          o.hipL = [1.45, 0, -0.05];
          o.kneeL = [-0.15, 0, 0];
          o.hipR = [1.15, 0, 0.05];
          o.kneeR = [-0.95, 0, 0];
          o.shL = [-0.5, 0, -0.95];
          o.shR = [-0.5, 0, 0.95];
          o.elL = [0.3, 0, 0];
          o.elR = [0.3, 0, 0];
        }
        break;
      }
      case 'stumble':
      case 'fall': {
        const w = t * 16;
        o.shL = [1.2 + Math.sin(w) * 1.4, 0, -1.05];
        o.shR = [1.0 + Math.cos(w * 1.1) * 1.4, 0, 1.05];
        o.elL = [0.5, 0, 0];
        o.elR = [0.5, 0, 0];
        o.spine = [0.35 + Math.sin(t * 9) * 0.12, 0, Math.sin(t * 7) * 0.15];
        o.hipL = [0.95, 0, -0.1];
        o.kneeL = [-0.5, 0, 0];
        o.hipR = [-0.25, 0, 0.1];
        o.kneeR = [-0.45, 0, 0];
        o.head = [0.2, 0, Math.sin(t * 11) * 0.3];
        o.y = this.anim === 'fall' ? -0.1 : 0.04 + Math.abs(Math.sin(t * 8)) * 0.1;
        break;
      }
      case 'sad': {
        const k = smooth(t / 0.45);
        o.y = -0.66 * k;
        o.hipL = [1.5 * k, 0, -0.18];
        o.hipR = [1.5 * k, 0, 0.18];
        o.kneeL = [-0.35 * k, 0, 0];
        o.kneeR = [-0.35 * k, 0, 0];
        o.spine = [(-0.4 + Math.sin(t * 1.6) * 0.05) * k, 0, 0];
        o.head = [-0.4 * k, Math.sin(t * 0.9) * 0.15, 0];
        o.shL = [0.95 * k, 0, -0.25];
        o.shR = [0.95 * k, 0, 0.25];
        o.elL = [0.35, 0, 0];
        o.elR = [0.35, 0, 0];
        break;
      }
      case 'victory': {
        o.y = Math.abs(Math.sin(t * 7)) * 0.1;
        if (s.victory === 'blessing') {
          if (t < 0.7) this.namaste(o);
          else {
            o.shR = [2.6, -0.3, 0.55];
            o.elR = [0.45, 0, 0];
            o.shL = [0.45, 0.1, 0.55];
            o.elL = [1.85, 0, 0.3];
          }
          o.head = [0.22, 0, 0];
          o.spine = [0.08, 0, 0];
        } else {
          o.shR = [2.95, 0, 0.25];
          o.elR = [0.15, 0, 0];
          o.shL = [-0.3, 0, -0.6];
          o.elL = [1.9, 0, 0];
          o.spine = [0.1, 0, 0];
          o.head = [0.2, 0, 0];
        }
        break;
      }
      case 'entrance': {
        const k = smooth(t / 0.6);
        o.y = -0.5 * (1 - k);
        o.hipL = [0.9 * (1 - k), 0, -0.08];
        o.hipR = [0.9 * (1 - k), 0, 0.08];
        o.kneeL = [-1.6 * (1 - k), 0, 0];
        o.kneeR = [-1.6 * (1 - k), 0, 0];
        if (t < 0.95) {
          o.shL = [1.0 * k, 0, -1.35 * k];
          o.shR = [1.0 * k, 0, 1.35 * k];
          o.elL = [0.2, 0, 0];
          o.elR = [0.2, 0, 0];
        } else this.namaste(o);
        o.head = [0.22 * k, 0, 0];
        o.spine = [0.08 * k, 0, 0];
        break;
      }
      case 'ride': {
        o.hipL = [0, 0, -0.14];
        o.hipR = [0, 0, 0.14];
        o.kneeL = [-0.12, 0, 0];
        o.kneeR = [-0.12, 0, 0];
        const wave = Math.sin(t * 7);
        o.shR = [2.55 + wave * 0.18, 0, 0.5 + wave * 0.1];
        o.elR = [0.45, 0, 0];
        o.shL = [0.35, 0.1, 0.45];
        o.elL = [1.7, 0, 0.3];
        o.spine = [0.06, Math.sin(t * 0.9) * 0.18, 0];
        o.head = [0.12, Math.sin(t * 0.7) * 0.25, 0];
        o.y = Math.sin(t * 9) * 0.015;
        break;
      }
      case 'pedal': {
        const ph = this.phase;
        o.hipL = [1.25 + Math.sin(ph) * 0.45, 0, -0.05];
        o.hipR = [1.25 - Math.sin(ph) * 0.45, 0, 0.05];
        o.kneeL = [-(1.55 - Math.sin(ph) * 0.45), 0, 0];
        o.kneeR = [-(1.55 + Math.sin(ph) * 0.45), 0, 0];
        o.spine = [-0.4, 0, 0];
        o.head = [0.4, 0, 0];
        o.shL = [1.25, 0, -0.2];
        o.shR = [1.25, 0, 0.2];
        o.elL = [0.3, 0, 0];
        o.elR = [0.3, 0, 0];
        if (Math.sin(t * 1.3) > 0.7) {
          o.shR = [2.8, 0, 0.4];
          o.elR = [0.2, 0, 0];
        }
        break;
      }
      case 'leap': {
        o.hipL = [0.9, 0, -0.2];
        o.hipR = [0.3, 0, 0.2];
        o.kneeL = [-1.2, 0, 0];
        o.kneeR = [-0.8, 0, 0];
        o.shL = [2.4, 0, -0.6];
        o.shR = [2.4, 0, 0.6];
        o.spine = [0.25, 0, 0];
        o.head = [0.2, 0, 0];
        break;
      }
      case 'idle':
      default: {
        o.spine = [Math.sin(t * 2.2) * 0.025, 0, 0];
        o.shL = [0.05, 0, -0.12];
        o.shR = [0.05, 0, 0.12];
        o.elL = [0.25, 0, 0];
        o.elR = [0.25, 0, 0];
        o.head = [0, Math.sin(t * 0.6) * 0.45, 0];
        if (s.idle === 'namaste') {
          this.namaste(o);
          o.head = [0.06, Math.sin(t * 0.5) * 0.25, 0];
        } else if (s.idle === 'wave') {
          o.shR = [2.6 + Math.sin(t * 7) * 0.2, 0, 0.45];
          o.elR = [0.4, 0, 0];
        } else {
          const c = t % 5;
          if (c > 3.0 && c < 4.3) {
            const k = smooth((c - 3.0) / 0.3) * (1 - smooth((c - 4.0) / 0.3));
            o.shR = [0.05 + 2.75 * k, 0, 0.12 + 0.45 * k];
            o.elR = [0.25 + 1.45 * k, 0, 0];
            o.head = [-0.05 * k, 0, 0.08 * k];
          }
        }
        break;
      }
    }
    return o;
  }
}
