import * as THREE from 'three';
import { particleAtlas } from './textures';

export type Tile = 0 | 1 | 2 | 3; // puff, square, star, petal

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  r: number;
  g: number;
  b: number;
  a: number;
  tile: Tile;
  gravity: number;
  drag: number;
  scroll: boolean;
}

export interface EmitOpts {
  at: THREE.Vector3 | { x: number; y: number; z: number };
  count: number;
  colors: number[];
  tile: Tile;
  speed?: number;
  up?: number;
  spread?: number;
  life?: [number, number];
  size?: [number, number];
  grow?: number;
  gravity?: number;
  drag?: number;
  alpha?: number;
  scroll?: boolean;
  dir?: { x: number; y: number; z: number };
}

const VS = `
attribute float size;
attribute vec4 rgba;
attribute float tile;
uniform float scale;
varying vec4 vColor;
varying float vTile;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
  vColor = rgba;
  vTile = tile;
}`;
const FS = `
uniform sampler2D map;
varying vec4 vColor;
varying float vTile;
void main() {
  vec2 uv = vec2((gl_PointCoord.x + vTile) / 4.0, 1.0 - gl_PointCoord.y);
  vec4 t = texture2D(map, uv);
  gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.02) discard;
}`;

/** One draw call for every particle in the game; capacity is fixed. */
export class Particles {
  readonly points: THREE.Points;
  private list: P[] = [];
  private pool: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private siz: Float32Array;
  private til: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  max: number;
  budget = 1;

