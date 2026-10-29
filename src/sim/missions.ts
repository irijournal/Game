import { hashString, Rng } from './rng';

export type MissionStat =
  | 'distance'
  | 'coins'
  | 'chasesSurvived'
  | 'jumpsOver'
  | 'slidesUnder'
  | 'cleanDistance'
  | 'devTokens'
  | 'rivalWins'
  | 'quizCorrect'
  | 'roadsCleared'
  | 'vikasRides';

export interface MissionDef {
  id: string;
  title: string;
  stat: MissionStat;
  goal: number;
  /** 'run': best single run today. 'day': cumulative across today's runs. */
  scope: 'run' | 'day';
  reward: number;
}

export const MISSION_POOL: readonly MissionDef[] = [
  { id: 'run1500', title: 'Travel 1,500 m in one run', stat: 'distance', goal: 1500, scope: 'run', reward: 150 },
  { id: 'coins150', title: 'Collect 150 coins today', stat: 'coins', goal: 150, scope: 'day', reward: 100 },
  { id: 'tokens40', title: 'Collect 40 development tokens today', stat: 'devTokens', goal: 40, scope: 'day', reward: 150 },
  { id: 'rival2', title: 'Win two rival challenges today', stat: 'rivalWins', goal: 2, scope: 'day', reward: 200 },
  { id: 'quiz3', title: 'Pass three Accountability Gates today', stat: 'quizCorrect', goal: 3, scope: 'day', reward: 150 },
  { id: 'chase1', title: 'Escape one Governance Showdown', stat: 'chasesSurvived', goal: 1, scope: 'day', reward: 200 },
  { id: 'clear10', title: 'Clear 10 debris piles with the bulldozer', stat: 'roadsCleared', goal: 10, scope: 'day', reward: 120 },
  { id: 'jumps3', title: 'Complete three successful jumps in a run', stat: 'jumpsOver', goal: 3, scope: 'run', reward: 60 },
  { id: 'clean800', title: 'Run 800 m without a collision', stat: 'cleanDistance', goal: 800, scope: 'run', reward: 150 },
  { id: 'slides5', title: 'Slide under five barriers today', stat: 'slidesUnder', goal: 5, scope: 'day', reward: 80 },
];

export const MISSIONS_PER_DAY = 3;

/** Local calendar day, e.g. "2026-10-29". Missions reset at local midnight. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministic daily selection: same three missions for everyone on a day. */
export function missionsForDay(day: string): MissionDef[] {
  const rng = new Rng(hashString('missions:' + day));
  const pool = [...MISSION_POOL];
  const out: MissionDef[] = [];
  while (out.length < MISSIONS_PER_DAY && pool.length) {
    out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  }
  return out;
}

export function missionById(id: string): MissionDef | undefined {
  return MISSION_POOL.find((m) => m.id === id);
}

export interface ActiveMission {
  def: MissionDef;
  /** Progress before this run (best run value or day total). */
  base: number;
  completed: boolean;
}

export function missionValue(m: ActiveMission, runValue: number): number {
  return m.def.scope === 'day' ? m.base + runValue : Math.max(m.base, runValue);
}
