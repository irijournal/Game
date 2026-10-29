import * as THREE from 'three';
import { box, cyl, geo, lambert, mergeStatic, mesh, sphere, toon, torus } from './materials';
import { sign, stripes } from './textures';

export interface Vehicle {
  root: THREE.Group;
  update(dt: number, speed: number, t: number): void;
  /** Where a rider stands/sits, in vehicle space. */
  seat: THREE.Vector3;
}

function wheel(r: number, w: number, color = 0x1a1a1a): THREE.Group {
  const g = new THREE.Group();
  const tire = mesh(cyl(r, r, w, 16), toon(color));
  tire.rotation.z = Math.PI / 2;
  g.add(tire);
  const hub = mesh(cyl(r * 0.45, r * 0.45, w + 0.02, 10), toon(0xbbbbbb));
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return g;
}

/** Stylised bulldozer: a political symbol in the game, never a weapon. */
export function buildBulldozer(): Vehicle {
  const root = new THREE.Group();
  const yellow = toon(0xf5b800);
  const dark = toon(0x2a2a2a);
  const glass = toon(0x2b3e52, { emissive: 0x0a1420 });
  const trackTex = stripes('track', '#222', '#444', 10).clone();
  trackTex.needsUpdate = true;
  trackTex.wrapS = trackTex.wrapT = THREE.RepeatWrapping;
  trackTex.repeat.set(6, 1);
  const trackMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: trackTex });

  for (const side of [-1, 1]) {
    const t = mesh(box(0.62, 0.8, 3.9), trackMat, side * 1.0, 0.42, 0);
    root.add(t);
    for (const z of [-1.95, 1.95]) {
      const end = mesh(cyl(0.4, 0.4, 0.62, 14), dark, side * 1.0, 0.42, z);
      end.rotation.z = Math.PI / 2;
      root.add(end);
    }
    for (const z of [-1.2, -0.4, 0.4, 1.2]) {
      const w = mesh(cyl(0.22, 0.22, 0.66, 10), toon(0x555555), side * 1.0, 0.36, z);
      w.rotation.z = Math.PI / 2;
      root.add(w);
    }
  }
  root.add(mesh(box(1.5, 0.75, 3.5), yellow, 0, 1.15, 0.1));
  root.add(mesh(box(1.4, 0.7, 1.6), yellow, 0, 1.85, 0.95));
  // Engine grille.
  root.add(mesh(box(1.2, 0.5, 0.05), dark, 0, 1.85, 1.77));
  const stack = mesh(cyl(0.08, 0.08, 0.9), dark, 0.42, 2.55, 1.2);
  root.add(stack);
  // Cab.
  root.add(mesh(box(1.45, 1.25, 1.45), yellow, 0, 2.15, -0.55));
  root.add(mesh(box(1.25, 0.65, 0.05), glass, 0, 2.35, -1.29));
  for (const side of [-1, 1]) root.add(mesh(box(0.05, 0.6, 1.1), glass, side * 0.73, 2.35, -0.55));
  root.add(mesh(box(1.65, 0.12, 1.7), yellow, 0, 2.83, -0.55));
  const beacon = mesh(cyl(0.12, 0.12, 0.18, 10), new THREE.MeshToonMaterial({ color: 0xff9900, emissive: 0xff6600 }), 0.45, 2.98, -0.15);
  beacon.userData.keep = true;
  root.add(beacon);
  // Push arms and curved blade.
  for (const side of [-1, 1]) {
    const arm = mesh(box(0.16, 0.2, 1.7), yellow, side * 0.85, 0.85, -1.85);
    arm.rotation.x = 0.18;
    root.add(arm);
  }
  const bladeGeo = geo('blade', () => {
    const g = new THREE.CylinderGeometry(1.15, 1.15, 2.7, 16, 1, true, -0.62, 1.24);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const blade = new THREE.Mesh(bladeGeo, toon(0xe0a800, { side: THREE.DoubleSide }));
  blade.position.set(0, 0.95, -1.6);
  blade.rotation.x = -Math.PI / 2;
  root.add(blade);
  root.add(mesh(box(2.7, 0.12, 0.2), toon(0x777777), 0, 0.12, -2.68));
  // Side plate (no branding).
  for (const side of [-1, 1]) {
    const plate = mesh(box(0.02, 0.32, 1.4), lambert(0xffffff, { map: sign('UP RUN', { bg: '#f5b800', fg: '#222' , w: 256, h: 64}) }), side * 0.77, 1.2, 0.3);
    plate.rotation.y = side * Math.PI / 2;
    root.add(plate);
  }

  const body = mergeStatic(root);
  const outer = new THREE.Group();
  body.scale.setScalar(0.82);
  outer.add(body);
  return {
    root: outer,
    seat: new THREE.Vector3(0, 2.89 * 0.82, -0.55 * 0.82),
    update(dt, speed, t) {
      trackTex.offset.y -= dt * speed * 0.25;
      (beacon.material as THREE.MeshToonMaterial).emissiveIntensity = Math.sin(t * 10) > 0 ? 1.4 : 0.2;
      body.position.y = Math.sin(t * 22) * 0.025 * Math.min(1, speed / 5);
    },
  };
}

/** Oversized bicycle used when Akhilesh is the rival. */
export function buildCycle(): Vehicle {
  const root = new THREE.Group();
  const red = toon(0xd8202a);
  const green = toon(0x179c3c);
  const metal = toon(0xcccccc);
  const wheels: THREE.Group[] = [];
  for (const z of [-1.1, 1.1]) {
    const w = new THREE.Group();
    w.position.set(0, 0.9, z);
    const rim = mesh(torus(0.85, 0.07, Math.PI * 2, 8, 30), toon(0x151515));
    rim.rotation.y = Math.PI / 2;
    w.add(rim);
    for (let i = 0; i < 6; i++) {
      const sp = mesh(box(0.03, 1.66, 0.03), metal);
      sp.rotation.x = (i / 6) * Math.PI;
      w.add(sp);
    }
    root.add(w);
    wheels.push(w);
  }
  const bar = (a: THREE.Vector3, b: THREE.Vector3, m: THREE.Material, r = 0.07) => {
    const len = a.distanceTo(b);
    const me = mesh(cyl(r, r, len, 8), m);
    me.position.copy(a).add(b).multiplyScalar(0.5);
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    root.add(me);
  };
  const seat = new THREE.Vector3(0, 2.1, 0.55);
  const pedal = new THREE.Vector3(0, 0.95, 0);
  const head = new THREE.Vector3(0, 2.2, -0.85);
  bar(new THREE.Vector3(0, 0.9, 1.1), pedal, red);
  bar(pedal, seat, green);
  bar(seat, head, red);
  bar(pedal, head, green);
  bar(head, new THREE.Vector3(0, 0.9, -1.1), red);
  root.add(mesh(box(0.3, 0.1, 0.45), toon(0x222222), seat.x, seat.y + 0.05, seat.z));
  const hb = mesh(cyl(0.05, 0.05, 1.0, 8), metal, head.x, head.y + 0.15, head.z);
  hb.rotation.z = Math.PI / 2;
  root.add(hb);
  const crank = new THREE.Group();
  crank.position.copy(pedal);
  const gear = mesh(cyl(0.22, 0.22, 0.05, 14), metal);
  gear.rotation.z = Math.PI / 2;
  crank.add(gear);
  root.add(crank);
  // Streamers on the handlebar.
  for (const [x, c] of [
    [-0.45, 0xd8202a],
    [0.45, 0x179c3c],
  ] as const) {
    const s = mesh(box(0.06, 0.5, 0.02), toon(c, { side: THREE.DoubleSide }), x, head.y - 0.1, head.z + 0.1);
    root.add(s);
  }
  return {
    root,
    seat: new THREE.Vector3(0, seat.y + 0.12, seat.z + 0.05),
    update(dt, speed) {
      for (const w of wheels) w.rotation.x -= dt * speed / 0.9;
      crank.rotation.x -= dt * speed * 0.5;
    },
  };
}

export function buildAutoRickshaw(): THREE.Group {
  const g = new THREE.Group();
  const green = toon(0x2f9e44);
  const yellow = toon(0xf2c230);
  g.add(mesh(box(1.3, 0.75, 2.2), green, 0, 0.75, 0));
  g.add(mesh(box(1.32, 0.12, 2.25), yellow, 0, 1.15, 0));
  g.add(mesh(box(1.25, 0.08, 1.9), toon(0x1a1a1a), 0, 1.75, 0.1));
  for (const x of [-0.6, 0.6]) g.add(mesh(box(0.06, 0.6, 0.06), toon(0x1a1a1a), x, 1.45, -0.7));
  const fw = wheel(0.28, 0.18);
  fw.position.set(0, 0.28, -1.0);
  g.add(fw);
  for (const x of [-0.6, 0.6]) {
    const w = wheel(0.28, 0.18);
    w.position.set(x, 0.28, 0.75);
    g.add(w);
  }
  return g;
}

export function buildBus(): THREE.Group {
  const g = new THREE.Group();
  const body = toon(0x1f8a4c);
  const cream = toon(0xf2e8c9);
  g.add(mesh(box(2.1, 1.3, 8), body, 0, 0.95, 0));
  g.add(mesh(box(2.12, 1.0, 8), cream, 0, 2.1, 0));
  g.add(mesh(box(2.16, 0.6, 7.4), toon(0x24323f, { emissive: 0x0a0f14 }), 0, 2.15, 0));
  g.add(mesh(box(2.1, 0.2, 8.05), body, 0, 2.7, 0));
  // Rear (faces the runner).
  const back = mesh(box(1.9, 0.6, 0.03), lambert(0xffffff, { map: sign('CITY BUS', { bg: '#1f8a4c', fg: '#fff', sub: 'ROUTE 11 • SLOW SERVICE', w: 512, h: 160 }) }), 0, 1.25, 4.02);
  g.add(back);
  g.add(mesh(box(1.8, 0.7, 0.03), toon(0x24323f), 0, 2.15, 4.02));
  for (const z of [-2.8, 2.6]) {
    for (const x of [-1.0, 1.0]) {
      const w = wheel(0.5, 0.3);
      w.position.set(x, 0.5, z);
      g.add(w);
    }
  }
  return g;
}

export function buildTruck(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(2.1, 2.3, 4.2), toon(0x2d6cdf), 0, 1.75, 0.8));
  g.add(mesh(box(2.12, 0.5, 4.25), toon(0xffd23a), 0, 3.0, 0.8));
  g.add(mesh(box(2.0, 1.8, 1.7), toon(0xe8262c), 0, 1.5, -2.2));
  g.add(mesh(box(1.8, 0.7, 0.05), toon(0x24323f), 0, 1.9, -3.06));
  const art = lambert(0xffffff, {
    map: sign('HORN OK PLEASE', { bg: '#ffd23a', fg: '#c81e1e', border: '#2d6cdf', sub: 'USE DIPPER AT NIGHT', subColor: '#1a1a1a', w: 512, h: 320 }),
  });
  g.add(mesh(box(1.9, 1.5, 0.03), art, 0, 1.6, 2.93));
  for (const z of [-2.2, 2.0]) {
    for (const x of [-1.0, 1.0]) {
      const w = wheel(0.5, 0.32);
      w.position.set(x, 0.5, z);
      g.add(w);
    }
  }
  return g;
}

