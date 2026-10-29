import * as THREE from 'three';
import { basic, box, cone, cyl, geo, lambert, mesh, sphere, toon } from './materials';
import { canvasTexture, fieldTexture, sign } from './textures';
import type { PropKind } from './themes';
import { buildAutoRickshaw } from './vehicles';

const SKIN = 0xc68a5a;

export interface CitizenLook {
  shirt: number;
  pants: number;
  hat?: { kind: 'turban' | 'hardhat' | 'cap' | 'scarf'; color: number };
  /** Draped garment (sari / dhoti) instead of trousers. */
  drape?: boolean;
}

/**
 * Fictional citizens who cheer from the roadside (farmers, workers,
 * engineers, police, students, shopkeepers). Built facing +z, arms raised.
 */
export function citizen(look: CitizenLook, x = 0, z = 0, scale = 1, armsUp = true): THREE.Group {
  const g = new THREE.Group();
  const shirt = toon(look.shirt);
  const pants = toon(look.pants);
  if (look.drape) g.add(mesh(cyl(0.2, 0.3, 0.85, 10), pants, 0, 0.42, 0));
  else for (const s of [-1, 1]) g.add(mesh(cyl(0.075, 0.07, 0.85, 6), pants, s * 0.11, 0.42, 0));
  g.add(mesh(box(0.44, 0.6, 0.26), shirt, 0, 1.12, 0));
  g.add(mesh(sphere(0.16, 10, 8), toon(SKIN), 0, 1.6, 0));
  for (const s of [-1, 1]) {
    const arm = mesh(cyl(0.05, 0.05, 0.62, 6), shirt, s * 0.32, armsUp ? 1.62 : 1.05, 0);
    arm.rotation.z = armsUp ? s * -0.45 : s * 0.12;
    g.add(arm);
    if (armsUp) g.add(mesh(sphere(0.06, 6, 5), toon(SKIN), s * 0.45, 1.92, 0));
  }
  const hat = look.hat;
  if (hat?.kind === 'turban') {
    const t = mesh(sphere(0.19, 10, 6), toon(hat.color), 0, 1.72, 0);
    t.scale.set(1, 0.6, 1);
    g.add(t);
  } else if (hat?.kind === 'hardhat') {
    g.add(mesh(new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(hat.color), 0, 1.68, 0));
    g.add(mesh(cyl(0.22, 0.22, 0.03, 12), toon(hat.color), 0, 1.68, 0));
  } else if (hat?.kind === 'cap') {
    g.add(mesh(cyl(0.16, 0.17, 0.1, 10), toon(hat.color), 0, 1.75, 0));
    g.add(mesh(box(0.2, 0.02, 0.14), toon(hat.color), 0, 1.71, 0.14));
  } else if (hat?.kind === 'scarf') {
    g.add(mesh(box(0.46, 0.12, 0.3), toon(hat.color), 0, 1.4, 0));
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}

export const LOOKS = {
  farmer: { shirt: 0xf6f2e8, pants: 0xf6f2e8, drape: true, hat: { kind: 'turban', color: 0x2a9a4a } },
  farmerWoman: { shirt: 0xf2b630, pants: 0x2a9a4a, drape: true },
  farmerSaffron: { shirt: 0xf6f2e8, pants: 0x8a7a66, hat: { kind: 'turban', color: 0xff8c1a } },
  shopkeeper: { shirt: 0x2d6cdf, pants: 0x333333 },
  student: { shirt: 0xffffff, pants: 0x1f2f6a, hat: { kind: 'scarf', color: 0xc81e1e } },
  woman: { shirt: 0xe85a9a, pants: 0xe85a9a, drape: true },
  pilgrim: { shirt: 0xff8c1a, pants: 0xffffff, hat: { kind: 'scarf', color: 0xffd23a } },
  elder: { shirt: 0xffffff, pants: 0xffffff, drape: true, hat: { kind: 'cap', color: 0xffffff } },
  engineer: { shirt: 0x4a8ad8, pants: 0xb8a070, hat: { kind: 'hardhat', color: 0xffffff } },
  worker: { shirt: 0xff7a1a, pants: 0x34495e, hat: { kind: 'hardhat', color: 0xffd23a } },
  police: { shirt: 0xc8a96a, pants: 0xc8a96a, hat: { kind: 'cap', color: 0x24345a } },
} satisfies Record<string, CitizenLook>;

function crowd(looks: CitizenLook[]): THREE.Group {
  const g = new THREE.Group();
  looks.forEach((l, i) => g.add(citizen(l, (i - (looks.length - 1) / 2) * 0.75, (i % 2) * 0.35)));
  return g;
}

function lamp(side: -1 | 1, tall: boolean): THREE.Group {
  const g = new THREE.Group();
  const h = tall ? 7.2 : 5.2;
  const pole = toon(tall ? 0x9aa3ad : 0x3a3f47);
  g.add(mesh(cyl(0.07, 0.11, h, 8), pole, 0, h / 2, 0));
  g.add(mesh(box(tall ? 2.2 : 1.4, 0.08, 0.08), pole, -side * (tall ? 1.05 : 0.65), h - 0.05, 0));
  g.add(mesh(box(0.55, 0.15, 0.3), toon(0xfff3b0, { emissive: 0x665a20 }), -side * (tall ? 2.0 : 1.3), h - 0.15, 0));
  return g;
}

function tree(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.16, 0.22, 2.4, 8), toon(0x7a5230), 0, 1.2, 0));
  g.add(mesh(sphere(1.4, 10, 8), toon(0x3f9a45), 0, 3.1, 0));
  g.add(mesh(sphere(1.0, 10, 8), toon(0x4fb555), 0.6, 3.7, 0.3));
  return g;
}

