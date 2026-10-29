import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterId } from '../../sim/types';
import { CharacterRig, type RigStyle, type RunStyle } from './characterRig';
import { box, capsule, cyl, disposeOwned, geo, mesh, sphere, toon, torus } from './materials';

interface HumanoidSpec {
  skin: number;
  top: number;
  topDark?: number;
  legs: number;
  shoes: number;
  sleeve?: number;
  torsoW: number;
  headScale: [number, number, number];
  skirtLen: number;
  skirtFlare: number;
  style: RigStyle;
  browColor: number;
}

const DARK = 0x1c1a1a;

function starShape(): THREE.ShapeGeometry {
  return geo('star', () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.035 : 0.08;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
}

/** Build the shared skeleton + body for any humanoid character. */
function buildHumanoid(spec: HumanoidSpec): { rig: CharacterRig; head: THREE.Object3D; spine: THREE.Object3D; hips: THREE.Object3D } {
  const rig = new CharacterRig(spec.style);
  const skin = toon(spec.skin);
  const top = toon(spec.top);
  const legs = toon(spec.legs);
  const shoes = toon(spec.shoes);
  const sleeve = toon(spec.sleeve ?? spec.top);
  const J = rig.joints;

  const hips = new THREE.Group();
  hips.position.y = rig.hipsHeight;
  rig.body.add(hips);
  J.body = rig.body;

  // Pelvis and kurta skirt (attached to the hips so it never separates).
  hips.add(mesh(sphere(0.2), top, 0, 0.02, 0)).scale.set(1.25, 0.8, 0.95);
  const skirt = mesh(cyl(spec.torsoW + 0.01, spec.skirtFlare, spec.skirtLen, 18, true), toon(spec.top, { side: THREE.DoubleSide }), 0, 0.04 - spec.skirtLen / 2, 0);
  const skirtPivot = new THREE.Group();
  skirtPivot.add(skirt);
  hips.add(skirtPivot);
  rig.skirt = skirtPivot;

  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0, 0);
    hips.add(hip);
    hip.add(mesh(capsule(0.088, 0.22), legs, 0, -0.19, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.38;
    hip.add(knee);
    knee.add(mesh(capsule(0.074, 0.24), legs, 0, -0.19, 0));
    const foot = mesh(box(0.13, 0.08, 0.27), shoes, 0, -0.4, -0.05);
    knee.add(foot);
    if (side < 0) {
      J.hipL = hip;
      J.kneeL = knee;
    } else {
      J.hipR = hip;
      J.kneeR = knee;
    }
  }

  const spine = new THREE.Group();
  spine.position.y = 0.04;
  hips.add(spine);
  J.spine = spine;
  spine.add(mesh(cyl(spec.torsoW, spec.torsoW + 0.02, 0.54, 18), top, 0, 0.27, 0));
  for (const side of [-1, 1]) spine.add(mesh(sphere(0.12), top, side * spec.torsoW, 0.5, 0));

  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * (spec.torsoW + 0.06), 0.5, 0);
    spine.add(sh);
    sh.add(mesh(capsule(0.072, 0.2), sleeve, 0, -0.17, 0));
    const el = new THREE.Group();
    el.position.y = -0.33;
    sh.add(el);
    el.add(mesh(capsule(0.064, 0.17), sleeve, 0, -0.13, 0));
    el.add(mesh(sphere(0.068), skin, 0, -0.3, 0));
    if (side < 0) {
      J.shL = sh;
      J.elL = el;
    } else {
      J.shR = sh;
      J.elR = el;
    }
  }

  const neck = new THREE.Group();
  neck.position.y = 0.52;
  spine.add(neck);
  J.neck = neck;
  neck.add(mesh(cyl(0.075, 0.08, 0.12), skin, 0, 0.04, 0));
  const head = new THREE.Group();
  head.position.y = 0.08;
  neck.add(head);
  J.head = head;
  const skull = mesh(sphere(0.27, 24, 18), skin, 0, 0.24, 0);
  skull.scale.set(...spec.headScale);
  head.add(skull);

  // Face (front is -z).
  const faceRoot = new THREE.Group();
  faceRoot.position.set(0, 0.24, 0);
  head.add(faceRoot);
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.03, 0);
  faceRoot.add(eyes);
  const white = toon(0xffffff);
  const black = toon(0x111111);
  for (const side of [-1, 1]) {
    const e = mesh(sphere(0.052, 14, 10), white, side * 0.1, 0, -0.235);
    e.scale.set(1, 1.2, 0.55);
    eyes.add(e);
    eyes.add(mesh(sphere(0.026, 10, 8), black, side * 0.095, -0.005, -0.265));
  }
  const brows: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const b = mesh(box(0.11, 0.026, 0.03), toon(spec.browColor), side * 0.1, 0.105, -0.245);
    b.userData.baseY = 0.105;
    faceRoot.add(b);
    brows.push(b);
  }
  faceRoot.add(mesh(sphere(0.04, 10, 8), skin, 0, -0.03, -0.275));
  const mouthMat = toon(0x6b1d1d);
  const smile = mesh(torus(0.07, 0.015, Math.PI, 6, 14), mouthMat, 0, -0.08, -0.25);
  smile.rotation.z = Math.PI;
  faceRoot.add(smile);
  const frown = mesh(torus(0.06, 0.014, Math.PI, 6, 14), mouthMat, 0, -0.13, -0.245);
  faceRoot.add(frown);
  const open = mesh(sphere(0.045, 12, 10), toon(0x3a0d0d), 0, -0.11, -0.245);
  open.scale.set(0.9, 1.25, 0.5);
  faceRoot.add(open);
  for (const side of [-1, 1]) {
    const ear = mesh(sphere(0.06, 10, 8), skin, side * 0.265, 0.0, 0.02);
    ear.scale.set(0.5, 1, 0.8);
    faceRoot.add(ear);
  }
  rig.face = { eyes, browL: brows[0], browR: brows[1], smile, frown, open };

  // Dizzy stars ring (shown during stumbles).
  const starMat = toon(0xffd400, { side: THREE.DoubleSide, emissive: 0x664400 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const st = new THREE.Mesh(starShape(), starMat);
    st.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
    st.lookAt(0, 0, 0);
    rig.dizzy.add(st);
  }
  rig.dizzy.position.y = 0.62;
  head.add(rig.dizzy);

  return { rig, head: faceRoot, spine, hips };
}

