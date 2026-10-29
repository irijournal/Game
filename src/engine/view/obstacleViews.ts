import * as THREE from 'three';
import { OBSTACLES } from '../../sim/obstacles';
import type { ObstacleKind } from '../../sim/types';
import { ROAD_HALF_WIDTH } from '../../sim/constants';
import { box, cone, cyl, lambert, mergeStatic, mesh, plane, toon, basic } from './materials';
import { blobShadow, bunting, sign, stripes } from './textures';
import { buildBus, buildMediaVan, buildTruck } from './vehicles';

export interface ObstacleView {
  root: THREE.Group;
  kind: ObstacleKind;
  /** Optional per-frame animation (blinking lamps, camera flashes...). */
  tick?: (t: number, rel: number) => void;
}

const BANNERS = [
  ['MEGA RALLY TODAY!', '#ff8c1a', '#ffffff'],
  ['PROMISES AHEAD!', '#1f8a4c', '#ffffff'],
  ['ROAD SHOW →', '#2d6cdf', '#ffffff'],
  ['JANATA KI JAI!', '#e8262c', '#fff3c4'],
  ['VIKAS LOADING… 99%', '#ffd23a', '#1a1a1a'],
] as const;


function shadowUnder(w: number, d: number): THREE.Mesh {
  const m = mesh(plane(1, 1), basic(0xffffff, { map: blobShadow(), transparent: true, key: 'shadow' }), 0, 0.015, 0);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  return m;
}

function gundarajText(small: boolean): THREE.Texture {
  return sign('GUNDARAJ? WATCH YOUR STEP!', {
    bg: '#ffd400',
    fg: '#111111',
    border: '#111111',
    sub: small ? 'satire • fictional sign' : 'A FICTIONAL SATIRICAL SIGN',
    w: 512,
    h: small ? 300 : 512,
    stripe: !small,
  });
}

function fileBox(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, d), toon(0xe8c77a)));
  g.add(mesh(box(w * 0.98, h * 0.2, d * 1.01), toon(0xffffff), 0, h * 0.3, 0));
  g.add(mesh(box(0.06, h * 1.02, d * 1.02), toon(0xc81e1e), 0, 0, 0));
  return g;
}

