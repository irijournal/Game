import type { ThemeId } from '../../sim/types';
import type { FacadeStyle } from './textures';

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

const day = (o: Partial<Palette> & Pick<Palette, 'skyTop' | 'skyBottom' | 'fog' | 'buildings' | 'sidewalk' | 'ground' | 'skyline'>): Palette => ({
  fogNear: 70,
  fogFar: 200,
  hemiSky: 0xfff4e0,
  hemiGround: 0x8a7a66,
  hemiIntensity: 1.55,
  sun: 0xfff1d6,
  sunIntensity: 1.55,
  shoulder: 0x6a6670,
  night: false,
  ...o,
});

export const PALETTES: Record<ThemeId | 'vikas', Palette> = {
  expressway: day({
    skyTop: 0x4aa8f0,
    skyBottom: 0xd8f0ff,
    fog: 0xd6ecf6,
    fogFar: 220,
    hemiSky: 0xf2fbff,
    buildings: [0xe8e4dc, 0xd8d4cc, 0xf0ece4],
    sidewalk: 0x7fb85a,
    shoulder: 0x5e626a,
    ground: 0x8cc063,
    skyline: 0xa9c4d8,
  }),
  ayodhya: day({
    skyTop: 0xff8f4a,
    skyBottom: 0xffe0a8,
    fog: 0xf9cf9a,
    hemiSky: 0xffe2c0,
    hemiGround: 0x8a6a50,
    sun: 0xffcf96,
    sunIntensity: 1.6,
    buildings: [0xf0c48a, 0xe8b07a, 0xf6dcae, 0xe9a46a, 0xf4d6a8],
    sidewalk: 0xe0c08e,
    shoulder: 0x6f6460,
    ground: 0xd2a874,
    skyline: 0xd98a5c,
  }),
  airport: day({
    skyTop: 0x3d9cf0,
    skyBottom: 0xe4f4ff,
    fog: 0xdcecf8,
    fogFar: 230,
    hemiSky: 0xf0f8ff,
    hemiGround: 0x7a8490,
    sun: 0xffffff,
    buildings: [0xe9eef3, 0xcfd9e2, 0xb8c8d6, 0xf4f7fa],
    sidewalk: 0xc4c9cf,
    shoulder: 0x55595f,
    ground: 0x9fb48a,
    skyline: 0x9ab6cc,
  }),
  kisan: day({
    skyTop: 0x5ab4f4,
    skyBottom: 0xfff2c8,
    fog: 0xf2ead0,
    fogFar: 215,
    hemiSky: 0xfff8e0,
    hemiGround: 0x7a7a40,
    sun: 0xfff0c8,
    sunIntensity: 1.65,
    buildings: [0xd9a873, 0xc98f5e, 0xe2bb88],
    sidewalk: 0x9ab85a,
    shoulder: 0x8a7458,
    ground: 0xa8c060,
    skyline: 0x9cbf86,
  }),
  jankalyan: day({
    skyTop: 0x6ab8ee,
    skyBottom: 0xffe8c8,
    fog: 0xf4e2c8,
    buildings: [0xf7b7a3, 0xf9d48b, 0xb5e0cf, 0xf7eab0, 0xa9cdee, 0xf0c2de, 0xfbd7b5],
    sidewalk: 0xdac8b0,
    ground: 0xbcae92,
    skyline: 0xd8baa8,
  }),
  lawandorder: day({
    skyTop: 0x5fb4f2,
    skyBottom: 0xffe2b8,
    fog: 0xf6dcc0,
    buildings: [0xf4a6a0, 0xf6c98a, 0xa8d8c9, 0xf3e3a1, 0x9cc7ea, 0xe9b8d6, 0xf7d0b0],
    sidewalk: 0xd6c4ad,
    ground: 0xb7a88f,
    skyline: 0xd9b9a8,
  }),
  startup: day({
    skyTop: 0x4a9ee6,
    skyBottom: 0xdcebf6,
    fog: 0xd0dee8,
    fogFar: 210,
    hemiSky: 0xf0f6ff,
    hemiGround: 0x707880,
    sun: 0xffffff,
    sunIntensity: 1.5,
    buildings: [0x9fb4c7, 0xc4d3df, 0x7f98ae, 0xdfe7ee, 0x8fb0c9, 0xb6a48e, 0xc9b79c],
    sidewalk: 0xc2c5ca,
    shoulder: 0x5c6068,
    ground: 0xa0a898,
    skyline: 0x98aec4,
  }),
  viksit: {
    skyTop: 0x170f4a,
    skyBottom: 0xff8a5c,
    fog: 0x6a3f74,
    fogNear: 60,
    fogFar: 190,
    hemiSky: 0xd0c0ff,
    hemiGround: 0x403050,
    hemiIntensity: 1.3,
    sun: 0xffc8a0,
    sunIntensity: 1.0,
    buildings: [0x6a7ad0, 0x5a9ab8, 0x9a6ac0, 0x4a8a9a, 0x7a5aa8, 0xff9a40],
    sidewalk: 0x8a8aa8,
    shoulder: 0x403e52,
    ground: 0x4e4a66,
    skyline: 0x4a3480,
    night: true,
  },
  vikas: day({
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
  }),
};