export function buildMediaVan(): { root: THREE.Group; flash: THREE.Mesh } {
  const g = new THREE.Group();
  g.add(mesh(box(1.95, 2.0, 5), toon(0xf4f4f4), 0, 1.25, 0));
  g.add(mesh(box(1.97, 0.35, 5.02), toon(0x2550c8), 0, 0.85, 0));
  g.add(mesh(box(1.8, 0.6, 0.05), toon(0x24323f), 0, 1.75, -2.52));
  const logo = lambert(0xffffff, { map: sign('KHABAR FAST TV', { bg: '#ffffff', fg: '#c81e1e', sub: '24x7 BREAKING • FICTIONAL', subColor: '#2550c8', w: 512, h: 200 }) });
  g.add(mesh(box(1.7, 0.75, 0.03), logo, 0, 1.6, 2.52));
  for (const side of [-1, 1]) {
    const s = mesh(box(0.03, 0.7, 3.2), logo, side * 0.99, 1.55, 0.2);
    g.add(s);
  }
  const live = mesh(box(0.5, 0.25, 0.04), toon(0xe8262c, { emissive: 0x550000 }), 0.55, 2.05, 2.53);
  g.add(live);
  // Satellite dish on the roof.
  const dish = mesh(geo('dish', () => new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, 0.9)), toon(0xdddddd, { side: THREE.DoubleSide }), 0, 2.75, 0.6);
  dish.rotation.x = -0.9;
  g.add(dish);
  g.add(mesh(cyl(0.06, 0.06, 0.5), toon(0x888888), 0, 2.45, 0.6));
  // Camera with a flash on a tripod by the rear door.
  g.add(mesh(box(0.25, 0.2, 0.35), toon(0x222222), -0.6, 2.4, 2.1));
  const flash = mesh(sphere(0.12, 10, 8), toon(0xffffff, { emissive: 0xffffff, transparent: true, opacity: 0.9, key: 'flash' }), -0.6, 2.42, 2.3);
  flash.visible = false;
  g.add(flash);
  for (const z of [-1.7, 1.7]) {
    for (const x of [-0.95, 0.95]) {
      const w = wheel(0.4, 0.26);
      w.position.set(x, 0.4, z);
      g.add(w);
    }
  }
  return { root: g, flash };
}