function build(kind: ObstacleKind, variant: number): ObstacleView {
  const def = OBSTACLES[kind];
  const root = new THREE.Group();
  const view: ObstacleView = { root, kind };
  // Built as many primitives, then merged per material (see mergeStatic).
  // Meshes are built with their near (runner-facing) face at local z = 0 and
  // extending towards -z, matching the collision volume [s, s + depth].
  const zc = -def.depth / 2;
  switch (kind) {
    case 'barricade': {
      const plank = lambert(0xffffff, { map: stripes('yb', '#ffd400', '#111') });
      root.add(mesh(box(1.85, 0.32, 0.1), plank, 0, 0.82, zc));
      root.add(mesh(box(1.85, 0.22, 0.1), plank, 0, 0.42, zc));
      for (const x of [-0.8, 0.8]) {
        for (const dz of [-0.18, 0.18]) {
          const leg = mesh(box(0.08, 1.0, 0.08), toon(0x666666), x, 0.5, zc + dz);
          leg.rotation.x = dz > 0 ? -0.2 : 0.2;
          root.add(leg);
        }
      }
      root.add(shadowUnder(2.2, 0.9));
      break;
    }
    case 'cones': {
      for (const x of [-0.7, 0, 0.7]) {
        root.add(mesh(cone(0.2, 0.72, 12), toon(0xff6a00), x, 0.38, zc));
        root.add(mesh(cyl(0.12, 0.15, 0.1, 12), toon(0xffffff), x, 0.45, zc));
        root.add(mesh(box(0.42, 0.04, 0.42), toon(0x222222), x, 0.02, zc));
      }
      root.add(mesh(box(1.8, 0.1, 0.1), lambert(0xffffff, { map: stripes('rw', '#e8262c', '#ffffff') }), 0, 0.78, zc));
      root.add(shadowUnder(2.2, 0.9));
      break;
    }
    case 'fileStack': {
      for (let i = 0; i < 5; i++) {
        const f = fileBox(0.78, 0.17, 0.62);
        f.position.set(Math.sin(i * 2.3) * 0.06, 0.09 + i * 0.18, zc);
        f.rotation.y = Math.sin(i * 1.7) * 0.25;
        root.add(f);
      }
      const tag = mesh(plane(0.6, 0.18), lambert(0xffffff, { map: sign('URGENT', { bg: '#fff', fg: '#c81e1e', w: 256, h: 80 }) }), 0, 0.55, 0.32 + zc);
      root.add(tag);
      for (let i = 0; i < 3; i++) {
        const f = fileBox(0.5, 0.15, 0.4);
        f.position.set(i - 1, 0.075, zc + 0.05);
        f.rotation.y = i * 0.8;
        if (i !== 1) root.add(f);
      }
      root.add(shadowUnder(2.0, 1.2));
      break;
    }
    case 'aframeSign': {
      const board = lambert(0xffffff, { map: gundarajText(true) });
      for (const s of [-1, 1]) {
        const b = mesh(box(1.6, 1.0, 0.05), board, 0, 0.5, zc + s * 0.2);
        b.rotation.x = s * 0.33;
        if (s < 0) b.rotation.y = Math.PI;
        root.add(b);
      }
      root.add(shadowUnder(2.0, 1.1));
      break;
    }
    case 'pothole': {
      const hole = mesh(plane(1.5, def.depth), basic(0x111114), 0, 0.012, zc);
      hole.rotation.x = -Math.PI / 2;
      hole.scale.set(1, 1, 1);
      root.add(hole);
      const rim = mesh(plane(1.9, def.depth + 0.5), lambert(0x2c2c30), 0, 0.008, zc);
      rim.rotation.x = -Math.PI / 2;
      root.add(rim);
      for (const x of [-0.95, 0.95]) {
        root.add(mesh(cone(0.14, 0.45, 10), toon(0xff6a00), x, 0.23, 0.15));
      }
      const warn = lambert(0xffffff, { map: stripes('ob', '#ff8c00', '#111') });
      const edge = mesh(box(1.7, 0.05, 0.14), warn, 0, 0.03, 0.08);
      root.add(edge);
      break;
    }
    case 'roadGap':
    case 'wideGap': {
      const w = 2.05;
      const hole = mesh(plane(w, def.depth), basic(0x0b0b0d), 0, 0.013, zc);
      hole.rotation.x = -Math.PI / 2;
      root.add(hole);
      // Inner walls give the hole depth when seen from the camera.
      const wall = mesh(box(w, 0.6, 0.05), toon(0x5a4632), 0, -0.29, -def.depth + 0.03);
      root.add(wall);
      const warn = lambert(0xffffff, { map: stripes('ob', '#ff8c00', '#111') });
      for (const z of [0.07, -def.depth - 0.07]) root.add(mesh(box(w + 0.1, 0.06, 0.16), warn, 0, 0.03, z));
      for (let i = 0; i < 5; i++) {
        const chunk = mesh(box(0.25, 0.12, 0.2), toon(0x55555c), -1.1 + (i % 2) * 2.2, 0.06, -i * (def.depth / 4));
        chunk.rotation.y = i;
        root.add(chunk);
      }
      root.add(mesh(cone(0.16, 0.5, 10), toon(0xff6a00), -1.0, 0.25, 0.35));
      root.add(mesh(cone(0.16, 0.5, 10), toon(0xff6a00), 1.0, 0.25, 0.35));
      break;
    }
    case 'bannerArch':
    case 'boomBarrier':
    case 'scaffold': {
      // Per-lane hanging element; the gantry above is a separate view.
      if (kind === 'bannerArch') {
        const [text, bg, fg] = BANNERS[variant % BANNERS.length];
        const m = lambert(0xffffff, { map: sign(text, { bg, fg, border: '#ffffff', w: 512, h: 300, sub: 'fictional campaign banner', subColor: fg }), side: THREE.DoubleSide });
        root.add(mesh(box(1.9, 1.15, 0.06), m, 0, 1.27 + 0.575, zc));
        root.add(mesh(cyl(0.035, 0.035, 2.0), toon(0x8a5a2b), 0, 2.44, zc)).rotation.z = Math.PI / 2;
        for (const x of [-0.85, 0.85]) root.add(mesh(cyl(0.012, 0.012, 1.4), toon(0x333333), x, 3.1, zc));
      } else if (kind === 'boomBarrier') {
        const pole = mesh(cyl(0.1, 0.1, 2.0, 12), lambert(0xffffff, { map: stripes('rw', '#e8262c', '#ffffff') }), 0, 1.45, zc);
        pole.rotation.z = Math.PI / 2;
        root.add(pole);
        root.add(mesh(box(0.9, 0.42, 0.05), lambert(0xffffff, { map: sign('CHECKPOINT', { bg: '#e8262c', fg: '#fff', w: 256, h: 120 }) }), 0, 1.9, zc));
        for (const x of [-0.4, 0.4]) root.add(mesh(cyl(0.012, 0.012, 1.4), toon(0x333333), x, 2.8, zc));
      } else {
        const beam = lambert(0xffffff, { map: stripes('ow', '#ff8c00', '#ffffff') });
        root.add(mesh(box(2.0, 0.3, 0.5), beam, 0, 1.42, zc));
        root.add(mesh(box(2.0, 0.08, 0.6), toon(0x9a6b3a), 0, 1.6, zc));
        root.add(mesh(box(1.0, 0.4, 0.05), lambert(0xffffff, { map: sign('MEN AT WORK', { bg: '#ffd400', fg: '#111', w: 256, h: 110 }) }), 0, 2.0, zc + 0.2));
        for (const x of [-0.9, 0.9]) root.add(mesh(cyl(0.02, 0.02, 1.9), toon(0x777777), x, 2.6, zc));
      }
      root.add(shadowUnder(2.0, 0.8));
      break;
    }
    case 'gundarajBoard': {
      root.add(mesh(box(1.9, 0.95, 0.6), toon(0x9a9aa2), 0, 0.475, zc));
      root.add(mesh(box(1.92, 0.1, 0.62), lambert(0xffffff, { map: stripes('yb', '#ffd400', '#111') }), 0, 0.9, zc));
      const board = lambert(0xffffff, { map: gundarajText(false) });
      root.add(mesh(box(1.9, 1.95, 0.12), board, 0, 1.95, zc));
      const lamp = mesh(cyl(0.12, 0.12, 0.16, 10), new THREE.MeshToonMaterial({ color: 0xffaa00, emissive: 0xff7700 }), 0.6, 3.0, zc);
      lamp.userData.keep = true;
      lamp.name = 'lamp';
      root.add(lamp);
      root.add(shadowUnder(2.4, 1.2));
      break;
    }
    case 'constructionWall': {
      const panel = lambert(0xffffff, { map: sign('DEVELOPMENT ZONE', { bg: '#1f5fbf', fg: '#ffffff', sub: 'WORK IN PROGRESS SINCE FOREVER', subColor: '#ffd400', w: 512, h: 512, stripe: true }) });
      root.add(mesh(box(1.96, 2.6, 0.3), panel, 0, 1.3, zc));
      root.add(mesh(cone(0.2, 0.7, 12), toon(0xff6a00), 0.7, 0.35, 0.3));
      root.add(shadowUnder(2.4, 1.0));
      break;
    }
    case 'fileMountain': {
      let y = 0.1;
      const layers = [5, 4, 4, 3, 3, 2, 2, 1, 1];
      layers.forEach((n, li) => {
        for (let i = 0; i < n; i++) {
          const f = fileBox(0.7, 0.3, 1.1);
          f.position.set((i - (n - 1) / 2) * 0.34, y + 0.15, zc + Math.sin(li + i) * 0.08);
          f.rotation.y = Math.sin(li * 3 + i) * 0.3;
          f.rotation.z = Math.sin(li + i * 2) * 0.08;
          root.add(f);
        }
        y += 0.3;
      });
      const tag = mesh(plane(1.2, 0.36), lambert(0xffffff, { map: sign('PENDING SINCE 1987', { bg: '#fffbe6', fg: '#c81e1e', w: 512, h: 150 }) }), 0, 1.2, 0.02);
      root.add(tag);
      root.add(shadowUnder(2.4, 1.8));
      break;
    }
    case 'mediaVan': {
      const { root: van, flash } = buildMediaVan();
      flash.userData.keep = true;
      flash.name = 'flash';
      van.position.z = zc;
      root.add(van);
      root.add(shadowUnder(2.6, 5.6));
      break;
    }
    case 'bus': {
      const b = buildBus();
      b.position.z = zc;
      root.add(b);
      root.add(shadowUnder(2.6, 8.6));
      break;
    }
    case 'truck': {
      const b = buildTruck();
      b.position.z = zc;
      root.add(b);
      root.add(shadowUnder(2.6, 6.6));
      break;
    }
  }
  view.root = mergeStatic(root);
  return view;
}

