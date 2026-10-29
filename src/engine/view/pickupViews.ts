import * as THREE from 'three';
import type { Pickup, PickupKind, TokenVariant } from '../../sim/types';
import { basic, box, cone, cyl, lambert, mesh, plane, sphere, toon, torus } from './materials';
import { blobShadow, coinFace } from './textures';

function starShape(r1: number, r2: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? r2 : r1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** Development tokens: one icon per environment. */
function buildToken(variant: TokenVariant, g: THREE.Group): void {
  const gold = toon(0xffcf3a, { emissive: 0x4a3200 });
  const saffron = toon(0xff8c1a, { emissive: 0x3a1a00 });
  switch (variant) {
    case 'road': {
      const shield = mesh(cyl(0.34, 0.34, 0.08, 6), toon(0x1f8a4c, { emissive: 0x08240f }));
      shield.rotation.x = Math.PI / 2;
      g.add(shield);
      g.add(mesh(box(0.06, 0.34, 0.1), toon(0xffffff), 0, -0.04, 0));
      const head = mesh(cone(0.14, 0.18, 3), toon(0xffffff), 0, 0.2, 0);
      head.scale.z = 0.3;
      g.add(head);
      break;
    }
    case 'diya': {
      g.add(mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0xc0602a, { side: THREE.DoubleSide }), 0, 0, 0));
      g.add(mesh(cyl(0.3, 0.3, 0.04, 14), toon(0x8a3a1a), 0, 0, 0));
      g.add(mesh(cone(0.09, 0.32, 8), basic(0xffc21a), 0, 0.2, 0));
      g.add(mesh(cone(0.05, 0.2, 8), basic(0xfff4b0), 0, 0.16, 0.02));
      break;
    }
    case 'plane': {
      const white = toon(0xffffff);
      const body = mesh(cyl(0.09, 0.09, 0.7, 10), white);
      body.rotation.z = Math.PI / 2;
      g.add(body);
      g.add(mesh(box(0.2, 0.03, 0.7), saffron, 0.02, 0, 0));
      g.add(mesh(box(0.12, 0.2, 0.03), saffron, -0.32, 0.1, 0));
      g.add(mesh(box(0.08, 0.02, 0.28), white, -0.3, 0, 0));
      break;
    }
    case 'wheat': {
      for (const a of [-0.3, 0, 0.3]) {
        const stalk = new THREE.Group();
        stalk.add(mesh(cyl(0.02, 0.02, 0.55, 5), toon(0xb8a040), 0, 0, 0));
        for (let i = 0; i < 5; i++) {
          const grain = mesh(sphere(0.05, 6, 5), gold, (i % 2 ? 0.04 : -0.04), 0.12 + i * 0.07, 0);
          grain.scale.y = 1.6;
          stalk.add(grain);
        }
        stalk.rotation.z = a;
        g.add(stalk);
      }
      g.add(mesh(box(0.2, 0.06, 0.06), toon(0x1f8a4c), 0, -0.1, 0));
      break;
    }
    case 'welfare': {
      g.add(mesh(box(0.42, 0.32, 0.3), toon(0xffffff), 0, -0.08, 0));
      const roof = mesh(cone(0.36, 0.26, 4), saffron, 0, 0.21, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      g.add(mesh(box(0.1, 0.16, 0.32), toon(0x1f8a4c), 0, -0.16, 0));
      break;
    }
    case 'shield': {
      const sh = mesh(cyl(0.32, 0.22, 0.08, 6), toon(0x2d5fbf, { emissive: 0x08183a }));
      sh.rotation.x = Math.PI / 2;
      sh.scale.set(1, 1, 1.15);
      g.add(sh);
      const st = new THREE.Mesh(new THREE.ShapeGeometry(starShape(0.16, 0.07)), toon(0xffcf3a, { side: THREE.DoubleSide }));
      st.position.z = 0.05;
      g.add(st);
      break;
    }
    case 'gear': {
      const steel = toon(0x7f98ae, { emissive: 0x101820 });
      g.add(mesh(torus(0.22, 0.08, Math.PI * 2, 8, 20), steel));
      for (let i = 0; i < 8; i++) {
        const tooth = mesh(box(0.1, 0.12, 0.1), steel, 0, 0, 0);
        tooth.rotation.z = (i / 8) * Math.PI * 2;
        tooth.translateY(0.33);
        g.add(tooth);
      }
      g.add(mesh(sphere(0.08, 8, 6), saffron));
      break;
    }
    case 'star': {
      const geo = new THREE.ExtrudeGeometry(starShape(0.36, 0.15), { depth: 0.08, bevelEnabled: false });
      geo.translate(0, 0, -0.04);
      g.add(new THREE.Mesh(geo, gold));
      break;
    }
  }
}

