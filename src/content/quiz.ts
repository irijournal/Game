/**
 * Accountability Gate questions. Answers come from `facts.ts` (with
 * sources) or teach the difference between facts, government figures,
 * claims and fiction. Options are shown on the three lanes (A / B / C).
 */
export interface QuizQuestion {
  id: string;
  q: string;
  options: [string, string, string];
  answer: 0 | 1 | 2;
  factId: string;
}

export const QUIZ: readonly QuizQuestion[] = [
  { id: 'q.purvanchal', q: 'Which expressway was inaugurated on 16 Nov 2021?', options: ['Purvanchal', 'Agra–Lucknow', 'Bundelkhand'], answer: 0, factId: 'purvanchal' },
  { id: 'q.agraLucknow', q: 'Who inaugurated the Agra–Lucknow Expressway in 2016?', options: ['PM Modi', 'CM Akhilesh Yadav', 'CM Yogi Adityanath'], answer: 1, factId: 'agraLucknow' },
  { id: 'q.bundelkhand', q: 'The Bundelkhand Expressway opened in…', options: ['2012', '2017', '2022'], answer: 2, factId: 'bundelkhand' },
  { id: 'q.ganga', q: 'The Ganga Expressway links Meerut to…', options: ['Prayagraj', 'Agra', 'Gorakhpur'], answer: 0, factId: 'ganga' },
  { id: 'q.ayodhyaAirport', q: 'Ayodhya’s international airport is named after…', options: ['Maharishi Valmiki', 'Chandragupta', 'Tulsidas'], answer: 0, factId: 'ayodhyaAirport' },
  { id: 'q.kashi', q: 'Kashi Vishwanath Dham (phase 1) opened in…', options: ['2014', '2021', '2025'], answer: 1, factId: 'kashi' },
  { id: 'q.kushinagar', q: 'Kushinagar International Airport opened in…', options: ['2011', '2016', '2021'], answer: 2, factId: 'kushinagar' },
  { id: 'q.noida', q: 'Noida International Airport is at…', options: ['Jewar', 'Kanpur', 'Bareilly'], answer: 0, factId: 'noidaAirport' },
  { id: 'q.pmKisan', q: 'Where was PM-KISAN launched in 2019?', options: ['Lucknow', 'Gorakhpur', 'Kanpur'], answer: 1, factId: 'pmKisan' },
  { id: 'q.ujjwala', q: 'Ujjwala Yojana provides…', options: ['School bags', 'LPG connections', 'Bicycles'], answer: 1, factId: 'ujjwala' },
  { id: 'q.jalJeevan', q: 'Jal Jeevan Mission’s goal is…', options: ['Tap water at home', 'Free buses', 'New stadiums'], answer: 0, factId: 'jalJeevan' },
  { id: 'q.gis', q: '₹33.5 lakh crore at UP GIS 2023 means…', options: ['Money spent', 'Proposals (MoUs)', 'State budget'], answer: 1, factId: 'gis2023' },
  { id: 'q.metro', q: 'Lucknow Metro’s first section opened in…', options: ['2014', '2017', '2021'], answer: 1, factId: 'lucknowMetro' },
  { id: 'q.gundaraj', q: 'In this game, “Gundaraj” is…', options: ['A statistic', 'A political slogan', 'A scheme'], answer: 1, factId: 'gundaraj' },
  { id: 'q.govt', q: 'A “government-reported” figure is…', options: ['Audited by us', 'Made up', 'Reported by govt'], answer: 2, factId: 'jalJeevan' },
  { id: 'q.score', q: 'Your game score measures…', options: ['Your run', 'Real governance', 'Crime rates'], answer: 0, factId: 'gameElements' },
];

export function quizById(id: string): QuizQuestion | undefined {
  return QUIZ.find((q) => q.id === id);
}