/** Road-spanning gantry shared by all overhead obstacles in a row. */
export function buildGantry(): THREE.Group {
  const g = new THREE.Group();
  const post = toon(0x6b6b74);
  const x = ROAD_HALF_WIDTH + 0.35;
  for (const s of [-1, 1]) g.add(mesh(cyl(0.12, 0.14, 3.9, 10), post, s * x, 1.95, 0));
  g.add(mesh(box(x * 2 + 0.3, 0.22, 0.22), post, 0, 3.8, 0));
  const flags = mesh(plane(x * 2, 0.5), basic(0xffffff, { map: bunting(), transparent: true, side: THREE.DoubleSide, key: 'bunting' }), 0, 3.5, 0.05);
  g.add(flags);
  return mergeStatic(g);
}

export function debugCollider(kind: ObstacleKind): THREE.LineSegments {
  const def = OBSTACLES[kind];
  const bottom = def.cls === 'gap' ? -0.2 : def.bottom;
  const top = def.cls === 'gap' ? 0.05 : def.top;
  const g = new THREE.BoxGeometry(def.halfW * 2, top - bottom, def.depth);
  const e = new THREE.EdgesGeometry(g);
  g.dispose();
  const l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: def.cls === 'wall' ? 0xff0000 : def.cls === 'low' ? 0xffff00 : def.cls === 'high' ? 0x00ffff : 0xff00ff }));
  l.position.set(0, (top + bottom) / 2, -def.depth / 2);
  return l;
}

