import * as THREE from 'three';
import type { Pickup, PickupKind } from '../../sim/types';
import { basic, box, cyl, lambert, mesh, plane, sphere, toon, torus } from './materials';
import { blobShadow, coinFace } from './textures';

const MAX_COINS = 320;

function buildSpecial(kind: Exclude<PickupKind, 'coin'>): THREE.Group {
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
    case 'heritageToken': {
      const gold = toon(0xffcf3a, { emissive: 0x4a3200 });
      for (const x of [-0.25, 0.25]) g.add(mesh(box(0.12, 0.5, 0.12), gold, x, -0.05, 0));
      const arch = mesh(torus(0.25, 0.06, Math.PI, 6, 14), gold, 0, 0.2, 0);
      g.add(arch);
      g.add(mesh(sphere(0.12, 10, 8), gold, 0, 0.5, 0));
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
  private free = new Map<PickupKind, THREE.Group[]>();
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
        view = this.free.get(pk.kind)?.pop() ?? buildSpecial(pk.kind);
        view.userData.kind = pk.kind;
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
      const kind = view.userData.kind as PickupKind;
      if (!this.free.has(kind)) this.free.set(kind, []);
      this.free.get(kind)!.push(view);
      this.specials.delete(id);
    }
  }

  clear(): void {
    this.sync([], 0, 0);
  }
}
