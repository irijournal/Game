import type { CharacterId } from './types';

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
  /** Who makes the dramatic entrance when this character stumbles. */
  rival: CharacterId;
  /** Vehicle this character brings when appearing as the rival. */
  vehicle: ChaserVehicle;
  accent: string;
  unlock: { kind: 'free' } | { kind: 'distance'; metres: number; price: number };
  outfits: OutfitDef[];
  fictional: boolean;
}

/**
 * Character registry. Adding a character = add an entry here plus a model
 * builder in engine/view/characterModels.ts; animation, selection, unlocks
 * and the rival entrance all work off this shared interface.
 */
export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  akhilesh: {
    id: 'akhilesh',
    name: 'Akhilesh Yadav',
    shortName: 'Akhilesh',
    description:
      'Red cap, white kurta-pajama and a campaign-season sprint. The default runner: he adjusts the cap, then he is off.',
    rival: 'yogi',
    vehicle: 'cycle',
    accent: '#e8262c',
    unlock: { kind: 'free' },
    outfits: [
      { id: 'akhilesh.classic', name: 'Classic Kurta', price: 0 },
      { id: 'akhilesh.sadri', name: 'Sadri Jacket', price: 300 },
      { id: 'akhilesh.scarf', name: 'Campaign Scarf', price: 500 },
    ],
    fictional: false,
  },
  yogi: {
    id: 'yogi',
    name: 'Yogi Adityanath',
    shortName: 'Yogi',
    description:
      'Saffron robes, a confident stride and an entrance that arrives with a bulldozer. Same running rules as everyone else.',
    rival: 'akhilesh',
    vehicle: 'bulldozer',
    accent: '#ff8a00',
    unlock: { kind: 'free' },
    outfits: [
      { id: 'yogi.classic', name: 'Classic Saffron', price: 0 },
      { id: 'yogi.shawl', name: 'Saffron Shawl', price: 300 },
      { id: 'yogi.mala', name: 'Marigold Mala', price: 500 },
    ],
    fictional: false,
  },
  ummeedwar: {
    id: 'ummeedwar',
    name: 'Ummeedwar-ji',
    shortName: 'Ummeedwar-ji',
    description:
      'A completely fictional candidate who has promised everything to everyone. Unlock by running 2,000 m in one run, or with coins.',
    rival: 'yogi',
    vehicle: 'cycle',
    accent: '#2d9cdb',
    unlock: { kind: 'distance', metres: 2000, price: 1000 },
    outfits: [
      { id: 'ummeedwar.classic', name: 'Garland & Jacket', price: 0 },
      { id: 'ummeedwar.shades', name: 'Rally Shades', price: 400 },
    ],
    fictional: true,
  },
};

export const CHARACTER_ORDER: readonly CharacterId[] = ['akhilesh', 'yogi', 'ummeedwar'];

export interface CosmeticDef {
  id: string;
  name: string;
  price: number;
  kind: 'trail' | 'runStyle' | 'route';
}

export const TRAILS: readonly CosmeticDef[] = [
  { id: 'trail.none', name: 'No Trail', price: 0, kind: 'trail' },
  { id: 'trail.sparkle', name: 'Coin Sparkle', price: 200, kind: 'trail' },
  { id: 'trail.redgreen', name: 'Red & Green Streamers', price: 400, kind: 'trail' },
  { id: 'trail.saffron', name: 'Saffron Glow', price: 400, kind: 'trail' },
  { id: 'trail.marigold', name: 'Marigold Petals', price: 600, kind: 'trail' },
];

export const RUN_STYLES: readonly CosmeticDef[] = [
  { id: 'run.classic', name: 'Classic Run', price: 0, kind: 'runStyle' },
  { id: 'run.power', name: 'Power Pump', price: 500, kind: 'runStyle' },
  { id: 'run.strut', name: 'Rally Strut', price: 800, kind: 'runStyle' },
];

export const ROUTES: readonly CosmeticDef[] = [
  { id: 'route.lucknow', name: 'Lucknow Streets', price: 0, kind: 'route' },
  { id: 'route.heritage', name: 'Heritage Route', price: 300, kind: 'route' },
  { id: 'route.modern', name: 'Vikas Corridor', price: 300, kind: 'route' },
  { id: 'route.festival', name: 'Festival Route', price: 500, kind: 'route' },
];