function gandhiCap(color: number): THREE.Mesh {
  const g = geo('gandhiCap', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.25, 0);
    s.lineTo(0.25, 0);
    s.lineTo(0.3, 0.15);
    s.quadraticCurveTo(0, 0.11, -0.3, 0.15);
    s.lineTo(-0.25, 0);
    const eg = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false, curveSegments: 6 });
    eg.translate(0, 0, -0.17);
    eg.rotateY(Math.PI / 2);
    // Taper the crown into the topi's folded ridge.
    const pos = eg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = Math.max(0, Math.min(1, (y - 0.05) / 0.09));
      pos.setX(i, pos.getX(i) * (1 - 0.8 * k));
    }
    eg.computeVertexNormals();
    return eg;
  });
  return new THREE.Mesh(g, toon(color));
}

export interface ModelOptions {
  outfit: string;
  runStyle?: RunStyle;
}

export function buildAkhilesh(o: ModelOptions): CharacterRig {
  const { rig, head, spine } = buildHumanoid({
    skin: 0xe8b48c,
    top: 0xf8f8f2,
    legs: 0xefefe9,
    shoes: 0x3b2a20,
    torsoW: 0.25,
    headScale: [1.06, 1.0, 1.0],
    skirtLen: 0.44,
    skirtFlare: 0.39,
    browColor: DARK,
    style: { strideAmp: 0.7, armAmp: 0.95, bounce: 0.08, slide: 'duck', jumpArms: 'up', idle: 'cap', victory: 'arm' },
  });
  const hair = mesh(sphere(0.282, 22, 16), toon(0x1d1a1a), 0, 0.05, 0.045);
  head.add(hair);
  // The red cap is the character's signature: sized to read clearly from
  // behind, which is how the player sees the runner.
  const cap = gandhiCap(0xd8202a);
  cap.position.set(0, 0.2, 0.025);
  cap.rotation.x = -0.12;
  cap.scale.set(1.75, 1.2, 1.02);
  head.add(cap);
  if (o.outfit === 'akhilesh.sadri') {
    const jacket = mesh(
      geo('sadri', () => new THREE.CylinderGeometry(0.27, 0.29, 0.5, 20, 1, true, Math.PI + 0.32, Math.PI * 2 - 0.64)),
      toon(0x262a33, { side: THREE.DoubleSide }),
      0,
      0.27,
      0,
    );
    spine.add(jacket);
  }
  if (o.outfit === 'akhilesh.scarf') {
    for (const [side, color] of [
      [-1, 0xd8202a],
      [1, 0x179c3c],
    ] as const) {
      const strip = mesh(box(0.09, 0.5, 0.025), toon(color), side * 0.09, 0.3, -0.26);
      spine.add(strip);
    }
    const ring = mesh(torus(0.15, 0.04, Math.PI * 2, 6, 18), toon(0xd8202a), 0, 0.53, -0.02);
    ring.rotation.x = Math.PI / 2;
    spine.add(ring);
  }
  rig.runStyle = o.runStyle ?? 'classic';
  return rig;
}

