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
  { id: 'q.kaam', q: '“Kaam Bolta Hai” was whose 2017 campaign theme?', options: ['BJP', 'SP', 'BSP'], answer: 1, factId: 'kaamBoltaHai' },
  { id: 'q.seats2017', q: 'How many seats did the SP win in UP in 2017?', options: ['47', '147', '247'], answer: 0, factId: 'up2017' },
  { id: 'q.seats2022', q: 'The BJP’s own seat tally in UP 2022?', options: ['155', '255', '355'], answer: 1, factId: 'up2022' },
  { id: 'q.cycle', q: 'Jan 2017: who got the SP’s cycle symbol?', options: ['Akhilesh’s faction', 'Mulayam’s faction', 'It was frozen'], answer: 0, factId: 'spFeud' },
  { id: 'q.laptop', q: 'The SP’s 2012 manifesto promised free…', options: ['Scooters', 'Laptops', 'Smartphones'], answer: 1, factId: 'laptopScheme' },
  { id: 'q.odop', q: 'UP’s ODOP means One District One…', options: ['Product', 'Policy', 'Party'], answer: 0, factId: 'odop' },
  { id: 'q.kumbh', q: 'UP govt’s Maha Kumbh 2025 footfall figure?', options: ['6.6 crore', '66 crore', '660 crore'], answer: 1, factId: 'mahaKumbh' },
  { id: 'q.parivar', q: 'In political slang, “parivarvad” means…', options: ['Dynasty politics', 'A family picnic', 'Cycle repair'], answer: 0, factId: 'parivarvad' },
  { id: 'q.gundaraj', q: 'In this game, “Gundaraj” is…', options: ['A statistic', 'A political slogan', 'A scheme'], answer: 1, factId: 'gundaraj' },
  { id: 'q.govt', q: 'A “government-reported” figure is…', options: ['Audited by us', 'Made up', 'Reported by govt'], answer: 2, factId: 'jalJeevan' },
  { id: 'q.score', q: 'Your game score measures…', options: ['Your run', 'Real governance', 'Crime rates'], answer: 0, factId: 'gameElements' },
];

export function quizById(id: string): QuizQuestion | undefined {
  return QUIZ.find((q) => q.id === id);
}