  constructor(max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.siz = new Float32Array(max);
    this.til = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('rgba', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('tile', new THREE.BufferAttribute(this.til, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: particleAtlas() }, scale: { value: 400 } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setScale(heightPx: number, fovDeg: number): void {
    this.mat.uniforms.scale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  get count(): number {
    return this.list.length;
  }

  emit(o: EmitOpts): void {
    const n = Math.round(o.count * this.budget);
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) return;
      const p = this.pool.pop() ?? ({} as P);
      const sp = o.speed ?? 2;
      const spread = o.spread ?? 1;
      p.x = o.at.x + (Math.random() - 0.5) * 0.3 * spread;
      p.y = o.at.y + (Math.random() - 0.5) * 0.3 * spread;
      p.z = o.at.z + (Math.random() - 0.5) * 0.3 * spread;
      const dir = o.dir;
      p.vx = (dir?.x ?? 0) * sp + (Math.random() - 0.5) * 2 * sp * spread;
      p.vy = (dir?.y ?? 0) * sp + (o.up ?? 0) + (Math.random() - 0.3) * sp * spread;
      p.vz = (dir?.z ?? 0) * sp + (Math.random() - 0.5) * 2 * sp * spread;
      const [l0, l1] = o.life ?? [0.6, 1.2];
      p.max = p.life = l0 + Math.random() * (l1 - l0);
      const [s0, s1] = o.size ?? [0.2, 0.4];
      p.size = s0 + Math.random() * (s1 - s0);
      p.grow = o.grow ?? 0;
      tmp.setHex(o.colors[Math.floor(Math.random() * o.colors.length)]);
      p.r = tmp.r;
      p.g = tmp.g;
      p.b = tmp.b;
      p.a = o.alpha ?? 1;
      p.tile = o.tile;
      p.gravity = o.gravity ?? 0;
      p.drag = o.drag ?? 0.5;
      p.scroll = o.scroll ?? true;
      this.list.push(p);
    }
  }

  /** @param scrollDz how far the world moved toward the camera this frame. */
  update(dt: number, scrollDz: number): void {
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k - p.gravity * dt;
      p.vz *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt + (p.scroll ? scrollDz : 0);
      p.size += p.grow * dt;
      list[w++] = p;
    }
    list.length = w;
    for (let i = 0; i < w; i++) {
      const p = list[i];
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      const fade = Math.min(1, (p.life / p.max) * 2.2);
      this.col[i * 4] = p.r;
      this.col[i * 4 + 1] = p.g;
      this.col[i * 4 + 2] = p.b;
      this.col[i * 4 + 3] = p.a * fade;
      this.siz[i] = p.size;
      this.til[i] = p.tile;
    }
    this.geo.setDrawRange(0, w);
    for (const name of ['position', 'rgba', 'size', 'tile']) (this.geo.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.pool.push(...this.list);
    this.list.length = 0;
    this.geo.setDrawRange(0, 0);
  }

  // ------------------------------------------------------------- presets

  dust(at: EmitOpts['at'], count = 6, color = 0xc9b79a): void {
    this.emit({ at, count, colors: [color, 0xe0d4c0], tile: 0, speed: 0.8, up: 0.8, life: [0.5, 1.0], size: [0.6, 1.0], grow: 1.6, alpha: 0.75, drag: 2 });
  }

  confetti(at: EmitOpts['at'], colors: number[], count = 40, scroll = true): void {
    this.emit({ at, count, colors, tile: 1, speed: 3.2, up: 4, life: [1.0, 1.8], size: [0.18, 0.3], gravity: 6, drag: 1.2, spread: 1.4, scroll });
  }

  sparkle(at: EmitOpts['at'], color = 0xffe066): void {
    this.emit({ at, count: 5, colors: [color, 0xffffff], tile: 2, speed: 1.6, life: [0.25, 0.45], size: [0.25, 0.4], drag: 3 });
  }

  poof(at: EmitOpts['at']): void {
    this.emit({ at, count: 10, colors: [0xffffff, 0xe8e2d8, 0xcfc6b8], tile: 0, speed: 1.6, up: 1.2, life: [0.5, 0.9], size: [0.9, 1.5], grow: 2, alpha: 0.9, drag: 2.5, spread: 2.5 });
    this.emit({ at, count: 10, colors: [0xffd23a, 0xff8c1a, 0x2d6cdf, 0x1f8a4c, 0xe8262c], tile: 1, speed: 3, up: 3, life: [0.6, 1.1], size: [0.15, 0.25], gravity: 7, spread: 1.5 });
  }

  paper(at: EmitOpts['at'], count = 3): void {
    this.emit({ at, count, colors: [0xffffff, 0xf3ecd6], tile: 1, speed: 1.2, up: 1.5, life: [0.9, 1.6], size: [0.18, 0.28], gravity: 0.8, drag: 1.5 });
  }

  trail(at: EmitOpts['at'], kind: string): void {
    const presets: Record<string, Partial<EmitOpts>> = {
      'trail.sparkle': { colors: [0xffe066, 0xffffff], tile: 2, size: [0.18, 0.3] },
      'trail.redgreen': { colors: [0xd8202a, 0x179c3c], tile: 1, size: [0.14, 0.22] },
      'trail.saffron': { colors: [0xff8c1a, 0xffb347], tile: 0, size: [0.35, 0.55], alpha: 0.7 },
      'trail.marigold': { colors: [0xffa41b, 0xff7300, 0xffd23a], tile: 3, size: [0.2, 0.3] },
    };
    const p = presets[kind];
    if (!p) return;
    this.emit({ at, count: 1, tile: 1, colors: [0xffffff], speed: 0.4, up: 0.6, life: [0.4, 0.7], gravity: 1, ...p });
  }

  fireworks(at: EmitOpts['at']): void {
    const colors = [[0xff6b6b, 0xffe066], [0x66d9ff, 0xffffff], [0x9dff7a, 0xffe066], [0xff9df5, 0xffffff]][Math.floor(Math.random() * 4)];
    this.emit({ at, count: 36, colors, tile: 2, speed: 7, life: [0.8, 1.3], size: [1.2, 1.8], gravity: 2, drag: 1.4, scroll: false, spread: 1 });
  }
}
