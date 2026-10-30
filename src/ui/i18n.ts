import type { Lang, Txt } from '../content/lang';
import { useSave } from './store';

/**
 * Interface text in English and Roman-script Hinglish. Sourced facts, quiz
 * questions and the evidence board stay in English so their wording (and
 * meaning) matches the cited sources.
 */
const UI = {
  // Title & how to play
  howToPlay: { en: 'How to play', hi: 'Kaise khelein' },
  howLanes: { en: 'to change lanes', hi: 'se lane badlo' },
  howJump: { en: 'to jump', hi: 'se jump' },
  howSlide: { en: 'to slide', hi: 'se slide' },
  howPause: { en: 'pauses', hi: 'se pause' },
  howGoal: { en: 'Collect development tokens, reach the finish line and earn up to 3 stars per level.', hi: 'Vikas tokens jama karo, finish line tak pahuncho, aur har level mein 3 star tak kamao.' },
  gundarajDef: {
    en: 'is a campaign word for lawlessness and intimidation. In this game it is a political claim and a set of fictional obstacles you leave behind — not a statement about any real person.',
    hi: 'chunavi bhaasha mein kanoon-heenta aur dabangai ke liye bola jaata hai. Is game mein yeh ek political claim hai aur kaalpanik rukaavatein hain jinhe aap peeche chhodte hain — kisi asli vyakti ke baare mein bayaan nahi.',
  },
  playLevel: { en: 'PLAY LEVEL', hi: 'KHELO LEVEL' },
  mainMenu: { en: 'Main menu', hi: 'Main menu' },
  // Menu
  campaign: { en: 'CAMPAIGN', hi: 'CAMPAIGN' },
  levels: { en: 'levels', hi: 'levels' },
  modes: { en: '🧢 Rivalry • Race • Free Run', hi: '🧢 Rivalry • Race • Free Run' },
  mayhem: { en: '🚁 Manifesto Mayhem', hi: '🚁 Manifesto Mayhem' },
  governance: { en: '🏛️ Governance Room', hi: '🏛️ Governance Room' },
  board: { en: '🏅 Achievements & Facts', hi: '🏅 Achievements aur Facts' },
  scores: { en: '📊 Scoreboard', hi: '📊 Scoreboard' },
  characters: { en: '👤 Characters', hi: '👤 Kirdaar' },
  missions: { en: '🎯 Missions', hi: '🎯 Missions' },
  shop: { en: '🛍 Unlocks', hi: '🛍 Unlocks' },
  settings: { en: '⚙ Settings', hi: '⚙ Settings' },
  newBadge: { en: 'NEW', hi: 'NAYA' },
  // Settings
  settingsTitle: { en: 'Settings', hi: 'Settings' },
  language: { en: 'Language', hi: 'Bhasha' },
  languageHint: { en: 'Menus and game text. Facts and sources stay in English.', hi: 'Menu aur game ki bhasha. Facts aur sources English mein hi rahenge.' },
  music: { en: 'Music', hi: 'Sangeet' },
  sfx: { en: 'Sound effects', hi: 'Sound effects' },
  touchButtons: { en: 'On-screen touch buttons', hi: 'Screen par touch buttons' },
  touchHint: { en: '◀ ▲ ▼ ▶ buttons in addition to swipes', hi: 'Swipe ke saath ◀ ▲ ▼ ▶ buttons bhi' },
  reducedMotion: { en: 'Reduced motion', hi: 'Kam motion' },
  reducedHint: { en: 'No screen shake, fewer particles', hi: 'Screen nahi hilegi, kam particles' },
  shortCine: { en: 'Short cinematics', hi: 'Chhote cinematics' },
  shortCineHint: { en: 'Always use the quick hero entrance', hi: 'Hamesha jaldi wali hero entry' },
  quality: { en: 'Graphics quality', hi: 'Graphics quality' },
  // Manifesto Mayhem
  mayhemTagline: { en: 'The rival caricature’s campaign cycle-copter is airborne — and it is full of promises.', hi: 'Rival caricature ka chunavi cycle-copter udd chuka hai — aur vaadon se bhara hai.' },
  mayhemRule1: { en: 'Crates of fictional promises parachute onto the road. A red ring shows where each one lands.', hi: 'Kaalpanik vaadon ke crate parachute se sadak par girte hain. Laal ring batati hai kahan girega.' },
  mayhemRule2: { en: 'Dodge them until the manifesto runs empty; collect real development tokens on the way.', hi: 'Manifesto khaali hone tak bachte raho; raaste mein asli vikas tokens jama karo.' },
  mayhemRule3: { en: 'One bump only slows you down while the stumble guard is ready; a second one ends the run.', hi: 'Guard ready ho to ek takkar sirf dheema karti hai; doosri takkar par run khatam.' },
  playAs: { en: 'PLAY AS', hi: 'KHELO —' },
  best: { en: 'Best', hi: 'Best' },
  wins: { en: 'Wins', hi: 'Jeet' },
  dodged: { en: 'Promises dodged', hi: 'Vaade bache' },
  mayhemDisclaimer: { en: 'Every promise in this mode is an invented exaggeration: satire, not taken from any real manifesto.', hi: 'Is mode ka har vaada game ke liye gadha gaya mazaak hai — kisi asli manifesto se nahi liya gaya.' },
  // In game
  paused: { en: 'Paused', hi: 'Ruka hua' },
  resume: { en: '▶ Resume', hi: '▶ Chalu karo' },
  restart: { en: '↻ Restart', hi: '↻ Dobara shuru' },
  quit: { en: '⌂ Main menu', hi: '⌂ Main menu' },
  levelComplete: { en: 'LEVEL COMPLETE!', hi: 'LEVEL POORA!' },
  levelNotFinished: { en: 'LEVEL NOT FINISHED', hi: 'LEVEL ADHOORA' },
  raceWon: { en: 'RACE WON!', hi: 'RACE JEET LI!' },
  raceLost: { en: 'RIVAL WINS THE RACE', hi: 'RIVAL RACE JEET GAYA' },
  manifestoEmpty: { en: 'MANIFESTO EMPTY!', hi: 'MANIFESTO KHAALI!' },
  buried: { en: 'BURIED IN PROMISES!', hi: 'VAADON MEIN DAB GAYE!' },
  caught: { en: 'CAUGHT IN THE SHOWDOWN!', hi: 'SHOWDOWN MEIN PAKDE GAYE!' },
  runEnded: { en: 'RUN ENDED', hi: 'RUN KHATAM' },
  runOver: { en: 'RUN OVER', hi: 'RUN KHATAM' },
  newBest: { en: 'NEW BEST!', hi: 'NAYA BEST!' },
  replayLevel: { en: 'Replay level', hi: 'Level dobara' },
  raceAgain: { en: 'Race again', hi: 'Phir race' },
  flyAgain: { en: 'Fly again', hi: 'Phir udaan' },
  retry: { en: 'Retry', hi: 'Phir khelo' },
  nextLevel: { en: 'Next', hi: 'Agla level' },
  menu: { en: 'Menu', hi: 'Menu' },
  // Governance Room
  govStart: { en: '▶ START THE SHIFT', hi: '▶ SHIFT SHURU KARO' },
  govCase: { en: 'Case', hi: 'Case' },
  govChoose: { en: 'What do you do?', hi: 'Aap kya karenge?' },
  govNext: { en: 'Next case ▶', hi: 'Agla case ▶' },
  govReport: { en: 'See the report card ▶', hi: 'Report card dekho ▶' },
  govAgain: { en: '↻ New shift', hi: '↻ Nayi shift' },
  govReportTitle: { en: 'Report card', hi: 'Report card' },
  govContext: { en: 'Real-world context', hi: 'Asli duniya ka context' },
  govContextNote: { en: 'The cases above are fictional. These entries from the evidence board say how the real debate is labelled.', hi: 'Upar ke case kaalpanik hain. Evidence board ki yeh entries batati hain ki asli bahas ko kaise label kiya gaya hai.' },
  govYourCalls: { en: 'Your calls', hi: 'Aapke faisle' },
  govShifts: { en: 'Shifts', hi: 'Shifts' },
  govBest: { en: 'Best rating', hi: 'Best rating' },
  coinsEarned: { en: 'coins earned', hi: 'coins mile' },
  achievementUnlocked: { en: 'Achievement unlocked', hi: 'Achievement mila' },
  tagBest: { en: '✅ Best call', hi: '✅ Sabse sahi faisla' },
  tagGood: { en: '👍 Good step', hi: '👍 Achha kadam' },
  tagShortcut: { en: '⚠️ Shortcut', hi: '⚠️ Shortcut' },
  tagWrong: { en: '❌ Gundaraj answer', hi: '❌ Gundaraj wala jawab' },
  tagComic: { en: '🤡 Comic disaster', hi: '🤡 Comedy disaster' },
} satisfies Record<string, Txt>;

export type UiKey = keyof typeof UI;

export function useLang(): Lang {
  return useSave().settings.language;
}

/** `t('key')` in the player's chosen language. */
export function useT(): (k: UiKey) => string {
  const lang = useLang();
  return (k) => UI[k][lang];
}

export function text(k: UiKey, lang: Lang): string {
  return UI[k][lang];
}