const MAX_COINS = 320;

function buildSpecial(kind: Exclude<PickupKind, 'coin'>, variant: TokenVariant | null): THREE.Group {
  const g = new THREE.Group();
  const halo = mesh(plane(1.6, 1.6), basic(0xffffff, { map: blobShadow(), transparent: true, key: 'halo' }), 0, 0, 0.1);
  switch (kind) {
    case 'magnet': {
      const red = toon(0xe8262c);
      const arc = mesh(torus(0.32, 0.11, Math.PI, 8, 16), red);
      arc.rotation.z = Math.PI;
      arc.position.y = 0.05;
      g.add(arc);
      for (const x of [-0.32, 0.32]) {
        g.add(mesh(cyl(0.11, 0.11, 0.3, 10), red, x, 0.2, 0));
        g.add(mesh(cyl(0.115, 0.115, 0.12, 10), toon(0xdddddd), x, 0.4, 0));
      }
      break;
    }
    case 'vikas': {
      const teal = toon(0x00c2b0, { emissive: 0x004a44 });
      g.add(mesh(cyl(0.18, 0.18, 0.7, 12), teal)).rotation.z = Math.PI / 2;
      const nose = mesh(new THREE.ConeGeometry(0.18, 0.35, 12), teal, 0.52, 0, 0);
      nose.rotation.z = -Math.PI / 2;
      g.add(nose);
      for (const y of [-0.16, 0.16]) g.add(mesh(box(0.3, 0.05, 0.28), toon(0xffffff), -0.25, y, 0));
      g.rotation.y = Math.PI / 2;
      break;
    }
    case 'chaseToken': {
      g.add(mesh(torus(0.32, 0.07, Math.PI * 2, 8, 20), toon(0xff8c1a)));
      const face = mesh(cyl(0.3, 0.3, 0.05, 20), toon(0xffffff));
      face.rotation.x = Math.PI / 2;
      g.add(face);
      g.add(mesh(box(0.04, 0.22, 0.06), toon(0x222222), 0, 0.08, 0.04));
      g.add(mesh(box(0.16, 0.04, 0.06), toon(0x222222), 0.06, 0, 0.04));
      g.add(mesh(cyl(0.06, 0.06, 0.12, 8), toon(0xff8c1a), 0, 0.42, 0));
      break;
    }
    case 'devToken':
      buildToken(variant ?? 'star', g);
      break;
    case 'reportCard': {
      g.add(mesh(box(0.46, 0.6, 0.04), toon(0xffffff)));
      for (let i = 0; i < 3; i++) g.add(mesh(box(0.3, 0.04, 0.05), toon(0x9aa3ad), -0.02, 0.15 - i * 0.12, 0));
      const tick1 = mesh(box(0.06, 0.16, 0.06), toon(0x1f8a4c), -0.06, -0.2, 0.02);
      tick1.rotation.z = 0.7;
      const tick2 = mesh(box(0.06, 0.3, 0.06), toon(0x1f8a4c), 0.06, -0.14, 0.02);
      tick2.rotation.z = -0.5;
      g.add(tick1, tick2);
      g.add(mesh(box(0.48, 0.1, 0.05), toon(0xff8c1a), 0, 0.3, 0));
      break;
    }
    case 'promise': {
      const paper = mesh(cyl(0.11, 0.11, 0.62, 12), toon(0xfff3d6));
      paper.rotation.z = Math.PI / 2;
      g.add(paper);
      for (const x of [-0.33, 0.33]) {
        const end = mesh(cyl(0.13, 0.13, 0.05, 12), toon(0xc9a06a), x, 0, 0);
        end.rotation.z = Math.PI / 2;
        g.add(end);
      }
      g.add(mesh(torus(0.12, 0.025, Math.PI * 2, 6, 14), toon(0x1f8a4c), 0, 0, 0)).rotation.y = Math.PI / 2;
      break;
    }
    case 'bulldozer': {
      const y = toon(0xf5b800, { emissive: 0x3a2a00 });
      g.add(mesh(box(0.5, 0.22, 0.32), y, 0, -0.05, 0));
      g.add(mesh(box(0.22, 0.22, 0.26), y, -0.08, 0.17, 0));
      g.add(mesh(box(0.06, 0.32, 0.46), toon(0x9a9aa2), 0.32, -0.04, 0));
      for (const z of [-0.18, 0.18]) g.add(mesh(box(0.56, 0.1, 0.08), toon(0x222222), 0, -0.2, z));
      g.rotation.y = Math.PI / 2;
      break;
    }
  }
  g.add(halo);
  return g;
}

