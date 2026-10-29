import type { ThemeId } from '../../sim/types';

export interface Palette {
  skyTop: number;
  skyBottom: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sun: number;
  sunIntensity: number;
  buildings: number[];
  sidewalk: number;
  shoulder: number;
  ground: number;
  skyline: number;
  night: boolean;
}

export const PALETTES: Record<ThemeId | 'vikas', Palette> = {
  lucknow: {
    skyTop: 0x5fb4f2,
    skyBottom: 0xffe2b8,
    fog: 0xf6dcc0,
    fogNear: 70,
    fogFar: 200,
    hemiSky: 0xfff4e0,
    hemiGround: 0x8a7a66,
    hemiIntensity: 1.55,
    sun: 0xfff1d6,
    sunIntensity: 1.55,
    buildings: [0xf4a6a0, 0xf6c98a, 0xa8d8c9, 0xf3e3a1, 0x9cc7ea, 0xe9b8d6, 0xf7d0b0],
    sidewalk: 0xd6c4ad,
    shoulder: 0x6a6670,
    ground: 0xb7a88f,
    skyline: 0xd9b9a8,
    night: false,
  },
  heritage: {
    skyTop: 0xff9a5a,
    skyBottom: 0xffe3b0,
    fog: 0xf7cfa0,
    fogNear: 70,
    fogFar: 200,
    hemiSky: 0xffe2c0,
    hemiGround: 0x8a6a50,
    hemiIntensity: 1.5,
    sun: 0xffd2a0,
    sunIntensity: 1.6,
    buildings: [0xe0a46b, 0xd98e5f, 0xe9c18f, 0xc97b5a, 0xf0d2a1, 0xd4a07a],
    sidewalk: 0xd9b48a,
    shoulder: 0x6f6460,
    ground: 0xc4a07a,
    skyline: 0xd88f6a,
    night: false,
  },
  modern: {
    skyTop: 0x4ea6f0,
    skyBottom: 0xdcefff,
    fog: 0xd2e8f8,
    fogNear: 70,
    fogFar: 210,
    hemiSky: 0xf0f8ff,
    hemiGround: 0x7a8490,
    hemiIntensity: 1.55,
    sun: 0xffffff,
    sunIntensity: 1.5,
    buildings: [0x9fb4c7, 0xc4d3df, 0x7f98ae, 0xdfe7ee, 0x8fb0c9, 0xb0c4d4],
    sidewalk: 0xc9ccd1,
    shoulder: 0x62666e,
    ground: 0xa8b0a0,
    skyline: 0x9fb8d0,
    night: false,
  },
  festival: {
    skyTop: 0x22175c,
    skyBottom: 0xf27a86,
    fog: 0x7a4a7e,
    fogNear: 60,
    fogFar: 185,
    hemiSky: 0xc8b0ff,
    hemiGround: 0x4a3050,
    hemiIntensity: 1.25,
    sun: 0xffc8a0,
    sunIntensity: 1.0,
    buildings: [0x9a5aaf, 0xc0578a, 0x6a6ac0, 0xd47a4a, 0x5a8aaa, 0xb8608a],
    sidewalk: 0x9a8aa0,
    shoulder: 0x4e4858,
    ground: 0x6a5a6a,
    skyline: 0x553a70,
    night: true,
  },
  vikas: {
    skyTop: 0x2f8fe0,
    skyBottom: 0xbff3ee,
    fog: 0xbfeee8,
    fogNear: 80,
    fogFar: 220,
    hemiSky: 0xeaffff,
    hemiGround: 0x6a8a8a,
    hemiIntensity: 1.6,
    sun: 0xffffff,
    sunIntensity: 1.6,
    buildings: [0x9fd4e0, 0xc4e8ef, 0x7fb8c8, 0xdff4f6],
    sidewalk: 0xbfd8d8,
    shoulder: 0x56707a,
    ground: 0x9ab8b0,
    skyline: 0x8ac0d0,
    night: false,
  },
};

export const SHOP_NAMES = [
  'CHAI • 10₹',
  'KEBAB CORNER',
  'CHIKAN EMPORIUM',
  'MOBILE REPAIR',
  'SWEETS & NAMKEEN',
  'PHOTOSTAT • XEROX',
  'LASSI BHANDAR',
  'TENT HOUSE',
  'PAAN PALACE',
  'GUPTA GENERAL STORE',
  'KULFI FALOODA',
  'CYBER CAFE',
];

/** Fictional, party-neutral environmental jokes. Never collidable. */
export const POSTERS: [string, string, string][] = [
  ['PROMISES AHEAD!', '#ff8c1a', '#fff'],
  ['ELECTION SEASON: PROCEED CAREFULLY', '#1f8a4c', '#fff'],
  ['DEVELOPMENT IN PROGRESS', '#2d6cdf', '#fff'],
  ['MANIFESTO: NOW WITH 20% MORE PROMISES', '#e8262c', '#fff3c4'],
  ['POTHOLE-FREE ROADS COMING SOON™', '#ffd23a', '#1a1a1a'],
  ['VOTE FOR ROADS* (*TERMS APPLY)', '#7a3fb0', '#fff'],
  ['RALLY TODAY • FREE SAMOSA', '#ff5a5a', '#fff'],
  ['YOUR NETA, YOUR SELFIE', '#14a3a3', '#fff'],
];
