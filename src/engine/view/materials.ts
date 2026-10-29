import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared material caches: one material per colour/style keeps draw-call
// state changes low and avoids leaking materials on restart.
const lambertCache = new Map<string, THREE.MeshLambertMaterial>();
const toonCache = new Map<string, THREE.MeshToonMaterial>();
const basicCache = new Map<string, THREE.MeshBasicMaterial>();

let gradient: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export interface MatOpts {
  map?: THREE.Texture | null;
  emissive?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  key?: string;
}

function keyOf(color: number, o: MatOpts): string {
  return `${color}|${o.map?.uuid ?? ''}|${o.emissive ?? ''}|${o.transparent ? 1 : 0}|${o.opacity ?? 1}|${o.side ?? 0}|${o.key ?? ''}`;
}

export function lambert(color: number, o: MatOpts = {}): THREE.MeshLambertMaterial {
  const k = keyOf(color, o);
  let m = lambertCache.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      map: o.map ?? null,
      emissive: o.emissive ?? 0x000000,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    lambertCache.set(k, m);
  }
  return m;
}

export function toon(color: number, o: MatOpts = {}): THREE.MeshToonMaterial {
  const k = keyOf(color, o);
  let m = toonCache.get(k);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      map: o.map ?? null,
      gradientMap: toonGradient(),
      emissive: o.emissive ?? 0x000000,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    toonCache.set(k, m);
  }
  return m;
}

export function basic(color: number, o: MatOpts = {}): THREE.MeshBasicMaterial {
  const k = keyOf(color, o);
  let m = basicCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      map: o.map ?? null,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      depthWrite: !(o.transparent ?? false),
    });
    basicCache.set(k, m);
  }
  return m;
}

/** Geometry cache keyed by a descriptive string. */
const geoCache = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export const box = (w: number, h: number, d: number) => geo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const sphere = (r: number, ws = 16, hs = 12) => geo(`sph${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const cyl = (rt: number, rb: number, h: number, seg = 14, open = false) =>
  geo(`cyl${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const capsule = (r: number, len: number) => geo(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
export const cone = (r: number, h: number, seg = 14) => geo(`cone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const torus = (r: number, t: number, arc = Math.PI * 2, rs = 8, ts = 20) =>
  geo(`tor${r},${t},${arc},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
export const plane = (w: number, h: number) => geo(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h));

export function mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(g, m);
  me.position.set(x, y, z);
  return me;
}

/**
 * Bake a static group of meshes into one mesh per material. Cuts draw calls
 * for props built from many primitives (vehicles, file piles, stalls...).
 * Meshes flagged `userData.keep` (animated parts) are left untouched.
 */
export function mergeStatic(group: THREE.Group): THREE.Group {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o === group) return;
    let flagged = false;
    for (let p: THREE.Object3D | null = o; p && p !== group; p = p.parent) if (p.userData.keep) flagged = true;
    if (flagged || Array.isArray(m.material) || (m as unknown as THREE.InstancedMesh).isInstancedMesh) {
      keep.push(o);
      return;
    }
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const mat = m.material as THREE.Material;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(g);
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (merged) {
      merged.userData.owned = true;
      out.add(new THREE.Mesh(merged, mat));
    }
  }
  for (const o of keep) {
    // Re-parent animated parts with their world transform relative to the group.
    const wm = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    o.removeFromParent();
    wm.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  out.position.copy(group.position);
  out.rotation.copy(group.rotation);
  out.scale.copy(group.scale);
  return out;
}

/** Dispose geometries created by mergeStatic/optimizeRig under `root`
 * (shared, cached primitives are left alone). */
export function disposeOwned(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry.userData.owned) m.geometry.dispose();
  });
}