function palm(): THREE.Group {
  const g = new THREE.Group();
  const trunk = mesh(cyl(0.13, 0.2, 5, 8), toon(0x8a6a44), 0, 2.5, 0);
  trunk.rotation.z = 0.06;
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(box(0.35, 0.06, 2.1), toon(0x2f9a4a), 0, 5, 0);
    leaf.rotation.set(0.5, (i / 6) * Math.PI * 2, 0, 'YXZ');
    leaf.translateZ(0.9);
    g.add(leaf);
  }
  return g;
}

function stall(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(1.8, 0.9, 1.1), toon(0x8a5a2b), 0, 0.45, 0));
  g.add(
    mesh(
      box(2.2, 0.08, 1.6),
      lambert(0xffffff, {
        map: canvasTexture('awnSaffron', 64, 16, (c) => {
          for (let i = 0; i < 8; i++) {
            c.fillStyle = i % 2 ? '#fff' : '#ff8c1a';
            c.fillRect(i * 8, 0, 8, 16);
          }
        }),
      }),
      0,
      2.1,
      0,
    ),
  );
  for (const x of [-1, 1]) g.add(mesh(cyl(0.04, 0.04, 2.1, 6), toon(0x555555), x * 1.0, 1.05, 0.7));
  g.add(mesh(cyl(0.18, 0.15, 0.3, 10), toon(0xb0b0b0), 0.4, 1.05, 0));
  for (let i = 0; i < 4; i++) g.add(mesh(sphere(0.12, 6, 5), toon([0xffa31a, 0xff5a3a, 0xffd23a, 0x6ac04a][i]), -0.6 + i * 0.25, 1.0, 0.1));
  return g;
}

function shikhara(): THREE.Group {
  // Stylised temple spire (nagara style): stacked, tapering tiers + kalash + pennant.
  const g = new THREE.Group();
  const stone = toon(0xf0c48a);
  g.add(mesh(box(3.2, 1.2, 3.2), stone, 0, 0.6, 0));
  for (let i = 0; i < 5; i++) {
    const r = 1.5 - i * 0.26;
    g.add(mesh(cyl(r * 0.85, r, 1.0, 8), i % 2 ? stone : toon(0xe6b07a), 0, 1.7 + i * 0.95, 0));
  }
  g.add(mesh(sphere(0.32, 10, 8), toon(0xffc300, { emissive: 0x4a3000 }), 0, 6.6, 0));
  g.add(mesh(cyl(0.03, 0.03, 1.4, 6), toon(0x7a5230), 0, 7.4, 0));
  const flag = mesh(cone(0.35, 0.9, 3), toon(0xff7a00), 0.42, 7.85, 0);
  flag.rotation.z = -Math.PI / 2;
  g.add(flag);
  return g;
}