export type PropKind =
  | 'lampL'
  | 'lampR'
  | 'hwLampL'
  | 'hwLampR'
  | 'tree'
  | 'palm'
  | 'stall'
  | 'auto'
  | 'tank'
  | 'dome'
  | 'chhatri'
  | 'crane'
  | 'shikhara'
  | 'diyas'
  | 'flags'
  | 'hangar'
  | 'plane'
  | 'radar'
  | 'wheatField'
  | 'greenField'
  | 'haystack'
  | 'thatch'
  | 'tubewell'
  | 'waterTower'
  | 'tent'
  | 'chimney'
  | 'solar'
  | 'turbine'
  | 'neonPylon'
  | 'billboard'
  | 'crowdFarm'
  | 'crowdTown'
  | 'crowdPilgrim'
  | 'crowdTech';

/** How a block of street is dressed in each environment. */
export interface EnvStyle {
  /** Weighted facade styles; 'none' leaves the plot open (fields, verges). */
  facades: [FacadeStyle | 'none', number][];
  floors: [number, number];
  /** Props on the far side of the plot or on the verge. */
  roadside: [PropKind, number][];
  /** Props on rooftops. */
  roof: [PropKind, number][];
  /** Props filling open plots. */
  open: [PropKind, number][];
  lamp: 'city' | 'highway';
  crowd: PropKind[];
  /** Chance a block has a cheering group of citizens. */
  crowdChance: number;
  shops: boolean;
  posters: number;
  lights: boolean;
  walk: 'tiles' | 'grass' | 'stone';
  /** Height of the distant filler blocks (0 = rural, 1 = city). */
  city: number;
}

