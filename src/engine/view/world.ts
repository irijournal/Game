import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash01 } from '../../sim/rng';
import { THEME_ORDER, type DirectorEventKind, type ThemeId } from '../../sim/types';
import { ROAD_HALF_WIDTH } from '../../sim/constants';
import { basic, box, lambert, mergeStatic, mesh, plane } from './materials';
import { buildProp, CROWD_KINDS } from './scenery';
import { canvasTexture, dustTexture, facadeTexture, grassTexture, roadTexture, sign, stoneTexture, tilesTexture } from './textures';
import { ENV_STYLES, PALETTES, POSTERS, SHOP_NAMES, type EnvStyle, type Palette, type PropKind } from './themes';

const BLOCK = 14;
const VIEW_BEHIND = 24;
const VIEW_AHEAD = 180;
const ROAD_TILE = 13.2;
const SIDEWALK_IN = 7.4;
const BUILD_X = 11;

const tmpColor = new THREE.Color();

function lerpColor(a: number, b: number, t: number): THREE.Color {
  return tmpColor.setHex(a).lerp(new THREE.Color(b), t);
}

function pick<T>(list: readonly [T, number][], r: number): T | null {
  let acc = 0;
  for (const [k, w] of list) {
    acc += w;
    if (r < acc) return k;
  }
  return null;
}

interface Block {
  k: number;
  side: -1 | 1;
  root: THREE.Group;
  building: THREE.Mesh;
  shopSign: THREE.Mesh;
  awning: THREE.Mesh;
  posters: THREE.Mesh[];
  lights: THREE.Mesh;
  props: { kind: PropKind; m: THREE.Matrix4; phase: number }[];
}

/** One InstancedMesh per material of a merged prototype: a prop type costs
 * a couple of draw calls in total, however many blocks show it. */
