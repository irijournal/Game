/**
 * Debate Arena script. ALL lines are fictional, comic campaign-style
 * dialogue written for the game. They are not quotes and must never be
 * presented as something a real politician said. The rival's lines are
 * campaign bravado, not admissions or allegations.
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
    topic: 'Connectivity',
    rival: 'Our campaign speeches never stop rolling!',
    options: [
      { text: 'UP’s future is on the move — on expressways and airports!', score: 3, reaction: 'Standing ovation!' },
      { text: 'Speeches roll. Trucks roll faster on new roads.', score: 2, reaction: 'Chuckles.' },
      { text: 'Rolling? Like… a samosa?', score: 1, reaction: 'Someone in the crowd is hungry.' },
    ],
  },
  {
    topic: 'Scoreboards',
    rival: 'Who needs a scoreboard when you have a great slogan?',
    options: [
      { text: 'Development ka scoreboard kholo!', score: 3, reaction: 'Chants fill the arena!' },
      { text: 'Har challenge ka jawab — performance!', score: 3, reaction: 'Huge applause!' },
      { text: 'Slogans are great. I have twelve.', score: 1, reaction: 'Polite laughter.' },
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
];

export const DEBATE_WIN_SCORE = 10;
