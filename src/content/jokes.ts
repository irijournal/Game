/**
 * Comic writing for the game. Everything here is FICTIONAL satire written
 * for UP RUN: no line is a quote of a real person, and no headline reports
 * a real event. Real-world facts live only in facts.ts.
 */

/** "UP RUN News" flashes and the menu ticker (labelled satire in the UI). */
export const NEWS_HEADLINES: readonly string[] = [
  'Expressway so smooth, chai cups refuse to spill',
  'Red-cap convoy stuck at speed-breaker labelled “RESULTS”',
  'Cycle attempts the expressway; politely overtaken by a tractor',
  'Opposition announces press conference to announce another press conference',
  'Man asks “Kaam bolta hai?” — work replies “busy, will call back”',
  'Family meeting on seat-sharing enters day 3,000; talks “very positive”',
  'Laptop from 2012 still buffering, sources say',
  'Rival manifesto now available in two volumes and a director’s cut',
  'Pothole files for retirement after road gets resurfaced',
  'New airport opens; pigeons demand frequent-flyer miles',
  '“GUNDARAJ?” sign spotted looking for a new job',
  'Rally audience requests subtitles for the word “vikas”',
  'Cycle-copter grounded: manifesto too heavy to lift',
  'Cycle pump shortage reported ahead of rally',
  'Promises delivered: many. Promises pending: please hold',
  'Breaking: Scoreboard confirms the scoreboard is open',
  'Bulldozer clears debris in record time; files on desk nervous',
  'Alliance spotted at the bus stop, waiting for the next election',
  'Ribbon-cutting scissors book a full calendar for the year',
  'Red alert issued for traffic lights only, officials clarify',
  'Local uncle finally agrees the new road is “theek-thaak”',
  'Opposition’s 2015 idea seen at the expressway asking for a selfie',
  'Rival WhatsApp group renamed for the 9th time this month',
  'Tea stall owner adds “Expressway Special” to the menu',
  'Weather update: 100% chance of development',
];

/** Hero (caricature) catchphrases: original game lines. */
export const HERO_LINES: readonly string[] = [
  'Rasta saaf, vikas aage!',
  'Kaam sirf bolta nahi — dikhta hai!',
  'Speed-breaker sirf gundaraj ke liye!',
  'Har challenge ka jawab — performance!',
  'Feeta bhi kata, kaam bhi poora!',
  'Scoreboard khula hai — aao dekh lo!',
];

/** Rival (caricature) comic one-liners: fictional, never real quotes. */
export const RIVAL_LINES = {
  ribbonLate: ['Arre! Yeh to humne 2015 mein socha tha!', 'Ruko ruko, photo mere saath bhi!', 'Ribbon kat gaya? Kaise? Kab?'],
  challengeLost: ['Cycle ki chain utar gayi!', 'Agli baar alliance karke aayenge!', 'Yeh race fixed thi… road bahut smooth thi!'],
  challengeWon: ['Dekha? Cycle bhi tez chalti hai!', 'Lal topi zindabad!'],
  raceWon: ['Pehle pahuncha! Ab ribbon kahaan hai?'],
  raceLost: ['Map galat tha! Expressway itna lamba kyun hai?', 'Main to sirf warm-up kar raha tha!'],
  mayhemStart: ['Vaade hi vaade! Pakdo agar pakad sako!', 'Naya manifesto, naya jhola!'],
  mayhemEmpty: ['Arre, manifesto khatam? Aur chhapwao!', 'Copter ka petrol bhi vaade mein tha…'],
  mayhemWon: ['Dekha? Vaade bhaari padte hain!'],
} as const;

/** Comic burst words for stumbles and crashes. */
export const COMIC_WORDS: readonly string[] = ['DHADAAM!', 'ARRE BAAP RE!', 'DHISHUM!', 'OYE!', 'HAAYE!', 'BONK!', 'THUD!', 'WHOOPS!'];

export function pick<T>(list: readonly T[], random: () => number = Math.random): T {
  return list[Math.floor(random() * list.length)];
}