class PropInstances {
  readonly meshes: THREE.InstancedMesh[] = [];
  private n = 0;
  constructor(proto: THREE.Group, max: number, parent: THREE.Object3D) {
    for (const c of proto.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh) continue;
      const im = new THREE.InstancedMesh(m.geometry, m.material as THREE.Material, max);
      im.count = 0;
      im.frustumCulled = false;
      parent.add(im);
      this.meshes.push(im);
    }
  }
  begin(): void {
    this.n = 0;
  }
  add(mat: THREE.Matrix4): void {
    if (this.n >= this.meshes[0].instanceMatrix.count) return;
    for (const im of this.meshes) im.setMatrixAt(this.n, mat);
    this.n++;
  }
  end(): void {
    for (const im of this.meshes) {
      im.count = this.n;
      im.visible = this.n > 0;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Box with the four walls in one material group and the roof in another
 * (the bottom face is dropped): two draw calls per building instead of six. */
const buildingGeo = (() => {
  let g: THREE.BufferGeometry | null = null;
  return () => {
    if (g) return g;
    const b = new THREE.BoxGeometry(1, 1, 1);
    const idx = b.index!.array;
    const walls: number[] = [];
    const roof: number[] = [];
    // Box groups: +x, -x, +y, -y, +z, -z (6 indices each = 2 triangles).
    for (let f = 0; f < 6; f++) {
      const tri = Array.from(idx.slice(f * 6, f * 6 + 6));
      if (f === 2) roof.push(...tri);
      else if (f !== 3) walls.push(...tri);
    }
    b.setIndex([...walls, ...roof]);
    b.clearGroups();
    b.addGroup(0, walls.length, 0);
    b.addGroup(walls.length, roof.length, 1);
    g = b;
    return g;
  };
})();

/** Everything that is not gameplay: road, scenery, sky, lighting, skyline. */
export class World {
  readonly group = new THREE.Group();
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private roadTex: THREE.Texture;
  private shoulderTex: THREE.Texture;
  private curbTex: THREE.Texture;
  private walkTex: THREE.Texture;
  private walkTextures: Record<EnvStyle['walk'], THREE.Texture>;
  private walkMat: THREE.MeshLambertMaterial;
  private shoulderMat: THREE.MeshLambertMaterial;
  private groundMat: THREE.MeshLambertMaterial;
  private blocks: Block[] = [];
  private blockMap = new Map<string, Block>();
  private props = new Map<PropKind, PropInstances>();
  private tmpM = new THREE.Matrix4();
  private skylines = new Map<ThemeId, THREE.Group>();
  private skylineRoot = new THREE.Group();
  private cityBlocks: THREE.InstancedMesh;
  private cityBase: { x: number; z: number; h: number; w: number }[] = [];
  private cityAmt = 1;
  private cityTarget = 1;
  private time = 0;
  private vikasDecor = new THREE.Group();
  private vikasTex: THREE.Texture;
  private stars: THREE.Points;
  private palette: Palette = { ...PALETTES.lawandorder };
  private target: Palette = PALETTES.lawandorder;
  private paletteFrom: Palette = PALETTES.lawandorder;
  private paletteT = 1;
  private skylineTheme: ThemeId = 'lawandorder';
  readonly fog: THREE.Fog;
  vikasAmount = 0;
  lowQuality = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.fog = new THREE.Fog(PALETTES.lawandorder.fog, 70, 200);
    scene.fog = this.fog;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x887766, 1.5);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(-6, 14, 8);
    this.group.add(this.hemi, this.sun);

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(0x5fb4f2) }, bottom: { value: new THREE.Color(0xffe2b8) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 12), this.skyMat);
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.25 + Math.random() * 1.1;
      sp.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
    this.group.add(this.stars);

    // Road surfaces (static meshes, scrolling textures).
    this.roadTex = roadTexture().clone();
    this.roadTex.needsUpdate = true;
    this.roadTex.repeat.set(1, 300 / ROAD_TILE);
    const road = mesh(plane(ROAD_HALF_WIDTH * 2, 300), lambert(0xffffff, { map: this.roadTex, key: 'road' }), 0, 0, -130);
    road.rotation.x = -Math.PI / 2;
    this.group.add(road);

    this.shoulderTex = dustTexture().clone();
    this.shoulderTex.needsUpdate = true;
    this.shoulderTex.repeat.set(1, 40);
    this.shoulderMat = new THREE.MeshLambertMaterial({ color: 0x6a6670, map: this.shoulderTex });
    const sw = SIDEWALK_IN - 0.15 - ROAD_HALF_WIDTH;
    for (const s of [-1, 1]) {
      const sh = mesh(plane(sw, 300), this.shoulderMat, s * (ROAD_HALF_WIDTH + sw / 2), -0.005, -130);
      sh.rotation.x = -Math.PI / 2;
      this.group.add(sh);
    }
    this.curbTex = canvasTexture(
      'curb',
      8,
      64,
      (ctx) => {
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(0, 0, 8, 32);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 32, 8, 32);
      },
      { repeat: true },
    ).clone();
    this.curbTex.needsUpdate = true;
    this.curbTex.repeat.set(1, 150);
    const curbMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.curbTex });
    for (const s of [-1, 1]) {
      const top = mesh(plane(0.3, 300), curbMat, s * (SIDEWALK_IN - 0.15), 0.225, -130);
      top.rotation.x = -Math.PI / 2;
      const body = mesh(new THREE.BoxGeometry(0.3, 0.22, 300), lambert(0x8d8a84), s * (SIDEWALK_IN - 0.15), 0.11, -130);
      this.group.add(top, body);
    }
    const walkTex = (t: THREE.Texture) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.repeat.set(1, 100);
      return c;
    };
    this.walkTextures = { tiles: walkTex(tilesTexture()), grass: walkTex(grassTexture()), stone: walkTex(stoneTexture()) };
    this.walkTex = this.walkTextures.tiles;
    this.walkMat = new THREE.MeshLambertMaterial({ color: 0xd6c4ad, map: this.walkTex });
    for (const s of [-1, 1]) {
      const w = mesh(plane(BUILD_X + 0.4 - SIDEWALK_IN, 300), this.walkMat, s * ((SIDEWALK_IN + BUILD_X + 0.4) / 2), 0.2, -130);
      w.rotation.x = -Math.PI / 2;
      this.group.add(w);
    }
    this.groundMat = new THREE.MeshLambertMaterial({ color: 0xb7a88f });
    const ground = mesh(new THREE.PlaneGeometry(900, 900), this.groundMat, 0, -0.05, -200);
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    // Aerial filler: low-detail city blocks beyond the street.
    const COUNT = 220;
    this.cityBlocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), COUNT);
    const pal = [0xf4a6a0, 0xf6c98a, 0xa8d8c9, 0xf3e3a1, 0x9cc7ea, 0xe9b8d6, 0xd9c2a8, 0xc8d2dc];
    for (let i = 0; i < COUNT; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (26 + hash01(i, 1) * 110);
      const z = 40 - hash01(i, 2) * 320;
      const h = 6 + hash01(i, 3) * 26;
      const w = 8 + hash01(i, 4) * 10;
      this.cityBase.push({ x, z, h, w });
      this.cityBlocks.setColorAt(i, new THREE.Color(pal[i % pal.length]));
    }
    this.cityBlocks.frustumCulled = false;
    this.group.add(this.cityBlocks);

    // Skylines (crossfaded by theme).
    this.group.add(this.skylineRoot);
    for (const t of THEME_ORDER) {
      const g = this.buildSkyline(t);
      this.skylines.set(t, g);
      this.skylineRoot.add(g);
    }
    this.snapSkyline('lawandorder');

    // Vikas Express flyover decor.
    this.vikasTex = canvasTexture(
      'vikasRail',
      64,
      64,
      (ctx) => {
        ctx.fillStyle = '#d8dde2';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#00d5c0';
        ctx.fillRect(0, 10, 64, 8);
        ctx.fillStyle = '#b8c0c8';
        ctx.fillRect(30, 0, 4, 64);
      },
      { repeat: true },
    ).clone();
    this.vikasTex.needsUpdate = true;
    this.vikasTex.repeat.set(60, 1);
    const railMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.vikasTex, emissive: 0x003a35 });
    for (const s of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(0.4, 1.1, 300), railMat, s * (ROAD_HALF_WIDTH + 0.6), 0.55, -130);
      this.vikasDecor.add(rail);
    }
    const vs = mesh(plane(5.5, 1.1), basic(0xffffff, { map: sign('VIKAS EXPRESS', { bg: '#00a99d', fg: '#fff', sub: 'fictional flyover • game power-up', w: 512, h: 128 }) }), 0, 5.2, -60);
    this.vikasDecor.add(vs);
    this.vikasDecor.visible = false;
    this.group.add(this.vikasDecor);

    this.buildProps();
    for (let i = 0; i < 34; i++) for (const side of [-1, 1] as const) this.blocks.push(this.makeBlock(side));
  }

  // ------------------------------------------------------------- scenery

  private buildProps(): void {
    const max: Partial<Record<PropKind, number>> = { diyas: 40, tree: 50, lampL: 30, lampR: 30, hwLampL: 30, hwLampR: 30 };
    const kinds = new Set<PropKind>(['lampL', 'lampR', 'hwLampL', 'hwLampR', 'thatch', 'dome']);
    for (const env of Object.values(ENV_STYLES)) {
      for (const list of [env.roadside, env.roof, env.open]) for (const [k] of list) kinds.add(k);
      for (const k of env.crowd) kinds.add(k);
    }
    for (const k of kinds) this.props.set(k, new PropInstances(mergeStatic(buildProp(k)), max[k] ?? 34, this.group));
  }

  private makeBlock(side: -1 | 1): Block {
    const root = new THREE.Group();
    const building = new THREE.Mesh(buildingGeo(), [lambert(0xffffff), lambert(0xffffff)]);
    root.add(building);
    const shopSign = mesh(plane(1, 1), lambert(0xffffff));
    root.add(shopSign);
    const awning = mesh(box(1, 0.12, 1.6), lambert(0xffffff));
    root.add(awning);
    const posters: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const p = mesh(plane(1.6, 2.1), lambert(0xffffff));
      root.add(p);
      posters.push(p);
    }
    const lights = mesh(plane(1, 0.6), basic(0xffffff, { map: canvasTexture('bulbs', 256, 32, (c) => {
      c.clearRect(0, 0, 256, 32);
      const cols = ['#ffe066', '#ff6b6b', '#66d9ff', '#9dff7a', '#ff9df5'];
      c.strokeStyle = '#333';
      c.beginPath();
      c.moveTo(0, 8);
      c.quadraticCurveTo(128, 22, 256, 8);
      c.stroke();
      for (let i = 0; i < 16; i++) {
        const x = i * 16 + 8;
        const y = 8 + Math.sin((x / 256) * Math.PI) * 9;
        const g = c.createRadialGradient(x, y + 4, 0, x, y + 4, 7);
        g.addColorStop(0, cols[i % cols.length]);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - 8, y - 4, 16, 16);
      }
    }), transparent: true, key: 'bulbs', side: THREE.DoubleSide }));
    root.add(lights);
    root.visible = false;
    this.group.add(root);
    return { k: -9999, side, root, building, shopSign, awning, posters, lights, props: [] };
  }

  private skinBlock(b: Block, theme: ThemeId, event: DirectorEventKind | null): void {
    const k = b.k;
    const salt = b.side > 0 ? 7 : 3;
    const h = (n: number) => hash01(k * 2 + (b.side > 0 ? 1 : 0), n + salt);
    const pal = PALETTES[theme];
    const env = ENV_STYLES[theme];
    const color = pal.buildings[Math.floor(h(1) * pal.buildings.length)];
    const style = pick(env.facades, h(3)) ?? 'none';
    const [fMin, fMax] = env.floors;
    const floors = fMin + Math.floor(h(2) * (fMax - fMin + 1));
    let width = 9 + h(5) * 4;
    let depth = 10 + h(6) * 4;
    let height = floors * 3.2;
    let inset = 0;
    if (style === 'barrier') {
      width = BLOCK + 0.05;
      depth = 0.5;
      height = 3.4;
    } else if (style === 'terminal') {
      width = BLOCK + 0.05;
      depth = 16;
      height = 8;
    } else if (style === 'hut') {
      width = 5.5;
      depth = 5.5;
      height = 2.7;
      inset = 3;
    }
    b.props = [];
    const prop = (kind: PropKind, x: number, y: number, z: number, rotY = 0, scale = 1) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(scale, scale, scale));
      b.props.push({ kind, m, phase: h(30 + b.props.length) * 6.28 });
    };

    const built = style !== 'none';
    b.building.visible = built;
    const roofX = b.side * (BUILD_X + inset + depth / 2);
    if (built) {
      const facade = facadeTexture(style, style === 'barrier' || style === 'hut' ? 1 : style === 'terminal' ? 2 : floors);
      const roofMat = lambert(lerpColor(color, 0x333333, 0.25).getHex());
      const wallMat = lambert(style === 'barrier' ? 0xffffff : color, { map: facade, emissive: style === 'neon' ? 0x141832 : undefined });
      b.building.material = [wallMat, roofMat];
      b.building.scale.set(depth, height, width);
      b.building.position.set(roofX, height / 2, -BLOCK / 2);
      if (style === 'hut') prop('thatch', roofX, height, -BLOCK / 2);
      else if (style === 'temple' && h(7) < 0.8) prop('shikhara', roofX, height, -BLOCK / 2, 0, 0.9 + h(8) * 0.4);
      else {
        const roof = pick(env.roof, h(9));
        if (roof === 'crane') prop('crane', roofX, height, -BLOCK / 2, b.side > 0 ? 0 : Math.PI);
        else if (roof) prop(roof, roofX + (h(10) * 2 - 1), height, -BLOCK / 2 + (h(11) * 3 - 1.5), h(12) * 6);
      }
    } else {
      const open = pick(env.open, h(9));
      if (open) prop(open, b.side * (BUILD_X + 6.5), 0, -BLOCK / 2, open === 'plane' ? (b.side > 0 ? 0.5 : -0.5) + Math.PI : open === 'hangar' ? -b.side * 0.2 : 0);
    }

    const isShop = env.shops && style === 'shop';
    b.shopSign.visible = isShop;
    b.awning.visible = isShop;
    if (isShop) {
      const name = SHOP_NAMES[Math.floor(h(12) * SHOP_NAMES.length)];
      const bg = ['#c81e1e', '#1f5fbf', '#1f8a4c', '#7a3fb0', '#ff8c1a'][Math.floor(h(13) * 5)];
      b.shopSign.material = lambert(0xffffff, { map: sign(name, { bg, fg: '#fff', border: '#ffd23a', w: 512, h: 128 }) });
      b.shopSign.scale.set(Math.min(width - 1, 7), 1.3, 1);
      b.shopSign.position.set(b.side * (BUILD_X - 0.06), 3.6, -BLOCK / 2);
      b.shopSign.rotation.y = -b.side * Math.PI / 2;
      b.awning.material = lambert([0xff8c1a, 0x1f8a4c, 0x2d6cdf, 0xe8262c][Math.floor(h(14) * 4)]);
      b.awning.scale.set(1, 1, width - 1);
      b.awning.position.set(b.side * (BUILD_X - 0.75), 2.85, -BLOCK / 2);
      b.awning.rotation.z = b.side * 0.25;
    }

    const highway = env.lamp === 'highway';
    if (h(15) < (highway ? 0.55 : 0.75)) prop(highway ? (b.side < 0 ? 'hwLampL' : 'hwLampR') : b.side < 0 ? 'lampL' : 'lampR', b.side * 7.8, 0.2, -1);
    const side = pick(env.roadside, h(16));
    if (side === 'auto') prop('auto', b.side * 9.0, 0.2, -BLOCK * 0.62, h(17) < 0.5 ? 0 : Math.PI);
    else if (side === 'stall' || side === 'tent') prop(side, b.side * 9.3, 0.2, -BLOCK * 0.62, -b.side * Math.PI / 2);
    // Angled towards the road and the oncoming camera.
    else if (side === 'billboard') prop('billboard', b.side * 9.6, 0.2, -BLOCK * 0.62, b.side > 0 ? -2.36 : -0.785);
    else if (side === 'diyas') prop('diyas', b.side * 8.4, 0.2, -BLOCK * 0.62);
    else if (side) prop(side, b.side * 9.2, 0.2, -BLOCK * 0.62, h(19) * 6);
    if (env.crowd.length && h(26) < env.crowdChance) {
      const kind = env.crowd[Math.floor(h(27) * env.crowd.length)];
      prop(kind, b.side * 8.7, 0.2, -BLOCK * 0.25, Math.atan2(-b.side, 0.6));
    }

    const flatWall = style === 'shop' || style === 'apartment' || style === 'haveli' || style === 'barrier';
    const posterCount = !flatWall ? 0 : event === 'posterAlley' ? 3 : h(18) < env.posters ? 1 : 0;
    b.posters.forEach((p, i) => {
      p.visible = i < posterCount;
      if (!p.visible) return;
      const [text, bg, fg] = POSTERS[Math.floor(h(20 + i) * POSTERS.length)];
      p.material = lambert(0xffffff, { map: sign(text, { bg, fg, border: '#ffffff', sub: 'UP RUN game slogan', subColor: fg, w: 256, h: 340 }) });
      p.position.set(b.side * (BUILD_X - 0.05), isShop ? 5.6 : 1.55, -BLOCK * (0.2 + i * 0.3));
      p.rotation.y = -b.side * Math.PI / 2;
    });
    b.lights.visible = built && style !== 'barrier' && style !== 'hut' && (env.lights || event === 'posterAlley');
    b.lights.scale.set(width, 1.2, 1);
    b.lights.position.set(b.side * (BUILD_X - 0.1), Math.min(6.8, height - 0.6), -BLOCK / 2);
    b.lights.rotation.y = -b.side * Math.PI / 2;
  }

  private buildSkyline(theme: ThemeId): THREE.Group {
    const g = new THREE.Group();
    const color = PALETTES[theme].skyline;
    const mat = new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: 1, depthWrite: false });
    const parts: THREE.BufferGeometry[] = [];
    const add = (shape: THREE.Shape, x: number, s = 1, y = 0) => {
      const sg = new THREE.ShapeGeometry(shape);
      sg.scale(s, s, s);
      sg.translate(x, y - 2, 0);
      parts.push(sg.index ? sg.toNonIndexed() : sg);
    };
    const rect = (w: number, h: number) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.closePath();
      return s;
    };
    const domed = (w: number, h: number, dome: number) => {
      const s = rect(w, h);
      const d = new THREE.Shape();
      d.moveTo(-dome, h);
      d.absarc(0, h, dome, Math.PI, 0, true);
      d.closePath();
      return [s, d];
    };
    const gateway = () => {
      // An arched ceremonial gateway, inspired by Lucknow's grand gates.
      const s = new THREE.Shape();
      s.moveTo(-22, 0);
      s.lineTo(-22, 26);
      s.quadraticCurveTo(-14, 34, 0, 40);
      s.quadraticCurveTo(14, 34, 22, 26);
      s.lineTo(22, 0);
      s.lineTo(9, 0);
      s.lineTo(9, 14);
      s.absarc(0, 14, 9, 0, Math.PI, false);
      s.lineTo(-9, 0);
      s.closePath();
      return s;
    };
    const poly = (pts: [number, number][]) => {
      const s = new THREE.Shape();
      s.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
      s.closePath();
      return s;
    };
    const hills = (amp: number, base: number, seed: number) => {
      const s = new THREE.Shape();
      s.moveTo(-220, 0);
      for (let x = -220; x <= 220; x += 10) s.lineTo(x, base + amp * (0.5 + 0.5 * Math.sin(x * 0.03 + seed) * Math.cos(x * 0.011 + seed * 2)));
      s.lineTo(220, 0);
      s.closePath();
      return s;
    };
    const shikhara = (w: number, h: number) => {
      // Curvilinear temple spire (stylised, not a depiction of a specific temple).
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(-w / 2, h * 0.3);
      s.quadraticCurveTo(-w * 0.48, h * 0.85, 0, h);
      s.quadraticCurveTo(w * 0.48, h * 0.85, w / 2, h * 0.3);
      s.lineTo(w / 2, 0);
      s.closePath();
      return s;
    };
    const tower = (x: number, w: number, h: number) => {
      add(rect(w, h), x);
      domed(0.1, h, w * 0.9).slice(1).forEach((s) => add(s, x));
    };
    const pylon = (x: number, h: number) => {
      add(poly([[-3, 0], [-0.4, h], [0.4, h], [3, 0], [2.2, 0], [0, h * 0.8], [-2.2, 0]]), x);
      add(rect(12, 0.8), x, 1, h * 0.8);
      add(rect(8, 0.8), x, 1, h * 0.92);
    };
    const tree = (x: number, r: number, h: number) => {
      add(rect(r * 0.25, h), x);
      const c = new THREE.Shape();
      c.absarc(0, h + r * 0.6, r, 0, Math.PI * 2, false);
      add(c, x);
    };
    if (theme === 'lawandorder') {
      add(gateway(), -40, 1);
      for (const [x, w, h, d] of [
        [30, 26, 16, 12],
        [75, 18, 12, 8],
        [-95, 20, 14, 9],
      ]) domed(w, h, d).forEach((s) => add(s, x));
      for (const x of [14, 48, -70, 100]) {
        add(rect(2.5, 34), x);
        domed(0.1, 34, 2.4).slice(1).forEach((s) => add(s, x));
      }
      add(rect(6, 48), -120);
      domed(0.1, 48, 3.5).slice(1).forEach((s) => add(s, -120));
    }
    if (theme === 'expressway') {
      add(hills(10, 4, 1), 0);
      for (const x of [-150, -60, 30, 150]) pylon(x, 34);
      // A distant domed mausoleum silhouette (inspired by Agra's skyline).
      add(rect(64, 6), 95);
      add(rect(30, 20), 95, 1, 6);
      domed(0.1, 26, 11).slice(1).forEach((s) => add(s, 95));
      add(rect(1, 6), 95, 1, 36);
      for (const dx of [-27, 27]) tower(95 + dx, 2.4, 32);
    }
    if (theme === 'ayodhya') {
      // River ghats: stepped embankment.
      add(poly([[-220, 0], [-220, 6], [220, 6], [220, 0]]), 0);
      for (const [x, w, h] of [
        [-120, 16, 34],
        [-40, 26, 52],
        [30, 18, 38],
        [95, 22, 44],
        [160, 14, 30],
      ]) {
        add(rect(w * 1.4, h * 0.3), x, 1, 4);
        add(shikhara(w, h), x, 1, 4 + h * 0.3);
        add(rect(0.6, 8), x, 1, 4 + h * 1.3);
        add(poly([[0, 0], [6, -1.5], [0, -3]]), x + 0.3, 1, 4 + h * 1.3 + 8);
      }
      for (const x of [-80, -5, 60, 130]) domed(10, 14, 5).forEach((s) => add(s, x, 1, 4));
    }
    if (theme === 'airport') {
      add(poly([[-120, 0], [-120, 10], [-60, 16], [0, 12], [60, 16], [120, 10], [120, 0]]), -20);
      add(rect(4, 42), 90);
      add(poly([[-7, 0], [7, 0], [9, 6], [-9, 6]]), 90, 1, 42);
      add(rect(0.8, 8), 90, 1, 48);
      for (const x of [-170, 150, 190]) domed(0.1, 0, 14).slice(1).forEach((s) => add(s, x));
      // A departing airliner high in the sky.
      add(poly([[-16, 0], [12, 1.5], [16, 3], [12, 4], [-14, 3.2], [-18, 8], [-21, 8], [-19, 2]]), -90, 1, 60);
      add(poly([[-4, 2], [6, 2], [-2, -6], [-6, -6]]), -88, 1, 60);
    }
    if (theme === 'kisan') {
      add(hills(14, 2, 4), 0);
      for (let i = 0; i < 14; i++) tree(-190 + i * 29 + hash01(i, 50) * 10, 4 + hash01(i, 51) * 3, 6 + hash01(i, 52) * 5);
      for (const x of [-110, 20, 140]) {
        add(rect(12, 6), x);
        add(poly([[-8, 0], [8, 0], [0, 6]]), x, 1, 6);
      }
    }
    if (theme === 'jankalyan') {
      for (let i = 0; i < 22; i++) {
        const w = 10 + hash01(i, 60) * 8;
        const h = 10 + hash01(i, 61) * 18;
        add(rect(w, h), -200 + i * 19);
        if (hash01(i, 62) < 0.25) add(shikhara(5, 12), -200 + i * 19, 1, h);
      }
      add(rect(2, 26), 70);
      add(rect(3, 26), 64);
      add(rect(3, 26), 76);
      add(poly([[-9, 0], [9, 0], [9, 8], [-9, 8]]), 70, 1, 26);
      add(poly([[-9, 0], [9, 0], [0, 4]]), 70, 1, 34);
    }
    if (theme === 'startup') {
      for (let i = 0; i < 16; i++) {
        const w = 8 + hash01(i, 40) * 14;
        const h = 20 + hash01(i, 41) * 55;
        add(rect(w, h), -170 + i * 22);
      }
      const saw: [number, number][] = [[-60, 0], [-60, 10]];
      for (let x = -60; x < 60; x += 12) saw.push([x + 10, 16], [x + 12, 10]);
      saw.push([60, 0]);
      add(poly(saw), 40);
      for (const x of [-20, -8, 110]) add(rect(3, 36), x);
      const crane = new THREE.Shape();
      crane.moveTo(0, 0);
      crane.lineTo(1.5, 0);
      crane.lineTo(1.5, 70);
      crane.lineTo(30, 70);
      crane.lineTo(30, 72);
      crane.lineTo(-12, 72);
      crane.lineTo(-12, 70);
      crane.lineTo(0, 70);
      crane.closePath();
      add(crane, 60);
      add(crane, -90);
    }
    if (theme === 'viksit') {
      for (let i = 0; i < 18; i++) {
        const w = 6 + hash01(i, 70) * 10;
        const h = 40 + hash01(i, 71) * 70;
        const x = -190 + i * 22;
        add(poly([[-w / 2, 0], [w / 2, 0], [w * 0.3, h], [-w * 0.3, h]]), x);
        if (hash01(i, 72) < 0.5) add(rect(0.6, 18), x, 1, h);
      }
      // A ring-shaped landmark arch.
      const ring = new THREE.Shape();
      ring.absarc(0, 40, 36, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 40, 30, 0, Math.PI * 2, true);
      ring.holes.push(hole);
      add(ring, 20);
      for (const x of [-140, 150]) {
        add(rect(1.4, 40), x);
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + 0.3;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const pts: [number, number][] = [[-0.8, 0], [0.8, 0], [0.3, 16], [-0.3, 16]];
          add(poly(pts.map(([px, py]) => [px * ca - py * sa, px * sa + py * ca] as [number, number])), x, 1, 40);
        }
      }
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (merged) g.add(new THREE.Mesh(merged, mat));
    g.position.set(0, 0, -260);
    return g;
  }

  // -------------------------------------------------------------- update

  /** Forget block skins so the street is rebuilt for a new run/route. */
  resetBlocks(): void {
    for (const b of this.blockMap.values()) {
      b.root.visible = false;
      b.k = -9999;
    }
    this.blockMap.clear();
  }

  /** Show exactly one skyline, without the crossfade (run starts, menus). */
  private snapSkyline(theme: ThemeId): void {
    for (const [t, g] of this.skylines) {
      const m = (g.children[0] as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined;
      if (m) m.opacity = t === theme ? 1 : 0;
      g.visible = t === theme;
    }
  }

  setTheme(theme: ThemeId, instant = false): void {
    const p = PALETTES[theme];
    if (p === this.target && !instant) return;
    this.paletteFrom = { ...this.palette };
    this.target = p;
    this.paletteT = instant ? 1 : 0;
    if (instant) this.applyPalette(1);
    this.skylineTheme = theme;
    if (instant) this.snapSkyline(theme);
    const env = ENV_STYLES[theme];
    this.walkTex = this.walkTextures[env.walk];
    if (this.walkMat.map !== this.walkTex) {
      this.walkMat.map = this.walkTex;
      this.walkMat.needsUpdate = true;
    }
    this.cityTarget = env.city;
    if (instant) this.cityAmt = env.city;
  }

  private applyPalette(t: number): void {
    const a = this.paletteFrom;
    const b = this.vikasAmount > 0 ? blendPalette(this.target, PALETTES.vikas, this.vikasAmount) : this.target;
    const mix = (x: number, y: number) => lerpColor(x, y, t).getHex();
    const p = this.palette;
    p.skyTop = mix(a.skyTop, b.skyTop);
    p.skyBottom = mix(a.skyBottom, b.skyBottom);
    p.fog = mix(a.fog, b.fog);
    p.hemiSky = mix(a.hemiSky, b.hemiSky);
    p.hemiGround = mix(a.hemiGround, b.hemiGround);
    p.sun = mix(a.sun, b.sun);
    p.sidewalk = mix(a.sidewalk, b.sidewalk);
    p.shoulder = mix(a.shoulder, b.shoulder);
    p.ground = mix(a.ground, b.ground);
    p.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t;
    p.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
    p.fogNear = a.fogNear + (b.fogNear - a.fogNear) * t;
    p.fogFar = a.fogFar + (b.fogFar - a.fogFar) * t;
    (this.skyMat.uniforms.top.value as THREE.Color).setHex(p.skyTop);
    (this.skyMat.uniforms.bottom.value as THREE.Color).setHex(p.skyBottom);
    this.fog.color.setHex(p.fog);
    this.fog.near = p.fogNear;
    this.fog.far = this.lowQuality ? Math.min(p.fogFar, 150) : p.fogFar;
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.sun.color.setHex(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.walkMat.color.setHex(p.sidewalk);
    this.shoulderMat.color.setHex(p.shoulder);
    this.groundMat.color.setHex(p.ground);
    const night = this.target.night ? t : a.night ? 1 - t : 0;
    (this.stars.material as THREE.PointsMaterial).opacity = night;
  }

  /**
   * @param d       runner's track position
   * @param themeAt base theme at a track position (for scenery ahead)
   * @param eventAt director event at a track position (poster alley etc.)
   */
  update(dt: number, d: number, camera: THREE.Camera, themeAt: (s: number) => ThemeId, eventAt: (s: number) => DirectorEventKind | null, vikas: boolean): void {
    // Palette transition.
    const vTarget = vikas ? 1 : 0;
    const prevV = this.vikasAmount;
    this.vikasAmount += Math.max(-dt * 1.5, Math.min(dt * 1.5, vTarget - this.vikasAmount));
    if (this.paletteT < 1 || prevV !== this.vikasAmount) {
      this.paletteT = Math.min(1, this.paletteT + dt / 2.2);
      this.applyPalette(this.paletteT);
    }
    this.vikasDecor.visible = this.vikasAmount > 0.05;
    this.vikasDecor.position.y = (1 - this.vikasAmount) * -1.2;

    // Scroll surfaces.
    this.roadTex.offset.y = (d / ROAD_TILE) % 1;
    this.shoulderTex.offset.y = ((d / 300) * 40) % 1;
    this.curbTex.offset.y = ((d / 300) * 150) % 1;
    for (const t of Object.values(this.walkTextures)) t.offset.y = ((d / 300) * 100) % 1;
    this.vikasTex.offset.x = ((d / 300) * 60) % 1;

    // Sky and skyline follow the camera.
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.skylineRoot.position.set(camera.position.x * 0.9, 0, camera.position.z);
    for (const [t, g] of this.skylines) {
      const want = this.vikasAmount > 0.5 ? t === 'startup' : t === this.skylineTheme;
      const m = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const o = Math.max(0, Math.min(1, m.opacity + (want ? dt : -dt) * 1.2));
      m.opacity = o;
      g.visible = o > 0.01;
    }

    // City filler blocks scroll and wrap; they shrink into low farm sheds
    // in rural environments.
    this.time += dt;
    this.cityAmt += Math.max(-dt * 0.5, Math.min(dt * 0.5, this.cityTarget - this.cityAmt));
    const hs = 0.08 + 0.92 * this.cityAmt;
    (this.cityBlocks.material as THREE.MeshLambertMaterial).color.copy(lerpColor(0x9ab870, 0xffffff, this.cityAmt));
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < this.cityBase.length; i++) {
      const c = this.cityBase[i];
      let z = c.z + (d % 320);
      if (z > 60) z -= 320;
      const ch = c.h * hs;
      m4.makeScale(c.w, ch, c.w);
      m4.setPosition(c.x, ch / 2 - 0.05, z);
      this.cityBlocks.setMatrixAt(i, m4);
    }
    this.cityBlocks.instanceMatrix.needsUpdate = true;

    // Street blocks: assign pooled views to the visible block indices.
    const kMin = Math.floor((d - VIEW_BEHIND) / BLOCK);
    const kMax = Math.floor((d + (this.lowQuality ? 130 : VIEW_AHEAD)) / BLOCK);
    const needed = new Set<string>();
    for (let k = kMin; k <= kMax; k++) for (const side of [-1, 1]) needed.add(`${k}:${side}`);
    for (const [key, b] of this.blockMap) {
      if (!needed.has(key)) {
        b.root.visible = false;
        b.k = -9999;
        this.blockMap.delete(key);
      }
    }
    for (let k = kMin; k <= kMax; k++) {
      for (const side of [-1, 1] as const) {
        const key = `${k}:${side}`;
        let b = this.blockMap.get(key);
        if (!b) {
          b = this.blocks.find((x) => x.k === -9999 && x.side === side);
          if (!b) continue;
          b.k = k;
          this.skinBlock(b, themeAt(k * BLOCK), eventAt(k * BLOCK));
          b.root.visible = true;
          this.blockMap.set(key, b);
        }
        b.root.position.z = -(k * BLOCK - d);
      }
    }
    for (const pi of this.props.values()) pi.begin();
    for (const b of this.blockMap.values()) {
      for (const p of b.props) {
        this.tmpM.copy(p.m);
        this.tmpM.elements[14] += b.root.position.z;
        // Cheering citizens bounce.
        if (CROWD_KINDS.has(p.kind)) this.tmpM.elements[13] += Math.abs(Math.sin(this.time * 6 + p.phase)) * 0.22;
        this.props.get(p.kind)!.add(this.tmpM);
      }
    }
    for (const pi of this.props.values()) pi.end();
  }
}

function blendPalette(a: Palette, b: Palette, t: number): Palette {
  const mix = (x: number, y: number) => lerpColor(x, y, t).getHex();
  return {
    ...a,
    skyTop: mix(a.skyTop, b.skyTop),
    skyBottom: mix(a.skyBottom, b.skyBottom),
    fog: mix(a.fog, b.fog),
    hemiSky: mix(a.hemiSky, b.hemiSky),
    hemiGround: mix(a.hemiGround, b.hemiGround),
    sun: mix(a.sun, b.sun),
    sidewalk: mix(a.sidewalk, b.sidewalk),
    shoulder: mix(a.shoulder, b.shoulder),
    ground: mix(a.ground, b.ground),
    hemiIntensity: a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t,
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
  };
}