/** Coins are one InstancedMesh (one draw call); specials are pooled groups. */
export class PickupViews {
  readonly coins: THREE.InstancedMesh;
  readonly group = new THREE.Group();
  private specials = new Map<number, THREE.Group>();
  private free = new Map<string, THREE.Group[]>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);

  constructor() {
    const g = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20);
    g.rotateX(Math.PI / 2);
    const face = lambert(0xffffff, { map: coinFace(), emissive: 0x3a2a00, key: 'coin' });
    const side = toon(0xe0a000, { emissive: 0x3a2a00 });
    this.coins = new THREE.InstancedMesh(g, [side, face, face], MAX_COINS);
    this.coins.count = 0;
    this.coins.frustumCulled = false;
    this.group.add(this.coins);
  }

  sync(pickups: Pickup[], d: number, t: number): void {
    let n = 0;
    const seen = new Set<number>();
    for (const pk of pickups) {
      if (pk.collected) continue;
      const z = -(pk.s - d);
      if (z < -175 || z > 12) continue;
      if (pk.kind === 'coin') {
        if (n >= MAX_COINS) continue;
        this.e.set(0, t * 3.2 + pk.id * 0.37, 0);
        this.q.setFromEuler(this.e);
        this.v.set(pk.x, pk.y, z);
        this.m4.compose(this.v, this.q, this.s);
        this.coins.setMatrixAt(n++, this.m4);
        continue;
      }
      seen.add(pk.id);
      let view = this.specials.get(pk.id);
      if (!view) {
        const key = `${pk.kind}:${pk.variant ?? ''}`;
        view = this.free.get(key)?.pop() ?? buildSpecial(pk.kind, pk.variant);
        view.userData.key = key;
        view.visible = true;
        this.group.add(view);
        this.specials.set(pk.id, view);
      }
      view.position.set(pk.x, pk.y + 0.25 + Math.sin(t * 3 + pk.id) * 0.12, z);
      view.rotation.y = t * 2;
      view.scale.setScalar(1.25);
    }
    this.coins.count = n;
    this.coins.instanceMatrix.needsUpdate = true;
    for (const [id, view] of this.specials) {
      if (seen.has(id)) continue;
      view.visible = false;
      view.removeFromParent();
      const key = view.userData.key as string;
      if (!this.free.has(key)) this.free.set(key, []);
      this.free.get(key)!.push(view);
      this.specials.delete(id);
    }
  }

  clear(): void {
    this.sync([], 0, 0);
  }
}