export function buildYogi(o: ModelOptions): CharacterRig {
  const saffron = 0xff8c1a;
  const { rig, head, spine } = buildHumanoid({
    skin: 0xd9a074,
    top: saffron,
    legs: 0xf98310,
    shoes: 0x6b3f1f,
    torsoW: 0.245,
    headScale: [0.98, 1.05, 1.0],
    skirtLen: 0.46,
    skirtFlare: 0.4,
    browColor: 0x2a1d14,
    style: { strideAmp: 0.62, armAmp: 0.85, bounce: 0.07, slide: 'lean', jumpArms: 'forward', idle: 'namaste', victory: 'blessing' },
  });
  // Light stubble around the jaw.
  const stubble = mesh(
    geo('stubble', () => new THREE.SphereGeometry(0.274, 22, 10, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.58, Math.PI * 0.3)),
    toon(0xbb855c),
    0,
    0,
    0,
  );
  stubble.rotation.y = Math.PI;
  head.add(stubble);
  // Earrings and a small tilak.
  const gold = toon(0xe8b730, { emissive: 0x3a2a00 });
  for (const side of [-1, 1]) {
    const ring = mesh(torus(0.05, 0.014, Math.PI * 2, 6, 16), gold, side * 0.27, -0.07, 0.02);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }
  head.add(mesh(box(0.028, 0.075, 0.02), toon(0xc8161e), 0, 0.17, -0.255));
  // Shawl draped diagonally, front and back.
  const shawlMat = toon(o.outfit === 'yogi.shawl' ? 0xe85d00 : 0xf27406);
  for (const z of [-0.255, 0.255]) {
    const shawl = mesh(box(0.13, 0.78, 0.03), shawlMat, 0, 0.28, z);
    shawl.rotation.z = z < 0 ? 0.62 : -0.62;
    spine.add(shawl);
  }
  if (o.outfit === 'yogi.shawl') {
    const drape = mesh(cyl(0.3, 0.33, 0.24, 18, true), toon(0xe85d00, { side: THREE.DoubleSide }), 0, 0.42, 0);
    spine.add(drape);
  }
  if (o.outfit === 'yogi.mala') addGarland(spine);
  rig.runStyle = o.runStyle ?? 'classic';
  return rig;
}