/** Blinking lamp / camera flash, found by name so clones animate too. */
function attachTick(view: ObstacleView): void {
  const lamp = view.root.getObjectByName('lamp') as THREE.Mesh | undefined;
  const flash = view.root.getObjectByName('flash');
  if (lamp) view.tick = (t) => ((lamp.material as THREE.MeshToonMaterial).emissiveIntensity = Math.sin(t * 8) > 0 ? 1.5 : 0.15);
  else if (flash) view.tick = (t) => (flash.visible = t % 2.3 < 0.08 || (t % 2.3 > 0.2 && t % 2.3 < 0.25));
}

/**
 * Per-kind object pool. Views are reused, never re-created per spawn, and
 * every copy of a kind shares the template's GPU geometry and materials, so
 * GPU memory stays flat however large the pool grows.
 */
export class ObstaclePool {
  private free = new Map<ObstacleKind, ObstacleView[]>();
  private gantries: THREE.Group[] = [];
  private templates = new Map<string, THREE.Group>();
  private gantryTemplate: THREE.Group | null = null;
  private banners = 0;
  created = 0;

  private create(kind: ObstacleKind): ObstacleView {
    this.created++;
    const variant = kind === 'bannerArch' ? this.banners++ % BANNERS.length : 0;
    const key = `${kind}:${variant}`;
    let tpl = this.templates.get(key);
    if (!tpl) {
      tpl = build(kind, variant).root;
      this.templates.set(key, tpl);
    }
    const view: ObstacleView = { root: tpl.clone(), kind };
    attachTick(view);
    return view;
  }

  acquire(kind: ObstacleKind): ObstacleView {
    const list = this.free.get(kind);
    const v = list?.pop() ?? this.create(kind);
    v.root.visible = true;
    v.root.rotation.set(0, 0, 0);
    v.root.scale.set(1, 1, 1);
    return v;
  }

  release(v: ObstacleView): void {
    v.root.visible = false;
    v.root.removeFromParent();
    let list = this.free.get(v.kind);
    if (!list) this.free.set(v.kind, (list = []));
    list.push(v);
  }

  acquireGantry(): THREE.Group {
    if (!this.gantryTemplate) this.gantryTemplate = buildGantry();
    const g = this.gantries.pop() ?? this.gantryTemplate.clone();
    g.visible = true;
    return g;
  }

  releaseGantry(g: THREE.Group): void {
    g.visible = false;
    g.removeFromParent();
    this.gantries.push(g);
  }

  /** Pre-build a few of each kind so the first spawns never hitch. */
  warm(): void {
    for (const k of Object.keys(OBSTACLES) as ObstacleKind[]) {
      const vs = [this.acquire(k), this.acquire(k)];
      vs.forEach((v) => this.release(v));
    }
  }
}
