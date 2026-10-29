import type { CharacterId, ThemeId } from './types';

export type ChaserVehicle = 'bulldozer' | 'cycle';

export interface OutfitDef {
  id: string;
  name: string;
  price: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  shortName: string;
  description: string;
  /** hero: campaign / race / free run. rival: Rivalry Mode and free run. */
  role: 'hero' | 'rival';
  /** Who makes the dramatic entrance when this character stumbles. */
  rival: CharacterId;
  /** Vehicle this character brings when appearing as the chaser. */
  vehicle: ChaserVehicle;
  accent: string;
  unlock: { kind: 'free' } | { kind: 'distance'; metres: number; price: number };
  outfits: OutfitDef[];
  fictional: boolean;
}

/**
 * Character registry. Adding a character = add an entry here plus a model
 * builder in engine/view/characterModels.ts; animation, selection, unlocks
 * and entrances all work off this shared interface. Real politicians are
 * stylised caricatures ("inspired by"); negative roles are only ever given
 * to fictional characters.
 */
export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  yogi: {
    id: 'yogi',
    name: 'Yogi Adityanath',
    shortName: 'Yogi',
    description: 'The hero of UP RUN: saffron robes, a confident stride, a dramatic entrance and a signature victory pose.',
    role: 'hero',
    rival: 'akhilesh',
    vehicle: 'bulldozer',
    accent: '#ff8c1a',
    unlock: { kind: 'free' },
    outfits: [
      { id: 'yogi.classic', name: 'Classic Saffron', price: 0 },
      { id: 'yogi.shawl', name: 'Saffron Shawl', price: 300 },
      { id: 'yogi.mala', name: 'Marigold Mala', price: 500 },
    ],
    fictional: false,
  },
  akhilesh: {
    id: 'akhilesh',
    name: 'Akhilesh Yadav',
    shortName: 'Akhilesh',
    description: 'The rival: red cap, white kurta-pajama and a campaign-season sprint. Playable in Rivalry Mode — can you escape the Governance Showdown?',
    role: 'rival',
    rival: 'yogi',
    vehicle: 'cycle',
    accent: '#e8262c',
    unlock: { kind: 'free' },
    outfits: [
      { id: 'akhilesh.classic', name: 'Classic Kurta', price: 0 },
      { id: 'akhilesh.sadri', name: 'Sadri Jacket', price: 300 },
      { id: 'akhilesh.scarf', name: 'Red-Green Scarf', price: 500 },
    ],
    fictional: false,
  },
  karyakarta: {
    id: 'karyakarta',
    name: 'Karyakarta-ji',
    shortName: 'Karyakarta-ji',
    description: 'A fictional party volunteer in a saffron scarf: first at every rally, last to leave. Unlock by running 2,000 m in one run, or with coins.',
    role: 'hero',
    rival: 'akhilesh',
    vehicle: 'cycle',
    accent: '#1f8a4c',
    unlock: { kind: 'distance', metres: 2000, price: 1000 },
    outfits: [
      { id: 'karyakarta.classic', name: 'Saffron Scarf', price: 0 },
      { id: 'karyakarta.cap', name: 'Rally Cap', price: 400 },
    ],
    fictional: true,
  },
};

export const CHARACTER_ORDER: readonly CharacterId[] = ['yogi', 'akhilesh', 'karyakarta'];
export const HEROES: readonly CharacterId[] = ['yogi', 'karyakarta'];

export interface CosmeticDef {
  id: string;
  name: string;
  price: number;
  kind: 'trail' | 'runStyle' | 'route';
  theme?: ThemeId;
}

export const TRAILS: readonly CosmeticDef[] = [
  { id: 'trail.none', name: 'No Trail', price: 0, kind: 'trail' },
  { id: 'trail.sparkle', name: 'Coin Sparkle', price: 200, kind: 'trail' },
  { id: 'trail.saffron', name: 'Saffron Glow', price: 400, kind: 'trail' },
  { id: 'trail.saffrongreen', name: 'Saffron & Green Streamers', price: 400, kind: 'trail' },
  { id: 'trail.marigold', name: 'Marigold Petals', price: 600, kind: 'trail' },
];

export const RUN_STYLES: readonly CosmeticDef[] = [
  { id: 'run.classic', name: 'Classic Run', price: 0, kind: 'runStyle' },
  { id: 'run.power', name: 'Power Pump', price: 500, kind: 'runStyle' },
  { id: 'run.strut', name: 'Rally Strut', price: 800, kind: 'runStyle' },
];

/** Free Run start routes: unlocked by completing that campaign level. */
export const ROUTES: readonly CosmeticDef[] = [
  { id: 'route.expressway', name: 'Expressway', price: 0, kind: 'route', theme: 'expressway' },
  { id: 'route.ayodhya', name: 'Ayodhya Heritage', price: 0, kind: 'route', theme: 'ayodhya' },
  { id: 'route.airport', name: 'Airport', price: 0, kind: 'route', theme: 'airport' },
  { id: 'route.kisan', name: 'Kisan Fields', price: 0, kind: 'route', theme: 'kisan' },
  { id: 'route.jankalyan', name: 'Jan Kalyan Town', price: 0, kind: 'route', theme: 'jankalyan' },
  { id: 'route.lawandorder', name: 'Lucknow Streets', price: 0, kind: 'route', theme: 'lawandorder' },
  { id: 'route.startup', name: 'Startup District', price: 0, kind: 'route', theme: 'startup' },
  { id: 'route.viksit', name: 'Viksit UP Skyline', price: 0, kind: 'route', theme: 'viksit' },
];