function chhatri(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-0.6, -0.6],
    [0.6, -0.6],
    [-0.6, 0.6],
    [0.6, 0.6],
  ])
    g.add(mesh(cyl(0.08, 0.08, 1.2, 6), toon(0xf0d2a1), x, 0.6, z));
  g.add(mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xe9c18f), 0, 1.2, 0));
  return g;
}

function diyas(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(0.5, 0.25, 4.2), toon(0xc98f5e), 0, 0.12, 0));
  const flame = basic(0xffb020);
  for (let i = 0; i < 7; i++) {
    const z = -1.8 + i * 0.6;
    g.add(mesh(cyl(0.12, 0.07, 0.08, 8), toon(0xb8562a), 0, 0.29, z));
    g.add(mesh(cone(0.05, 0.16, 6), flame, 0, 0.41, z));
  }
  return g;
}

function flags(): THREE.Group {
  // Plain saffron pennants on poles (no party or national symbols).
  const g = new THREE.Group();
  for (const z of [-1.2, 1.2]) {
    g.add(mesh(cyl(0.04, 0.05, 4.2, 6), toon(0xdddddd), 0, 2.1, z));
    const p = mesh(cone(0.5, 1.4, 3), toon(z < 0 ? 0xff8c1a : 0xffb347), 0, 3.6, z + 0.7);
    p.rotation.x = Math.PI / 2;
    p.scale.set(1, 1, 0.12);
    g.add(p);
  }
  return g;
}

function hangar(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    geo('hangarShell', () => {
      const c = new THREE.CylinderGeometry(5, 5, 14, 18, 1, false, -Math.PI / 2, Math.PI);
      c.rotateX(Math.PI / 2);
      return c;
    }),
    toon(0xd8dee6),
  );
  g.add(shell);
  g.add(mesh(box(6, 4, 0.1), toon(0x56606c), 0, 2, 7.02));
  for (let i = 0; i < 5; i++) g.add(mesh(box(0.08, 4, 0.12), toon(0x9aa3ad), -2.4 + i * 1.2, 2, 7.05));
  return g;
}

function plane(): THREE.Group {
  // Generic airliner (no airline livery).
  const g = new THREE.Group();
  const white = toon(0xf6f8fa);
  const body = mesh(cyl(0.9, 0.9, 11, 14), white, 0, 2.2, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = mesh(sphere(0.9, 14, 10), white, 0, 2.2, 5.5);
  nose.scale.set(1, 1, 1.6);
  g.add(nose);
  const tailCone = mesh(cone(0.9, 2.6, 14), white, 0, 2.4, -6.7);
  tailCone.rotation.x = -Math.PI / 2;
  g.add(tailCone);
  g.add(mesh(box(13, 0.18, 2.2), toon(0xe2e6ea), 0, 1.9, 0.4));
  g.add(mesh(box(4.6, 0.12, 1.2), toon(0xe2e6ea), 0, 2.6, -6.6));
  const fin = mesh(box(0.16, 2.6, 2), toon(0xff8c1a), 0, 3.8, -6.9);
  fin.rotation.x = -0.35;
  g.add(fin);
  g.add(mesh(box(0.05, 0.25, 9), toon(0x1f8a4c), 0.9, 2.3, 0));
  g.add(mesh(box(0.05, 0.25, 9), toon(0x1f8a4c), -0.9, 2.3, 0));
  for (const s of [-1, 1]) {
    const eng = mesh(cyl(0.42, 0.42, 1.6, 12), toon(0xb8c0c8), s * 3, 1.45, 1.2);
    eng.rotation.x = Math.PI / 2;
    g.add(eng);
  }
  for (const [x, z] of [
    [0, 4],
    [-1.4, -0.4],
    [1.4, -0.4],
  ])
    g.add(mesh(cyl(0.25, 0.25, 0.3, 10), toon(0x222222), x, 0.3, z), mesh(box(0.08, 1.1, 0.08), toon(0x9aa3ad), x, 0.9, z));
  return g;
}

function radar(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.1, 0.15, 2.2, 8), toon(0x9aa3ad), 0, 1.1, 0));
  const dish = mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), toon(0xffffff, { side: THREE.DoubleSide }), 0, 2.4, 0);
  dish.rotation.x = -1.1;
  g.add(dish);
  return g;
}

