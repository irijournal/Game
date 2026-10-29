import * as THREE from 'three';
import { OBSTACLES } from '../../sim/obstacles';
import type { ObstacleKind } from '../../sim/types';
import { ROAD_HALF_WIDTH } from '../../sim/constants';
import { box, cone, cyl, lambert, mergeStatic, mesh, plane, sphere, toon, torus, basic } from './materials';
import { citizen } from './scenery';
import { blobShadow, bunting, canvasTexture, FONT, sign, stripes } from './textures';
import { buildBus, buildMediaVan, buildTruck } from './vehicles';

export interface ObstacleView {
  root: THREE.Group;
  kind: ObstacleKind;
  /** Optional per-frame animation (blinking lamps, camera flashes...). */
  tick?: (t: number, rel: number) => void;
}

const BANNERS = [
  ['UP’S FUTURE IS ON THE MOVE!', '#ff8c1a', '#ffffff'],
  ['DEVELOPMENT KA SCOREBOARD KHOLO!', '#1f8a4c', '#ffffff'],
  ['HAR CHALLENGE KA JAWAB — PERFORMANCE!', '#ff8c1a', '#fff3c4'],
  ['RACE FOR ROADS, JOBS & SERVICES', '#2d6cdf', '#ffffff'],
  ['MEGA RALLY TODAY!', '#ffffff', '#c25400'],
] as const;

const MARIGOLD = [0xff9a1a, 0xffc21a, 0xff7a00];

function wheelX(r: number, w: number, x: number, y: number, z: number, color = 0x1a1a1a): THREE.Mesh {
  const m = mesh(cyl(r, r, w, 14), toon(color), x, y, z);
  m.rotation.z = Math.PI / 2;
  return m;
}

function garland(root: THREE.Group, x0: number, x1: number, y: number, z: number, sag = 0.25, n = 11): void {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    root.add(mesh(sphere(0.085, 6, 5), toon(MARIGOLD[i % 3]), x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z));
  }
}

