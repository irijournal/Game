import type { SaveData } from '../save/save';
import { LEVELS } from './levels';

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  how: string;
  /** Progress towards the goal (0..goal). */
  progress: (d: SaveData) => number;
  goal: number;
}

const stars = (d: SaveData) => LEVELS.reduce((n, l) => n + (d.levels[l.id]?.stars ?? 0), 0);
const done = (d: SaveData, id: string) => (d.levels[id as keyof SaveData['levels']]?.completed ? 1 : 0);

/** Achievement board. All achievements are fictional game awards. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'ach.connectivity', name: 'Connectivity Star', icon: '🌟', how: 'Finish Expressway Run and Airport Dash.', goal: 2, progress: (d) => done(d, 'expressway') + done(d, 'airport') },
  { id: 'ach.heritage', name: 'Heritage Protector', icon: '🛕', how: 'Earn 3 stars in the Ayodhya Heritage Mission.', goal: 3, progress: (d) => d.levels.ayodhya?.stars ?? 0 },
  { id: 'ach.governance', name: 'Governance Challenger', icon: '🧢', how: 'Win 5 Red Cap Challenges.', goal: 5, progress: (d) => d.stats.rivalWins },
  { id: 'ach.quiz', name: 'Accountability Ace', icon: '✅', how: 'Pass 10 Accountability Gates.', goal: 10, progress: (d) => d.stats.quizCorrect },
  { id: 'ach.mayhem', name: 'Manifesto Buster', icon: '🚁', how: 'Run the rival’s manifesto empty in Manifesto Mayhem.', goal: 1, progress: (d) => d.stats.mayhemWins },
  { id: 'ach.dodger', name: 'Promise Dodger', icon: '📦', how: 'Dodge 60 fictional promises in Manifesto Mayhem.', goal: 60, progress: (d) => d.stats.fakePromisesDodged },
  { id: 'ach.ruleOfLaw', name: 'Rule of Law Champion', icon: '⚖️', how: 'Earn 3 stars in the Governance Room.', goal: 3, progress: (d) => d.stats.governanceBest },
  { id: 'ach.showdown', name: 'Showdown Survivor', icon: '🚜', how: 'Escape a Governance Showdown in Rivalry Mode.', goal: 1, progress: (d) => Math.min(1, d.stats.bestStage - 1) },
  { id: 'ach.race', name: 'Development Racer', icon: '🏁', how: 'Win a Development Race.', goal: 1, progress: (d) => d.stats.racesWon },
  { id: 'ach.roads', name: 'Road Clearer', icon: '🧹', how: 'Clear 25 debris piles with the bulldozer power-up.', goal: 25, progress: (d) => d.stats.roadsCleared },
  { id: 'ach.promises', name: 'Promise Keeper', icon: '📜', how: 'Deliver 30 promises in Promises vs Performance.', goal: 30, progress: (d) => d.stats.promisesDelivered },
  { id: 'ach.stars', name: 'Star Performer', icon: '⭐', how: 'Earn 20 level stars.', goal: 20, progress: stars },
  { id: 'ach.allLevels', name: 'Viksit UP Champion', icon: '🏆', how: 'Finish all eight campaign levels.', goal: 8, progress: (d) => LEVELS.reduce((n, l) => n + done(d, l.id), 0) },
  { id: 'ach.marathon', name: 'Marathon Runner', icon: '👟', how: 'Run 5,000 m in a single run.', goal: 5000, progress: (d) => d.bestDistance },
];

export function achievementUnlocked(a: AchievementDef, d: SaveData): boolean {
  return a.progress(d) >= a.goal;
}