function field(color: number): THREE.Group {
  const g = new THREE.Group();
  const tex = fieldTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(3, 1);
  g.add(mesh(box(11, 0.7, 13), lambert(color, { map: tex, key: 'field' }), 0, 0.35, 0));
  g.add(mesh(box(11.2, 0.25, 0.3), toon(0x8a6a44), 0, 0.12, 6.6));
  return g;
}

function haystack(): THREE.Group {
  const g = new THREE.Group();
  const hay = toon(0xe8c45a);
  g.add(mesh(cyl(1.4, 1.6, 1.6, 12), hay, 0, 0.8, 0));
  g.add(mesh(cone(1.5, 1.6, 12), hay, 0, 2.4, 0));
  g.add(mesh(cyl(1.0, 1.1, 1.2, 12), hay, 3, 0.6, 1.5));
  g.add(mesh(cone(1.05, 1.1, 12), hay, 3, 1.75, 1.5));
  return g;
}

function thatch(): THREE.Group {
  const g = new THREE.Group();
  const roof = mesh(cone(4.4, 2.2, 4), toon(0xc9a24a), 0, 1.1, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return g;
}

function tubewell(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(1.6, 1.4, 1.6), toon(0xb86a4a), 0, 0.7, 0));
  g.add(mesh(box(1.8, 0.12, 1.8), toon(0x8a8a8a), 0, 1.45, 0));
  const pipe = mesh(cyl(0.12, 0.12, 1.2, 8), toon(0x6a6a6a), 0, 0.9, 1.2);
  pipe.rotation.x = Math.PI / 2;
  g.add(pipe);
  g.add(mesh(box(1.4, 0.3, 1.0), toon(0x5aa8e0, { emissive: 0x0a2a40 }), 0, 0.15, 2.1));
  return g;
}

function waterTower(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [-0.8, 0.8],
    [0.8, 0.8],
  ])
    g.add(mesh(box(0.15, 3, 0.15), toon(0x9aa3ad), x, 1.5, z));
  g.add(mesh(cyl(1.3, 1.3, 1.8, 14), toon(0x5aa8e0), 0, 3.9, 0));
  g.add(mesh(cone(1.35, 0.6, 14), toon(0xffffff), 0, 5.1, 0));
  return g;
}

function tent(): THREE.Group {
  const g = new THREE.Group();
  const roof = mesh(
    cone(2.0, 1.4, 4),
    lambert(0xffffff, {
      map: canvasTexture('tentStripe', 64, 16, (c) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = ['#ff8c1a', '#ffffff', '#1f8a4c', '#ffffff'][i % 4];
          c.fillRect(i * 8, 0, 8, 16);
        }
      }),
    }),
    0,
    2.6,
    0,
  );
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  for (const [x, z] of [
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ])
    g.add(mesh(cyl(0.04, 0.04, 1.9, 6), toon(0x777777), x, 0.95, z));
  g.add(mesh(box(1.6, 0.75, 0.6), toon(0xffffff), 0, 0.38, 0.4));
  g.add(mesh(plane2(1.6, 0.4), basic(0xffffff, { map: sign('JAN SEVA CAMP', { bg: '#1f8a4c', fg: '#fff', w: 256, h: 64 }) }), 0, 0.6, 0.71));
  return g;
}

const plane2 = (w: number, h: number) => geo(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h));

function chimney(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.55 - i * 0.04, 0.6 - i * 0.04, 2, 10), toon(i % 2 ? 0xffffff : 0xd04a3a), 0, 1 + i * 2, 0));
  return g;
}

function solar(): THREE.Group {
  const g = new THREE.Group();
  const panelTex = canvasTexture('solarCells', 64, 32, (c) => {
    c.fillStyle = '#1e3a7a';
    c.fillRect(0, 0, 64, 32);
    c.strokeStyle = '#8fb0e8';
    c.lineWidth = 1;
    for (let x = 0; x <= 64; x += 8) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 32);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, 16);
    c.lineTo(64, 16);
    c.stroke();
  });
  for (let i = 0; i < 3; i++) {
    const p = mesh(box(2.4, 0.06, 1.2), lambert(0xffffff, { map: panelTex }), 0, 0.6, -2 + i * 2);
    p.rotation.x = -0.45;
    g.add(p, mesh(box(0.08, 0.6, 0.08), toon(0x9aa3ad), 0, 0.3, -2 + i * 2));
  }
  return g;
}