function gapHole(root: THREE.Group, depth: number, zc: number, floor: number, wallColor: number): void {
  const w = 2.05;
  const hole = mesh(plane(w, depth), basic(floor), 0, 0.013, zc);
  hole.rotation.x = -Math.PI / 2;
  root.add(hole);
  root.add(mesh(box(w, 0.6, 0.05), toon(wallColor), 0, -0.29, -depth + 0.03));
}


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
        const m = lambert(0xffffff, { map: sign(text, { bg, fg, border: '#ffd23a', w: 512, h: 300, sub: 'UP RUN game banner', subColor: fg }), side: THREE.DoubleSide });
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
      const panel = lambert(0xffffff, { map: sign('DEVELOPMENT ZONE', { bg: '#1f5fbf', fg: '#ffffff', sub: 'WORK IN PROGRESS • FICTIONAL SIGN', subColor: '#ffd400', w: 512, h: 512, stripe: true }) });
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

    // ---------------------------------------------------- level obstacles
    case 'flowerCart': {
      root.add(mesh(box(1.7, 0.45, 0.9), toon(0x8a5a2b), 0, 0.55, zc));
      root.add(mesh(box(1.76, 0.08, 0.96), toon(0x6a4020), 0, 0.8, zc));
      for (const x of [-0.7, 0.7]) root.add(wheelX(0.3, 0.08, x, 0.3, zc, 0x5a3a1a));
      for (let i = 0; i < 14; i++) root.add(mesh(sphere(0.16, 7, 6), toon(MARIGOLD[i % 3]), -0.65 + (i % 7) * 0.22, 0.88 + Math.floor(i / 7) * 0.1, zc - 0.2 + Math.floor(i / 7) * 0.35));
      root.add(shadowUnder(2.0, 1.3));
      break;
    }
    case 'luggageCart': {
      for (const x of [-0.5, 0.5]) {
        root.add(mesh(box(0.85, 0.06, 1.1), toon(0x9aa3ad), x, 0.3, zc));
        root.add(mesh(box(0.85, 0.7, 0.05), toon(0x7a838d), x, 0.62, zc - 0.55));
        for (const dz of [-0.4, 0.4]) root.add(wheelX(0.12, 0.06, x - 0.35, 0.12, zc + dz), wheelX(0.12, 0.06, x + 0.35, 0.12, zc + dz));
      }
      const bags = [0x2d6cdf, 0xe8262c, 0x1f8a4c, 0x333333, 0xffa31a];
      bags.forEach((c, i) => root.add(mesh(box(0.6, 0.32, 0.45), toon(c), -0.6 + (i % 3) * 0.6, 0.5 + Math.floor(i / 3) * 0.34, zc + (i % 2 ? 0.2 : -0.15))));
      root.add(shadowUnder(2.1, 1.5));
      break;
    }
    case 'brokenPipe': {
      const pipe = mesh(cyl(0.34, 0.34, 1.9, 14), toon(0x4a6a8a), 0, 0.36, zc);
      pipe.rotation.z = Math.PI / 2;
      root.add(pipe);
      for (const x of [-0.6, 0.6]) {
        const band = mesh(cyl(0.37, 0.37, 0.12, 14), lambert(0xffffff, { map: stripes('yb', '#ffd400', '#111') }), x, 0.36, zc);
        band.rotation.z = Math.PI / 2;
        root.add(band);
      }
      const spray = mesh(cone(0.25, 0.6, 10), basic(0x8fd0ff, { transparent: true, opacity: 0.7 }), 0.15, 0.95, zc);
      root.add(spray);
      root.add(shadowUnder(2.2, 0.9));
      break;
    }
    case 'hayBale': {
      for (const x of [-0.48, 0.48]) {
        const bale = mesh(cyl(0.48, 0.48, 0.9, 14), toon(0xe8c45a), x, 0.48, zc);
        bale.rotation.x = Math.PI / 2;
        root.add(bale);
        const face = mesh(cyl(0.4, 0.4, 0.92, 14), toon(0xd4a83a), x, 0.48, zc);
        face.rotation.x = Math.PI / 2;
        root.add(face);
      }
      root.add(shadowUnder(2.1, 1.3));
      break;
    }
    case 'queueBarrier': {
      for (const x of [-0.85, 0, 0.85]) {
        root.add(mesh(cyl(0.04, 0.04, 0.95, 8), toon(0xc0c6cc), x, 0.48, zc));
        root.add(mesh(cyl(0.16, 0.18, 0.05, 12), toon(0x555555), x, 0.03, zc));
      }
      root.add(mesh(box(1.7, 0.08, 0.03), lambert(0xffffff, { map: stripes('rw', '#e8262c', '#ffffff') }), 0, 0.88, zc));
      root.add(mesh(box(0.7, 0.32, 0.03), lambert(0xffffff, { map: sign('QUEUE HERE', { bg: '#1f8a4c', fg: '#fff', w: 256, h: 110 }) }), 0.42, 0.62, zc + 0.03));
      root.add(shadowUnder(2.0, 0.8));
      break;
    }
    case 'delaySign': {
      const board = lambert(0xffffff, { map: sign('DELAYED', { bg: '#e8262c', fg: '#fff', border: '#fff', sub: 'fictional sign', subColor: '#ffe0a0', w: 512, h: 300 }) });
      for (const sd of [-1, 1]) {
        const b = mesh(box(1.6, 1.0, 0.05), board, 0, 0.5, zc + sd * 0.2);
        b.rotation.x = sd * 0.33;
        if (sd < 0) b.rotation.y = Math.PI;
        root.add(b);
      }
      root.add(shadowUnder(2.0, 1.1));
      break;
    }
    case 'pallet': {
      root.add(mesh(box(1.7, 0.15, 1.0), toon(0xb8894a), 0, 0.08, zc));
      for (let i = 0; i < 5; i++) root.add(mesh(box(0.55, 0.38, 0.45), toon(0xc9a06a), -0.58 + (i % 3) * 0.58, 0.35 + Math.floor(i / 3) * 0.38, zc + (i % 2 ? 0.2 : -0.2)));
      root.add(mesh(box(1.72, 0.04, 1.02), toon(0x2d6cdf), 0, 0.6, zc));
      root.add(shadowUnder(2.0, 1.3));
      break;
    }
    case 'droneCrate': {
      root.add(mesh(box(1.5, 0.7, 0.75), toon(0x2fa8a0), 0, 0.35, zc));
      root.add(mesh(box(1.52, 0.1, 0.77), toon(0xffffff), 0, 0.55, zc));
      root.add(mesh(box(0.5, 0.12, 0.5), toon(0x30304a), 0, 0.78, zc));
      for (const [x, z] of [
        [-0.4, -0.3],
        [0.4, -0.3],
        [-0.4, 0.3],
        [0.4, 0.3],
      ]) {
        root.add(mesh(box(0.06, 0.04, 0.06), toon(0x30304a), x, 0.82, zc + z));
        root.add(mesh(cyl(0.18, 0.18, 0.02, 12), basic(0x9ad8ff, { transparent: true, opacity: 0.6 }), x, 0.9, zc + z));
      }
      root.add(shadowUnder(1.9, 1.1));
      break;
    }
    case 'canalGap': {
      gapHole(root, def.depth, zc, 0x1d4a6a, 0x4a3a2a);
      const water = mesh(plane(2.0, def.depth - 0.2), basic(0x3a8ac0), 0, -0.15, zc);
      water.rotation.x = -Math.PI / 2;
      root.add(water);
      for (const z of [0.1, -def.depth - 0.1]) root.add(mesh(box(2.2, 0.08, 0.2), toon(0x6ab84a), 0, 0.03, z));
      root.add(mesh(cone(0.16, 0.5, 10), toon(0xff6a00), -1.0, 0.25, 0.35), mesh(cone(0.16, 0.5, 10), toon(0xff6a00), 1.0, 0.25, 0.35));
      break;
    }
    case 'openDrain': {
      gapHole(root, def.depth, zc, 0x1a1c18, 0x6a6a6a);
      const sludge = mesh(plane(2.0, def.depth - 0.2), basic(0x3a4a2a), 0, -0.2, zc);
      sludge.rotation.x = -Math.PI / 2;
      root.add(sludge);
      const warn = lambert(0xffffff, { map: stripes('ob', '#ff8c00', '#111') });
      for (const z of [0.07, -def.depth - 0.07]) root.add(mesh(box(2.15, 0.08, 0.16), warn, 0, 0.04, z));
      root.add(mesh(cone(0.16, 0.5, 10), toon(0xff6a00), 1.0, 0.25, 0.35));
      break;
    }
    case 'toranaArch': {
      const panel = lambert(0xffffff, { map: sign('SWAGATAM', { bg: '#ff8c1a', fg: '#fff', border: '#ffd23a', sub: 'festival welcome', subColor: '#fff3c4', w: 512, h: 220 }), side: THREE.DoubleSide });
      root.add(mesh(box(1.9, 0.75, 0.06), panel, 0, 1.75, zc));
      garland(root, -0.95, 0.95, 2.25, zc + 0.05, 0.08);
      for (let i = 0; i < 9; i++) {
        const leaf = mesh(cone(0.07, 0.3, 4), toon(0x2f9a4a), -0.88 + i * 0.22, 1.27 + 0.15, zc + 0.04);
        leaf.rotation.z = Math.PI;
        root.add(leaf);
      }
      for (const x of [-0.85, 0.85]) root.add(mesh(cyl(0.012, 0.012, 1.4), toon(0x333333), x, 2.8, zc));
      root.add(shadowUnder(2.0, 0.8));
      break;
    }
    case 'flightBoard': {
      const face = lambert(0xffffff, {
        map: canvasTexture('flightBoard', 512, 256, (c) => {
          c.fillStyle = '#10141c';
          c.fillRect(0, 0, 512, 256);
          c.fillStyle = '#ffd23a';
          c.font = `bold 34px ${FONT}`;
          c.fillText('DEPARTURES', 20, 44);
          c.font = `bold 28px ${FONT}`;
          const rows = [['09:40', 'LUCKNOW', 'ON TIME'], ['10:15', 'VARANASI', 'BOARDING'], ['11:05', 'AYODHYA', 'ON TIME'], ['11:50', 'GORAKHPUR', 'GATE 3']];
          rows.forEach((r, i) => {
            c.fillStyle = '#ffffff';
            c.fillText(r[0], 20, 92 + i * 44);
            c.fillText(r[1], 130, 92 + i * 44);
            c.fillStyle = i === 1 ? '#7aff9a' : '#ffd23a';
            c.fillText(r[2], 360, 92 + i * 44);
          });
        }),
      });
      root.add(mesh(box(1.9, 0.95, 0.12), face, 0, 1.27 + 0.48, zc));
      root.add(mesh(box(1.96, 0.08, 0.16), toon(0x30343c), 0, 2.27, zc));
      for (const x of [-0.7, 0.7]) root.add(mesh(cyl(0.025, 0.025, 1.4), toon(0x777777), x, 2.95, zc));
      root.add(shadowUnder(2.0, 0.8));
      break;
    }
    case 'conveyor': {
      const belt = lambert(0xffffff, { map: stripes('belt', '#2a2a2a', '#444444', 10) });
      root.add(mesh(box(2.0, 0.28, 0.8), belt, 0, 1.42, zc));
      root.add(mesh(box(2.04, 0.08, 0.86), toon(0xffc300), 0, 1.3, zc));
      for (let i = 0; i < 3; i++) root.add(mesh(box(0.45, 0.4, 0.5), toon(0xc9a06a), -0.65 + i * 0.65, 1.76, zc));
      for (const x of [-0.85, 0.85]) root.add(mesh(cyl(0.03, 0.03, 1.6), toon(0x777777), x, 2.6, zc));
      root.add(shadowUnder(2.0, 1.0));
      break;
    }
    case 'holoGate': {
      root.add(mesh(box(1.9, 0.9, 0.04), basic(0x6af0ff, { transparent: true, opacity: 0.45 }), 0, 1.72, zc));
      root.add(mesh(box(1.96, 0.06, 0.08), basic(0x7af7ff), 0, 1.28, zc));
      root.add(mesh(box(1.96, 0.06, 0.08), basic(0x7af7ff), 0, 2.18, zc));
      root.add(mesh(box(1.2, 0.3, 0.05), lambert(0xffffff, { map: sign('SMART GATE', { bg: '#0a2a40', fg: '#7af7ff', w: 256, h: 80 }) }), 0, 1.72, zc + 0.03));
      for (const x of [-0.85, 0.85]) root.add(mesh(cyl(0.02, 0.02, 1.4), toon(0x777777), x, 2.9, zc));
      root.add(shadowUnder(2.0, 0.8));
      break;
    }
    case 'chariotFloat': {
      root.add(mesh(box(1.9, 0.9, def.depth - 0.2), toon(0x8a3a1a), 0, 0.75, zc));
      root.add(mesh(box(1.96, 0.12, def.depth - 0.1), toon(0xffc300), 0, 1.25, zc));
      for (const z of [zc - 1.2, zc + 1.2]) for (const x of [-0.95, 0.95]) root.add(wheelX(0.42, 0.14, x, 0.42, z, 0x6a3a1a));
      for (const [x, z] of [
        [-0.8, zc - 1.6],
        [0.8, zc - 1.6],
        [-0.8, zc + 1.6],
        [0.8, zc + 1.6],
      ])
        root.add(mesh(cyl(0.06, 0.06, 1.3, 8), toon(0xffc300), x, 1.95, z));
      root.add(mesh(cone(1.25, 1.0, 4), toon(0xff7a00), 0, 2.85, zc)).rotation.y = Math.PI / 4;
      garland(root, -0.95, 0.95, 2.4, zc + def.depth / 2 - 0.05, 0.3);
      garland(root, -0.95, 0.95, 1.6, zc + def.depth / 2 - 0.05, 0.15);
      root.add(shadowUnder(2.6, def.depth + 0.8));
      break;
    }
    case 'baggageTug': {
      root.add(mesh(box(1.8, 0.6, def.depth - 0.4), toon(0xf5b800), 0, 0.55, zc));
      for (const z of [zc - 1.5, zc + 1.5]) for (const x of [-0.85, 0.85]) root.add(wheelX(0.3, 0.2, x, 0.3, z));
      // Full-width cab at the front so it reads as a wall.
      root.add(mesh(box(1.84, 1.5, 1.2), toon(0xf5b800), 0, 1.6, -0.75));
      root.add(mesh(box(1.5, 0.6, 0.05), toon(0x2b3e52, { emissive: 0x0a1420 }), 0, 1.95, -0.13));
      root.add(mesh(box(1.9, 0.14, 1.3), toon(0x333333), 0, 2.42, -0.75));
      root.add(mesh(cyl(0.12, 0.12, 0.18, 10), toon(0xff9900, { emissive: 0xff6600 }), 0.6, 2.58, -0.75));
      const ramp = mesh(box(1.1, 0.15, 3.4), lambert(0xffffff, { map: stripes('belt', '#2a2a2a', '#444444', 10) }), 0, 2.0, zc - 0.4);
      ramp.rotation.x = 0.3;
      root.add(ramp);
      root.add(mesh(box(0.5, 0.35, 0.45), toon(0x2d6cdf), 0, 2.45, zc - 1.4));
      root.add(shadowUnder(2.6, def.depth + 0.6));
      break;
    }
    case 'crateStack': {
      const crate = toon(0xb8894a);
      for (let i = 0; i < 3; i++) {
        root.add(mesh(box(1.85 - i * 0.2, 0.86, 1.3), crate, Math.sin(i) * 0.05, 0.43 + i * 0.88, zc));
        root.add(mesh(box(1.87 - i * 0.2, 0.1, 1.32), toon(0x8a5a2b), Math.sin(i) * 0.05, 0.43 + i * 0.88, zc));
      }
      root.add(mesh(plane(0.9, 0.4), lambert(0xffffff, { map: sign('FRAGILE', { bg: '#fff', fg: '#c81e1e', w: 256, h: 110 }) }), 0, 0.5, 0.01));
      root.add(shadowUnder(2.4, 1.8));
      break;
    }
    case 'tractor': {
      // Parked facing away: the runner meets the tall hay trailer first, so
      // it reads as a wall from the gameplay camera.
      root.add(mesh(box(1.9, 0.5, 1.5), toon(0x2f7a3a), 0, 0.75, -0.8));
      root.add(mesh(box(1.8, 1.6, 1.4), toon(0xe8c45a), 0, 1.85, -0.8));
      for (const x of [-0.95, 0.95]) root.add(wheelX(0.38, 0.16, x, 0.38, -0.8));
      root.add(mesh(box(0.1, 0.1, 0.5), toon(0x333333), 0, 0.55, -1.75));
      const red = toon(0xd0302a);
      root.add(mesh(box(1.0, 0.9, 0.9), red, 0, 1.25, -2.4));
      root.add(mesh(box(0.9, 0.7, 1.0), red, 0, 1.0, -3.0));
      root.add(mesh(box(0.9, 0.06, 0.9), toon(0x333333), 0, 2.15, -2.4));
      for (const x of [-0.85, 0.85]) {
        root.add(wheelX(0.72, 0.36, x, 0.72, -2.3));
        root.add(wheelX(0.4, 0.22, x * 0.85, 0.4, -3.3));
      }
      root.add(shadowUnder(2.6, def.depth + 0.8));
      break;
    }
    case 'unfinishedSign': {
      const panel = lambert(0xffffff, { map: sign('UNFINISHED PROJECT', { bg: '#7a7f88', fg: '#ffffff', sub: 'FICTIONAL BOARD • DEVELOPMENT BLOCKED', subColor: '#ffd400', w: 512, h: 512, stripe: true }) });
      root.add(mesh(box(1.94, 2.2, 0.15), panel, 0, 1.65, zc));
      for (const x of [-0.85, 0.85]) root.add(mesh(box(0.12, 2.8, 0.12), toon(0x5a5f66), x, 1.4, zc - 0.12));
      root.add(mesh(cone(0.2, 0.7, 12), toon(0xff6a00), -0.7, 0.35, 0.3));
      root.add(shadowUnder(2.4, 1.0));
      break;
    }
    case 'forklift': {
      // Mast and a full load at the front, body behind.
      for (const x of [-0.45, 0.45]) root.add(mesh(box(0.12, 2.8, 0.12), toon(0x444444), x, 1.4, -0.9));
      root.add(mesh(box(1.1, 0.12, 0.12), toon(0x444444), 0, 2.7, -0.9));
      root.add(mesh(box(1.6, 0.12, 0.8), toon(0xb8894a), 0, 0.12, -0.42));
      root.add(mesh(box(1.5, 0.85, 0.75), toon(0xc9a06a), 0, 0.62, -0.42));
      root.add(mesh(box(1.3, 0.75, 0.7), toon(0xb8894a), 0, 1.42, -0.42));
      root.add(mesh(plane(0.8, 0.3), lambert(0xffffff, { map: sign('FRAGILE', { bg: '#fff', fg: '#c81e1e', w: 256, h: 110 }) }), 0, 0.7, -0.03));
      const y = toon(0xffb300);
      root.add(mesh(box(1.3, 0.8, 1.5), y, 0, 0.75, zc - 0.4));
      root.add(mesh(box(1.2, 0.08, 1.1), toon(0x333333), 0, 2.2, zc - 0.4));
      for (const [x, z] of [
        [-0.55, 0.15],
        [0.55, 0.15],
        [-0.55, -0.9],
        [0.55, -0.9],
      ])
        root.add(mesh(box(0.06, 1.1, 0.06), toon(0x333333), x, 1.65, zc - 0.4 + z * 0.5));
      for (const z of [-1.2, -2.2]) for (const x of [-0.65, 0.65]) root.add(wheelX(0.3, 0.2, x, 0.3, z));
      root.add(shadowUnder(2.4, def.depth + 0.6));
      break;
    }
    case 'maglevPod': {
      const white = toon(0xf6f8fa);
      root.add(mesh(box(1.9, 2.2, def.depth - 1.4), white, 0, 1.6, zc - 0.5));
      const nose = mesh(sphere(1.1, 16, 10), white, 0, 1.6, zc + def.depth / 2 - 1.2);
      nose.scale.set(0.86, 1.0, 1.1);
      root.add(nose);
      root.add(mesh(box(1.92, 0.5, def.depth - 1.4), toon(0x2b3e52, { emissive: 0x0a1420 }), 0, 2.0, zc - 0.5));
      root.add(mesh(box(1.94, 0.12, def.depth - 1.2), basic(0x7af7ff), 0, 1.2, zc - 0.4));
      root.add(mesh(box(1.94, 0.08, def.depth - 1.2), basic(0xffa040), 0, 2.55, zc - 0.4));
      root.add(mesh(box(1.4, 0.4, def.depth), toon(0x30304a), 0, 0.3, zc));
      root.add(shadowUnder(2.4, def.depth + 0.6));
      break;
    }

    // ------------------------------------------------- satire obstacles
    case 'familyMeeting': {
      // A fictional "family meeting" blocking the lane: a sofa, three
      // red-cap relatives arguing, and a board above them.
      const sofa = toon(0x8a2a2a);
      root.add(mesh(box(1.9, 0.45, 0.8), sofa, 0, 0.32, -0.9));
      root.add(mesh(box(1.9, 0.75, 0.2), sofa, 0, 0.75, -1.25));
      for (const x of [-0.92, 0.92]) root.add(mesh(box(0.16, 0.6, 0.8), sofa, x, 0.5, -0.9));
      const relative = (x: number, z: number, armsUp: boolean, shirt: number) =>
        citizen({ shirt, pants: 0xf2f2ee, hat: { kind: 'cap', color: 0xd8202a } }, x, z, 0.92, armsUp);
      root.add(relative(-0.6, -0.55, true, 0xffffff), relative(0.05, -0.45, false, 0xf6e9c8), relative(0.62, -0.6, true, 0xffffff));
      for (const x of [-0.85, 0.85]) root.add(mesh(box(0.1, 2.8, 0.1), toon(0x5a5f66), x, 1.4, -1.45));
      const board = lambert(0xffffff, { map: sign('PARIVAAR MEETING', { bg: '#fff3c4', fg: '#c81e1e', border: '#c81e1e', sub: 'TICKET TALKS SINCE 2016 • SATIRE', subColor: '#1a1a1a', w: 512, h: 220 }) });
      root.add(mesh(box(1.9, 0.82, 0.08), board, 0, 2.38, -1.42));
      root.add(shadowUnder(2.4, def.depth + 0.6));
      break;
    }
    case 'kaamPoster': {
      const panel = lambert(0xffffff, { map: sign('KAAM BOLTA HAI?', { bg: '#d8202a', fg: '#ffffff', sub: '2017 RESULT: 47 SEATS • SATIRE SIGN', subColor: '#fff3c4', w: 512, h: 512, stripe: false, border: '#ffffff' }) });
      root.add(mesh(box(1.94, 2.2, 0.15), panel, 0, 1.65, zc));
      for (const x of [-0.85, 0.85]) root.add(mesh(box(0.12, 2.8, 0.12), toon(0x5a5f66), x, 1.4, zc - 0.12));
      // An empty speech bubble: the work is… quiet.
      const bubble = lambert(0xffffff, { map: sign('…', { bg: '#ffffff', fg: '#1a1a1a', border: '#1a1a1a', w: 256, h: 160 }) });
      root.add(mesh(box(0.7, 0.45, 0.06), bubble, 0.55, 2.95, zc + 0.05));
      root.add(shadowUnder(2.4, 1.0));
      break;
    }
    case 'laptopPile': {
      const shell = toon(0x4a4f58);
      for (let i = 0; i < 4; i++) {
        root.add(mesh(box(0.72, 0.07, 0.52), shell, -0.45 + (i % 2) * 0.05, 0.05 + i * 0.075, zc + (i % 2 ? 0.05 : -0.04)));
        root.add(mesh(box(0.72, 0.07, 0.52), shell, 0.45 + (i % 2) * -0.04, 0.05 + i * 0.075, zc - (i % 2 ? 0.04 : 0)));
      }
      // One open laptop on top, stuck loading.
      const screen = lambert(0xffffff, { map: sign('BUFFERING…', { bg: '#10141c', fg: '#7af7ff', sub: 'since 2012', subColor: '#9aa3ad', w: 256, h: 180 }) });
      root.add(mesh(box(0.72, 0.05, 0.5), shell, 0, 0.36, zc));
      const lid = mesh(box(0.72, 0.5, 0.04), screen, 0, 0.6, zc - 0.25);
      lid.rotation.x = -0.25;
      root.add(lid);
      root.add(mesh(plane(1.0, 0.26), lambert(0xffffff, { map: sign('FREE LAPTOP 2012', { bg: '#ffffff', fg: '#c81e1e', w: 256, h: 70 }) }), 0, 0.2, 0.3 + zc));
      root.add(shadowUnder(2.0, 1.2));
      break;
    }
    case 'cycleHeap': {
      // Tangled bicycles in a heap: "alliance parking".
      const cycle = (x: number, rotY: number, tilt: number, color: number) => {
        const g = new THREE.Group();
        const tyre = toon(0x1a1a1a);
        for (const z of [-0.42, 0.42]) {
          const w = mesh(torus(0.3, 0.035, Math.PI * 2, 6, 18), tyre, 0, 0.3, z);
          w.rotation.y = Math.PI / 2;
          g.add(w);
        }
        const frame = toon(color);
        g.add(mesh(box(0.05, 0.05, 0.84), frame, 0, 0.42, 0));
        const down = mesh(box(0.05, 0.05, 0.5), frame, 0, 0.55, -0.12);
        down.rotation.x = 0.7;
        g.add(down, mesh(box(0.38, 0.04, 0.04), toon(0x333333), 0, 0.72, -0.36));
        g.position.set(x, 0, zc);
        g.rotation.set(0, rotY, tilt);
        return g;
      };
      root.add(cycle(-0.45, 0.4, 1.35, 0xd8202a), cycle(0.4, -0.5, -1.3, 0x179c3c), cycle(0.05, 0.15, 0.3, 0xd8202a));
      const tag = lambert(0xffffff, { map: sign('ALLIANCE PARKING', { bg: '#ffffff', fg: '#1a1a1a', border: '#1a1a1a', sub: 'satire', w: 256, h: 120 }) });
      const board = mesh(box(0.9, 0.42, 0.05), tag, 0, 0.75, zc + 0.35);
      board.rotation.x = -0.25;
      root.add(board, mesh(box(0.05, 0.75, 0.05), toon(0x777777), 0, 0.37, zc + 0.38));
      root.add(shadowUnder(2.1, 1.4));
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