function addGarland(spine: THREE.Object3D): void {
  const g = mesh(torus(0.2, 0.05, Math.PI * 2, 6, 22), toon(0xffa41b), 0, 0.42, -0.08);
  g.rotation.x = 1.2;
  spine.add(g);
  const g2 = mesh(torus(0.2, 0.03, Math.PI * 2, 6, 22), toon(0xff6a00), 0, 0.42, -0.08);
  g2.rotation.x = 1.2;
  g2.scale.setScalar(1.12);
  spine.add(g2);
}

export function buildUmmeedwar(o: ModelOptions): CharacterRig {
  const { rig, head, spine } = buildHumanoid({
    skin: 0xc98e62,
    top: 0xfafafa,
    legs: 0xf2f2ee,
    shoes: 0x222222,
    torsoW: 0.27,
    headScale: [1.04, 0.98, 1.0],
    skirtLen: 0.44,
    skirtFlare: 0.41,
    browColor: DARK,
    style: { strideAmp: 0.66, armAmp: 0.9, bounce: 0.09, slide: 'duck', jumpArms: 'up', idle: 'wave', victory: 'arm' },
  });
  const hair = mesh(sphere(0.29, 22, 16), toon(0x151515), 0.03, 0.07, 0.06);
  head.add(hair);
  const stache = mesh(capsule(0.03, 0.16), toon(0x151515), 0, -0.055, -0.26);
  stache.rotation.z = Math.PI / 2;
  head.add(stache);
  spine.add(mesh(cyl(0.285, 0.3, 0.5, 20, true), toon(0xc9a66b, { side: THREE.DoubleSide }), 0, 0.27, 0));
  addGarland(spine);
  if (o.outfit === 'ummeedwar.shades') {
    for (const side of [-1, 1]) head.add(mesh(box(0.12, 0.07, 0.03), toon(0x0d0d0d), side * 0.1, 0.03, -0.27));
    head.add(mesh(box(0.08, 0.02, 0.02), toon(0x0d0d0d), 0, 0.05, -0.275));
  }
  rig.runStyle = o.runStyle ?? 'classic';
  return rig;
}

/**
 * Merge the static meshes attached directly to each joint (one mesh per
 * material). Joints keep animating; only draw calls go down. Expression
 * parts (brows, mouths) and the dizzy stars stay separate.
 */
function optimizeRig(rig: CharacterRig): CharacterRig {
  const f = rig.face;
  const keep = new Set<THREE.Object3D>([f.browL, f.browR, f.smile, f.frown, f.open, rig.dizzy]);
  const visit = (node: THREE.Object3D) => {
    const meshes = node.children.filter((c) => (c as THREE.Mesh).isMesh && !keep.has(c)) as THREE.Mesh[];
    if (meshes.length > 1) {
      const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
      for (const m of meshes) {
        m.updateMatrix();
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g = g.applyMatrix4(m.matrix);
        const mat = m.material as THREE.Material;
        if (!byMat.has(mat)) byMat.set(mat, []);
        byMat.get(mat)!.push(g);
        node.remove(m);
      }
      for (const [mat, list] of byMat) {
        const merged = mergeGeometries(list, false);
        if (merged) {
          merged.userData.owned = true;
          node.add(new THREE.Mesh(merged, mat));
        }
      }
    }
    for (const c of [...node.children]) if (!(c as THREE.Mesh).isMesh && !keep.has(c)) visit(c);
  };
  visit(rig.root);
  return rig;
}

export function buildCharacter(id: CharacterId, o: ModelOptions): CharacterRig {
  switch (id) {
    case 'yogi':
      return optimizeRig(buildYogi(o));
    case 'ummeedwar':
      return optimizeRig(buildUmmeedwar(o));
    default:
      return optimizeRig(buildAkhilesh(o));
  }
}

/** Remove a rig and free the geometry merged for it (shared primitives stay cached). */
export function disposeRig(rig: CharacterRig): void {
  rig.root.removeFromParent();
  disposeOwned(rig.root);
}
