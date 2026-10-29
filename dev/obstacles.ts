// Obstacle gallery: ?kinds=a,b,c renders those kinds side by side.
import * as THREE from 'three';
import { ObstaclePool } from '../src/engine/view/obstacleViews';
import { buildBulldozer, buildCycle } from '../src/engine/view/vehicles';
import type { ObstacleKind } from '../src/sim/types';

const q = new URLSearchParams(location.search);
const kinds = (q.get('kinds') ?? 'barricade,cones,fileStack,aframeSign').split(',') as (ObstacleKind | 'bulldozer' | 'cycle')[];
const view = q.get('view') ?? 'runner';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8e8);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a7a66, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-6, 14, 8);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x4b4b55 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const pool = new ObstaclePool();
kinds.forEach((k, i) => {
  const x = (i - (kinds.length - 1) / 2) * 2.6;
  if (k === 'bulldozer' || k === 'cycle') {
    const v = k === 'bulldozer' ? buildBulldozer() : buildCycle();
    v.root.position.set(x, 0, -3);
    scene.add(v.root);
    return;
  }
  const v = pool.acquire(k);
  v.root.position.set(x, 0, 0);
  v.tick?.(0.1, 0);
  scene.add(v.root);
  if (v.kind === 'bannerArch' || v.kind === 'boomBarrier' || v.kind === 'scaffold') {
    const g = pool.acquireGantry();
    g.position.set(0, 0, -0.2);
    g.scale.x = (kinds.length * 2.6) / 7.5;
    scene.add(g);
  }
});
const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
if (view === 'side') cam.position.set(kinds.length * 2.2, 3.5, 5);
else cam.position.set(0, 3.2, kinds.length * 2.2 + 3);
cam.lookAt(0, 1.2, -1);
renderer.render(scene, cam);
(window as unknown as { __done: boolean }).__done = true;