function turbine(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.2, 7, 8), toon(0xf0f0f0), 0, 3.5, 0));
  g.add(mesh(box(0.4, 0.4, 0.9), toon(0xf0f0f0), 0, 7, 0.2));
  for (let i = 0; i < 3; i++) {
    const b = mesh(box(0.22, 3, 0.06), toon(0xffffff), 0, 7, 0.68);
    b.rotation.z = (i / 3) * Math.PI * 2;
    b.translateY(1.5);
    g.add(b);
  }
  return g;
}

function neonPylon(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.08, 0.12, 6, 8), toon(0x30304a), 0, 3, 0));
  const ring = mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 20), basic(0x7af7ff), 0, 5.4, 0);
  g.add(ring);
  g.add(mesh(box(0.12, 4, 0.12), basic(0xffa040), 0, 2.4, 0.1));
  return g;
}

function billboard(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-2, 2]) g.add(mesh(box(0.2, 5, 0.2), toon(0x5a5f66), 0, 2.5, z));
  const face = mesh(
    plane2(6, 2.4),
    lambert(0xffffff, {
      map: sign('UP’S FUTURE IS ON THE MOVE!', { bg: '#ff8c1a', fg: '#fff', border: '#ffffff', sub: 'UP RUN game slogan', subColor: '#fff3c4', w: 640, h: 256 }),
    }),
    0,
    5.6,
    0,
  );
  face.rotation.y = Math.PI / 2;
  // The face looks along +x; the backing board sits behind it.
  const back = mesh(box(0.12, 2.5, 6.1), toon(0x5a5f66), -0.08, 5.6, 0);
  g.add(face, back);
  return g;
}

/** Build a prop prototype (merged into instanced meshes by the world). */
export function buildProp(kind: PropKind): THREE.Group {
  switch (kind) {
    case 'lampL':
      return lamp(-1, false);
    case 'lampR':
      return lamp(1, false);
    case 'hwLampL':
      return lamp(-1, true);
    case 'hwLampR':
      return lamp(1, true);
    case 'tree':
      return tree();
    case 'palm':
      return palm();
    case 'stall':
      return stall();
    case 'auto':
      return buildAutoRickshaw();
    case 'tank': {
      const g = new THREE.Group();
      g.add(mesh(cyl(0.7, 0.7, 1.2, 12), toon(0x1a1a1a), 0, 0.6, 0));
      return g;
    }
    case 'dome': {
      const g = new THREE.Group();
      g.add(mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf3e6cf)));
      return g;
    }
    case 'chhatri':
      return chhatri();
    case 'crane': {
      const g = new THREE.Group();
      g.add(mesh(box(0.4, 9, 0.4), toon(0xffc300), 0, 4.5, 0));
      g.add(mesh(box(9, 0.35, 0.35), toon(0xffc300), -2.5, 9, 0));
      g.add(mesh(box(0.05, 3, 0.05), toon(0x333333), -6, 7.5, 0));
      return g;
    }
    case 'shikhara':
      return shikhara();
    case 'diyas':
      return diyas();
    case 'flags':
      return flags();
    case 'hangar':
      return hangar();
    case 'plane':
      return plane();
    case 'radar':
      return radar();
    case 'wheatField':
      return field(0xe8c050);
    case 'greenField':
      return field(0x6ab84a);
    case 'haystack':
      return haystack();
    case 'thatch':
      return thatch();
    case 'tubewell':
      return tubewell();
    case 'waterTower':
      return waterTower();
    case 'tent':
      return tent();
    case 'chimney':
      return chimney();
    case 'solar':
      return solar();
    case 'turbine':
      return turbine();
    case 'neonPylon':
      return neonPylon();
    case 'billboard':
      return billboard();
    case 'crowdFarm':
      return crowd([LOOKS.farmer, LOOKS.farmerWoman, LOOKS.farmerSaffron]);
    case 'crowdTown':
      return crowd([LOOKS.shopkeeper, LOOKS.woman, LOOKS.student]);
    case 'crowdPilgrim':
      return crowd([LOOKS.pilgrim, LOOKS.elder, LOOKS.woman]);
    case 'crowdTech':
      return crowd([LOOKS.engineer, LOOKS.worker, LOOKS.police]);
  }
}

export const CROWD_KINDS: ReadonlySet<string> = new Set(['crowdFarm', 'crowdTown', 'crowdPilgrim', 'crowdTech']);
