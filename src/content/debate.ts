/**
 * Debate Arena script. ALL lines are fictional, comic campaign-style
 * dialogue written for the game. They are not quotes and must never be
 * presented as something a real politician said. The rival's lines are
 * campaign bravado, not admissions or allegations. Jabs refer only to the
 * public record in facts.ts (slogans, results, the 2017 symbol dispute,
 * the laptop scheme) or are labelled political claims.
 */
export interface DebateOption {
  text: string;
  /** Audience reaction, 0-3. */
  score: number;
  reaction: string;
}

export interface DebateRound {
  topic: string;
  rival: string;
  options: [DebateOption, DebateOption, DebateOption];
  /** The rival's comeback after the player's answer (fictional). */
  heckle?: string;
}

export const DEBATE_ROUNDS: readonly DebateRound[] = [
  {
    topic: 'Promises',
    rival: 'Our manifesto has the shiniest promises in all of UP!',
    options: [
      { text: 'Promises are easy. Delivery is the challenge!', score: 3, reaction: 'The crowd roars!' },
      { text: 'Shiny is nice. Smooth roads are nicer.', score: 2, reaction: 'Laughter and applause.' },
      { text: 'Um… is that a new font?', score: 0, reaction: 'Crickets.' },
    ],
    heckle: 'Our manifesto has a director’s cut coming out soon!',
  },
  {
    topic: 'Who started what',
    rival: 'We started some of these projects first, you know!',
    options: [
      { text: 'Good starts deserve credit — finishing is the real scoreboard.', score: 3, reaction: 'Even the rival’s fans nod.' },
      { text: 'Starting is half the race. We ran the other half!', score: 2, reaction: 'Big cheer.' },
      { text: 'Next question!', score: 0, reaction: 'Booing from the back row.' },
    ],
  },
  {
    topic: 'Kaam Bolta Hai',
    rival: 'Our work speaks for itself!',
    options: [
      { text: 'It spoke in 2017, bhaiya. It said: forty-seven seats.', score: 3, reaction: 'The arena explodes! Someone faints from laughing.' },
      { text: 'Our work doesn’t just speak — it shows. Kaam dikhta hai!', score: 3, reaction: 'Chants of “dikhta hai!”' },
      { text: 'Speaks? I can’t hear anything.', score: 1, reaction: 'Polite giggles.' },
    ],
    heckle: 'It was speaking softly. Very softly.',
  },
  {
    topic: 'Family business',
    rival: 'Our party is one big, happy family!',
    options: [
      { text: 'Party ticket or family ticket? Voters can tell the difference.', score: 3, reaction: 'Whistles and applause!' },
      { text: 'Happy family? The 2017 cycle-symbol hearing begs to differ.', score: 3, reaction: 'Gasps, then a standing ovation.' },
      { text: 'Families are lovely. I brought cake.', score: 0, reaction: 'Someone eats the cake.' },
    ],
    heckle: 'Every family has… meetings.',
  },
  {
    topic: 'Laptops',
    rival: 'We gave laptops to the youth!',
    options: [
      { text: 'And the youth logged in, checked the record, and voted for performance.', score: 3, reaction: 'Students in the crowd cheer!' },
      { text: 'Laptops are nice. Jobs to use them in are nicer.', score: 2, reaction: 'Nods all round.' },
      { text: 'I prefer typewriters.', score: 0, reaction: 'A typewriter dings sadly.' },
    ],
    heckle: 'Ours had excellent… buffering.',
  },
  {
    topic: 'The cycle',
    rival: 'The cycle is the people’s vehicle!',
    options: [
      { text: 'Lovely — ride it on the expressways we finished.', score: 3, reaction: 'Huge laugh!' },
      { text: 'Even cycles need roads without potholes.', score: 2, reaction: 'Applause.' },
      { text: 'Mine has training wheels.', score: 0, reaction: 'Silence. A cricket chirps.' },
    ],
    heckle: 'My cycle has… a very loud bell.',
  },
  {
    topic: 'Colours',
    rival: 'Red is the colour of revolution!',
    options: [
      { text: 'In traffic, red means STOP. UP chose GO.', score: 3, reaction: 'Horns honk outside in agreement!' },
      { text: 'Saffron means sunrise. Good morning, UP!', score: 2, reaction: 'The crowd waves.' },
      { text: 'I’m colour-blind, sorry.', score: 0, reaction: 'Awkward pause.' },
    ],
  },
  {
    topic: 'Alliances',
    rival: 'We have the strongest alliance in UP!',
    options: [
      { text: 'Alliances change every election. The scoreboard doesn’t.', score: 3, reaction: 'Thunderous applause.' },
      { text: 'Alliance of convenience versus a record of delivery.', score: 2, reaction: 'Cheers from the front.' },
      { text: 'Is that like a WhatsApp group?', score: 1, reaction: 'Phones buzz everywhere.' },
    ],
    heckle: 'We are adding new members… daily.',
  },
  {
    topic: 'Credit',
    rival: 'That expressway was our idea!',
    options: [
      { text: 'Ideas are free. Finishing takes work — and we finished.', score: 3, reaction: 'Mic drop moment!' },
      { text: 'Thank you for the idea. We’ll handle the ribbon.', score: 2, reaction: 'Laughter rolls through the hall.' },
      { text: 'My idea was pizza.', score: 0, reaction: 'Someone orders pizza.' },
    ],
    heckle: 'We also had the idea for the ribbon!',
  },
  {
    topic: 'Elections',
    rival: 'Just wait till the next election!',
    options: [
      { text: 'Performance doesn’t wait for elections.', score: 3, reaction: 'Standing ovation.' },
      { text: 'Development ka scoreboard kholo!', score: 3, reaction: 'Chants fill the arena!' },
      { text: 'I’ll wait. I brought snacks.', score: 1, reaction: 'Snacks are shared.' },
    ],
  },
  {
    topic: 'Development',
    rival: 'Development is just a slogan!',
    options: [
      { text: 'Then come drive the slogan at 120 km/h.', score: 3, reaction: 'The crowd revs imaginary engines!' },
      { text: 'Slogans don’t build airports. Budgets and work do.', score: 3, reaction: 'Big applause.' },
      { text: 'Everything is a slogan if you shout it.', score: 1, reaction: 'Mild shouting.' },
    ],
  },
  {
    topic: 'Law and order',
    rival: '“Gundaraj” is just your campaign slogan!',
    options: [
      { text: 'Then let voters judge governance on the record, not slogans.', score: 3, reaction: 'Thoughtful applause.' },
      { text: 'Gundaraj or good governance? The voters decide!', score: 2, reaction: 'Cheers from the front rows.' },
      { text: 'Slogan? I prefer the word “brand”.', score: 1, reaction: 'Mixed reactions.' },
    ],
  },
  {
    topic: 'Scoreboards',
    rival: 'Who needs a scoreboard when you have a great slogan?',
    options: [
      { text: 'Har challenge ka jawab — performance!', score: 3, reaction: 'Huge applause!' },
      { text: 'A slogan is a promise. A scoreboard is the receipt.', score: 3, reaction: 'Someone shouts “receipt!”' },
      { text: 'Slogans are great. I have twelve.', score: 1, reaction: 'Polite laughter.' },
    ],
  },
  {
    topic: 'Speed',
    rival: 'We will build faster than anyone!',
    options: [
      { text: 'You had five years. The stopwatch is still running.', score: 3, reaction: 'Ooooh! The crowd loves it.' },
      { text: 'Faster than “opening soon”? Bold.', score: 2, reaction: 'Laughter.' },
      { text: 'I’m more of a jogger.', score: 0, reaction: 'Someone jogs out.' },
    ],
    heckle: 'The stopwatch was… on mute.',
  },
];

/** Rounds played in one debate (picked at random from the script). */
export const DEBATE_ROUNDS_PER_GAME = 5;
export const DEBATE_WIN_SCORE = 10;

/** A fresh debate: random rounds, options shuffled so the best reply moves around. */
export function pickDebate(random: () => number = Math.random): DebateRound[] {
  const pool = [...DEBATE_ROUNDS];
  const out: DebateRound[] = [];
  while (out.length < DEBATE_ROUNDS_PER_GAME && pool.length) {
    const r = pool.splice(Math.floor(random() * pool.length), 1)[0];
    const opts = [...r.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    out.push({ ...r, options: opts as DebateRound['options'] });
  }
  return out;
}