export const ENV_STYLES: Record<ThemeId, EnvStyle> = {
  expressway: {
    facades: [['none', 0.6], ['barrier', 0.4]],
    floors: [1, 1],
    roadside: [['tree', 0.45], ['billboard', 0.2]],
    roof: [],
    open: [['greenField', 0.5], ['wheatField', 0.3]],
    lamp: 'highway',
    crowd: ['crowdTech', 'crowdFarm'],
    crowdChance: 0.12,
    shops: false,
    posters: 0,
    lights: false,
    walk: 'grass',
    city: 0.1,
  },
  ayodhya: {
    facades: [['temple', 0.45], ['haveli', 0.4], ['shop', 0.15]],
    floors: [2, 3],
    roadside: [['diyas', 0.45], ['flags', 0.25], ['stall', 0.15]],
    roof: [['shikhara', 0.55], ['chhatri', 0.25]],
    open: [],
    lamp: 'city',
    crowd: ['crowdPilgrim', 'crowdTown'],
    crowdChance: 0.32,
    shops: true,
    posters: 0,
    lights: true,
    walk: 'stone',
    city: 0.45,
  },
  airport: {
    facades: [['terminal', 0.55], ['none', 0.45]],
    floors: [2, 2],
    roadside: [['palm', 0.35], ['billboard', 0.15]],
    roof: [['radar', 0.2]],
    open: [['hangar', 0.45], ['plane', 0.35]],
    lamp: 'highway',
    crowd: ['crowdTech', 'crowdTown'],
    crowdChance: 0.18,
    shops: false,
    posters: 0,
    lights: false,
    walk: 'tiles',
    city: 0.15,
  },
  kisan: {
    facades: [['none', 0.72], ['hut', 0.28]],
    floors: [1, 1],
    roadside: [['tree', 0.4], ['tubewell', 0.2]],
    roof: [],
    open: [['wheatField', 0.5], ['greenField', 0.3], ['haystack', 0.2]],
    lamp: 'highway',
    crowd: ['crowdFarm'],
    crowdChance: 0.3,
    shops: false,
    posters: 0,
    lights: false,
    walk: 'grass',
    city: 0.05,
  },
  jankalyan: {
    facades: [['apartment', 0.45], ['shop', 0.4], ['haveli', 0.15]],
    floors: [2, 3],
    roadside: [['tent', 0.25], ['tree', 0.25], ['stall', 0.2]],
    roof: [['tank', 0.5], ['waterTower', 0.15]],
    open: [],
    lamp: 'city',
    crowd: ['crowdTown', 'crowdFarm'],
    crowdChance: 0.35,
    shops: true,
    posters: 0.35,
    lights: false,
    walk: 'tiles',
    city: 0.7,
  },
  lawandorder: {
    facades: [['shop', 0.55], ['apartment', 0.45]],
    floors: [2, 4],
    roadside: [['tree', 0.35], ['stall', 0.25], ['auto', 0.22]],
    roof: [['tank', 0.6]],
    open: [],
    lamp: 'city',
    crowd: ['crowdTown', 'crowdTech'],
    crowdChance: 0.25,
    shops: true,
    posters: 0.45,
    lights: false,
    walk: 'tiles',
    city: 1,
  },
  startup: {
    facades: [['glass', 0.45], ['factory', 0.4], ['apartment', 0.15]],
    floors: [3, 9],
    roadside: [['tree', 0.2], ['billboard', 0.2], ['auto', 0.15]],
    roof: [['solar', 0.4], ['chimney', 0.25], ['crane', 0.15]],
    open: [],
    lamp: 'city',
    crowd: ['crowdTech'],
    crowdChance: 0.22,
    shops: false,
    posters: 0,
    lights: false,
    walk: 'tiles',
    city: 1,
  },
  viksit: {
    facades: [['neon', 0.6], ['glass', 0.4]],
    floors: [5, 12],
    roadside: [['neonPylon', 0.4], ['palm', 0.25], ['flags', 0.15]],
    roof: [['solar', 0.4], ['turbine', 0.2]],
    open: [],
    lamp: 'city',
    crowd: ['crowdTown', 'crowdTech', 'crowdFarm', 'crowdPilgrim'],
    crowdChance: 0.4,
    shops: false,
    posters: 0,
    lights: true,
    walk: 'tiles',
    city: 1,
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
  'PUJA SAMAGRI',
  'MEDICAL STORE',
];

/**
 * Roadside posters. Slogans are the game's own (fictional) campaign lines;
 * nothing here quotes a real person or claims a statistic.
 */
export const POSTERS: [string, string, string][] = [
  ['UP’S FUTURE IS ON THE MOVE!', '#ff8c1a', '#fff'],
  ['PROMISES ARE EASY. DELIVERY IS THE CHALLENGE!', '#1f8a4c', '#fff'],
  ['DEVELOPMENT KA SCOREBOARD KHOLO!', '#ffffff', '#c25400'],
  ['HAR CHALLENGE KA JAWAB — PERFORMANCE!', '#ff8c1a', '#fff'],
  ['RACE FOR ROADS, JOBS & SERVICES', '#2d6cdf', '#fff'],
  ['WORK IN PROGRESS — THANK YOU FOR YOUR PATIENCE', '#ffd23a', '#1a1a1a'],
  ['RALLY TODAY • FREE SAMOSA', '#ff5a5a', '#fff'],
  ['YOUR CITY, YOUR SELFIE POINT', '#14a3a3', '#fff'],
];
