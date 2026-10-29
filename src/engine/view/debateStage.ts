import * as THREE from 'three';
import type { CharacterId } from '../../sim/types';
import { buildCharacter, disposeRig } from './characterModels';
import type { CharacterRig } from './characterRig';
import { basic, box, cyl, lambert, mergeStatic, mesh, plane, toon } from './materials';
import { buildProp } from './scenery';
import { canvasTexture, sign } from './textures';

export type Speaker = 'hero' | 'rival' | null;

/**
 * Debate Arena set: two podiums on a stage, a backdrop that labels every
 * line as fictional, and a cheering audience. Animation only; the dialogue
 * itself lives in the React overlay (content/debate.ts).
 */
export class DebateStage {
  readonly group = new THREE.Group();
  private hero: CharacterRig | null = null;
  private rival: CharacterRig | null = null;
  private ids: [CharacterId | null, CharacterId | null] = [null, null];
  private crowds: THREE.Group[] = [];
  private spot: THREE.Mesh;
  speaker: Speaker = null;
  result: 'hero' | 'rival' | null = null;

  constructor() {
    const set = new THREE.Group();
    const cloth = canvasTexture('debateCloth', 128, 64, (c) => {
      const g = c.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, '#ff8c1a');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, '#1f8a4c');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 64);
    });
    set.add(mesh(box(9, 0.8, 4.2), lambert(0xffffff, { map: cloth }), 0, 0.4, 0));
    set.add(mesh(box(9.2, 0.08, 4.4), toon(0x6a4020), 0, 0.84, 0));
    const back = mesh(
      plane(11, 5),
      lambert(0xffffff, {
        map: sign('DEBATE ARENA', { bg: '#1a2340', fg: '#ffd23a', border: '#ff8c1a', sub: 'ALL DIALOGUE IS FICTIONAL • NOT REAL QUOTES', subColor: '#ffffff', w: 1024, h: 480 }),
      }),
      0,
      3.6,
      -2.4,
    );
    set.add(back);
    // Lecterns stand beside the speakers so both stay fully visible.
    for (const x of [-2.75, 2.75]) {
      set.add(mesh(box(0.8, 1.0, 0.6), toon(x < 0 ? 0xff8c1a : 0xd8202a), x, 1.38, 0.3));
      set.add(mesh(box(0.9, 0.08, 0.7), toon(0xffffff), x, 1.92, 0.3));
      const mic = mesh(cyl(0.015, 0.015, 0.6, 6), toon(0x333333), x - Math.sign(x) * 0.35, 2.2, 0.3);
      mic.rotation.z = Math.sign(x) * 0.6;
      set.add(mic, mesh(cyl(0.05, 0.05, 0.1, 8), toon(0x111111), x - Math.sign(x) * 0.52, 2.45, 0.3));
    }
    set.add(mesh(box(1.4, 0.5, 0.05), lambert(0xffffff, { map: sign('VS', { bg: '#ffd23a', fg: '#1a1a1a', w: 256, h: 96 }) }), 0, 0.45, 2.13));
    this.group.add(mergeStatic(set));
    // Audience on both sides of the stage front, facing the speakers.
    for (const [x, z, kind] of [
      [-4.2, 3.4, 'crowdTown'],
      [4.2, 3.4, 'crowdTech'],
      [-6.0, 4.6, 'crowdFarm'],
      [6.0, 4.6, 'crowdPilgrim'],
      [-2.4, 4.4, 'crowdPilgrim'],
      [2.4, 4.4, 'crowdFarm'],
    ] as const) {
      const c = mergeStatic(buildProp(kind));
      c.position.set(x, 0, z);
      c.rotation.y = Math.PI + Math.sign(x) * 0.5;
      c.scale.setScalar(0.85);
      this.group.add(c);
      this.crowds.push(c);
    }
    this.spot = mesh(plane(2.4, 2.4), basic(0xfff2b0, { transparent: true, opacity: 0.35, key: 'spot' }), 0, 0.9, 0.55);
    this.spot.rotation.x = -Math.PI / 2;
    this.group.add(this.spot);
    this.group.visible = false;
  }

  configure(hero: CharacterId, heroOutfit: string, rival: CharacterId, rivalOutfit: string): void {
    if (this.ids[0] !== hero) {
      if (this.hero) disposeRig(this.hero);
      this.hero = buildCharacter(hero, { outfit: heroOutfit });
      this.group.add(this.hero.root);
      this.ids[0] = hero;
    }
    if (this.ids[1] !== rival) {
      if (this.rival) disposeRig(this.rival);
      this.rival = buildCharacter(rival, { outfit: rivalOutfit });
      this.group.add(this.rival.root);
      this.ids[1] = rival;
    }
    this.hero!.root.position.set(-1.65, 0.88, 0.2);
    this.rival!.root.position.set(1.65, 0.88, 0.2);
    this.speaker = null;
    this.result = null;
  }

  update(dt: number, time: number): void {
    const rigs: [CharacterRig | null, Speaker][] = [
      [this.hero, 'hero'],
      [this.rival, 'rival'],
    ];
    for (const [rig, who] of rigs) {
      if (!rig) continue;
      // Speakers face the audience, turned slightly towards each other.
      rig.root.rotation.y = Math.PI + (who === 'hero' ? 0.35 : -0.35);
      if (this.result) rig.setAnim(this.result === who ? 'victory' : 'idle');
      else rig.setAnim(this.speaker === who ? 'talk' : 'idle');
      rig.update(dt, 0);
    }
    const target = this.speaker === 'hero' || this.result === 'hero' ? -1.65 : this.speaker === 'rival' || this.result === 'rival' ? 1.65 : 0;
    this.spot.position.x += (target - this.spot.position.x) * Math.min(1, dt * 6);
    this.spot.visible = this.speaker !== null || this.result !== null;
    this.crowds.forEach((c, i) => (c.position.y = this.result === 'hero' || i % 2 === Math.floor(time) % 2 ? Math.abs(Math.sin(time * 6 + i)) * 0.18 : 0));
  }
}
