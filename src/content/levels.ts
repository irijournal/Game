import type { EncounterKind, ThemeId, TokenVariant } from '../sim/types';

export type LevelId = ThemeId;

export interface LevelEvent {
  kind: EncounterKind;
  /** Distance into the level (m). Encounters with a span run `at`..`at+len`. */
  at: number;
  len?: number;
  quiz?: string;
}

export type Perk = 'powerupBoost' | 'guardBoost' | 'tokenBoost' | 'coinGift' | null;

export interface LevelDef {
  id: LevelId;
  num: number;
  name: string;
  topic: string;
  length: number;
  tokenGoal: number;
  token: TokenVariant;
  tokenName: string;
  mission: string;
  badge: { id: string; name: string; icon: string; perk: Perk; perkText: string };
  /** 0 (gentle) .. 1 (hard). */
  diff: number;
  events: LevelEvent[];
  facts: string[];
  slogan: string;
}

/**
 * The eight development levels. Each presents a BJP-government priority as
 * a playable environment; real-world context comes from the linked facts,
 * which are labelled verified / government-reported / political claim.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    id: 'expressway',
    num: 1,
    name: 'Expressway Run',
    topic: 'Road connectivity',
    length: 1000,
    tokenGoal: 25,
    token: 'road',
    tokenName: 'road tokens',
    mission: 'Sprint the expressway, dodge the work zones and collect road tokens.',
    badge: { id: 'badge.expressway', name: 'Expressway Champion', icon: '🛣️', perk: null, perkText: 'A badge for your board.' },
    diff: 0.05,
    events: [
      { kind: 'bulldozer', at: 300 },
      { kind: 'quiz', at: 650, quiz: 'q.purvanchal' },
    ],
    facts: ['purvanchal', 'agraLucknow', 'bundelkhand', 'ganga'],
    slogan: 'UP’s future is on the move!',
  },
  {
    id: 'ayodhya',
    num: 2,
    name: 'Ayodhya Heritage Mission',
    topic: 'Cultural heritage',
    length: 1100,
    tokenGoal: 30,
    token: 'diya',
    tokenName: 'floating lamps',
    mission: 'Run through the festive city and collect floating lamps.',
    badge: { id: 'badge.heritage', name: 'Heritage Star', icon: '🪔', perk: null, perkText: 'A badge for your board.' },
    diff: 0.12,
    events: [
      { kind: 'redCap', at: 420, len: 230 },
      { kind: 'quiz', at: 850, quiz: 'q.kumbh' },
    ],
    facts: ['pranPratishtha', 'ayodhyaAirport', 'kashi', 'mahaKumbh'],
    slogan: 'Har challenge ka jawab — performance!',
  },
  {
    id: 'airport',
    num: 3,
    name: 'Airport Dash',
    topic: 'Transport infrastructure',
    length: 1200,
    tokenGoal: 30,
    token: 'plane',
    tokenName: 'flight tokens',
    mission: 'Dash across the apron, avoid luggage trolleys and construction, collect flight tokens.',
    badge: { id: 'badge.connectivity', name: 'Connectivity Boost', icon: '✈️', perk: 'powerupBoost', perkText: 'Power-ups last 25% longer in every mode.' },
    diff: 0.2,
    events: [
      { kind: 'promises', at: 380, len: 240 },
      { kind: 'quiz', at: 900, quiz: 'q.noida' },
    ],
    facts: ['noidaAirport', 'kushinagar', 'ayodhyaAirport'],
    slogan: 'Race for roads, jobs and better public services!',
  },
  {
    id: 'kisan',
    num: 4,
    name: 'Kisan Challenge',
    topic: 'Farmers and agriculture',
    length: 1300,
    tokenGoal: 35,
    token: 'wheat',
    tokenName: 'crop tokens',
    mission: 'Collect crop tokens; jump broken irrigation pipes and canals.',
    badge: { id: 'badge.kisan', name: 'Kisan Support', icon: '🌾', perk: null, perkText: 'A badge for your board.' },
    diff: 0.28,
    events: [
      { kind: 'redCap', at: 400, len: 260 },
      { kind: 'quiz', at: 950, quiz: 'q.pmKisan' },
    ],
    facts: ['pmKisan'],
    slogan: 'Development ka scoreboard kholo!',
  },
  {
    id: 'jankalyan',
    num: 5,
    name: 'Jan Kalyan Mission',
    topic: 'Welfare schemes',
    length: 1400,
    tokenGoal: 35,
    token: 'welfare',
    tokenName: 'home, gas and water symbols',
    mission: 'Collect housing, cooking-gas and clean-water symbols; cut through red tape.',
    badge: { id: 'badge.publicService', name: 'Public Service Champion', icon: '🏠', perk: 'coinGift', perkText: 'Public Service bonus: +300 coins.' },
    diff: 0.36,
    events: [
      { kind: 'promises', at: 350, len: 260 },
      { kind: 'bulldozer', at: 750 },
      { kind: 'quiz', at: 1050, quiz: 'q.ujjwala' },
      { kind: 'quiz', at: 1250, quiz: 'q.laptop' },
    ],
    facts: ['ujjwala', 'jalJeevan', 'laptopScheme'],
    slogan: 'Promises are easy. Delivery is the challenge!',
  },
  {
    id: 'lawandorder',
    num: 6,
    name: 'Law & Order Challenge',
    topic: 'Governance and public safety',
    length: 1500,
    tokenGoal: 40,
    token: 'shield',
    tokenName: 'governance shields',
    mission: 'Navigate traffic, checkpoints and fictional “Gundaraj?” signs; collect governance shields.',
    badge: { id: 'badge.governance', name: 'Governance Shield', icon: '🛡️', perk: 'guardBoost', perkText: 'Stumble guard recharges 30% faster.' },
    diff: 0.45,
    events: [
      { kind: 'redCap', at: 380, len: 280 },
      { kind: 'quiz', at: 900, quiz: 'q.gundaraj' },
      { kind: 'promises', at: 1050, len: 240 },
      { kind: 'quiz', at: 1360, quiz: 'q.cycle' },
    ],
    facts: ['lawOrder', 'gundaraj', 'spFeud', 'parivarvad', 'lucknowMetro'],
    slogan: 'Gundaraj or good governance? The showdown begins!',
  },
  {
    id: 'startup',
    num: 7,
    name: 'Startup UP',
    topic: 'Investment and industry',
    length: 1600,
    tokenGoal: 40,
    token: 'gear',
    tokenName: 'gears and energy bolts',
    mission: 'Run the industrial district: forklifts, conveyors and pallets. Collect gears and energy.',
    badge: { id: 'badge.growth', name: 'Growth Multiplier', icon: '⚙️', perk: 'tokenBoost', perkText: 'Development tokens score 20% more.' },
    diff: 0.55,
    events: [
      { kind: 'promises', at: 450, len: 260 },
      { kind: 'bulldozer', at: 850 },
      { kind: 'quiz', at: 1150, quiz: 'q.gis' },
      { kind: 'quiz', at: 1450, quiz: 'q.odop' },
    ],
    facts: ['gis2023', 'odop'],
    slogan: 'Race for roads, jobs and better public services!',
  },
  {
    id: 'viksit',
    num: 8,
    name: 'Viksit UP Finale',
    topic: 'Development vision',
    length: 1800,
    tokenGoal: 45,
    token: 'star',
    tokenName: 'vision stars',
    mission: 'Race through a futuristic skyline. Everything you have learned, one last run.',
    badge: { id: 'badge.final', name: 'Final Champion', icon: '🏆', perk: null, perkText: 'The final trophy.' },
    diff: 0.65,
    events: [
      { kind: 'redCap', at: 400, len: 280 },
      { kind: 'quiz', at: 850, quiz: 'q.kaam' },
      { kind: 'promises', at: 1050, len: 260 },
      { kind: 'quiz', at: 1500, quiz: 'q.seats2022' },
    ],
    facts: ['viksitUP', 'up2017', 'up2022', 'kaamBoltaHai', 'gameElements'],
    slogan: 'Performance is the real scoreboard.',
  },
];

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** Stars: 1 = finished, 2 = finished with the token goal, 3 = also no collisions. */
export function starsFor(completed: boolean, tokens: number, goal: number, collisions: number): number {
  if (!completed) return 0;
  if (tokens < goal) return 1;
  return collisions === 0 ? 3 : 2;
}
