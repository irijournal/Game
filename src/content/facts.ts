/**
 * Real-world information shown in the game. Every entry is labelled with
 * one of four types so players can tell them apart:
 *
 *  - verified:  an event or date independently reported by several sources
 *  - govt:      a figure or achievement reported by a government body
 *  - claim:     a political argument, slogan or campaign position
 *  - fiction:   a game element that is made up
 *
 * Facts were checked on `CHECKED` against the listed sources. Edit this file
 * (not the UI) to update figures; keep the source, its date and the note.
 * Where a project began under an earlier (SP) government, the note says so:
 * the game does not attribute such projects entirely to BJP governments.
 */

export type FactType = 'verified' | 'govt' | 'claim' | 'fiction';

export const FACT_TYPE_LABEL: Record<FactType, string> = {
  verified: 'Verified fact',
  govt: 'Government-reported',
  claim: 'Political claim',
  fiction: 'Fictional game element',
};

export const FACT_TYPE_HELP: Record<FactType, string> = {
  verified: 'An event or date reported by multiple independent sources.',
  govt: 'A figure or achievement as reported by a government body; not independently audited here.',
  claim: 'A political argument, slogan or campaign position. Contested by others.',
  fiction: 'Invented for the game. Not a statement about the real world.',
};

export interface Source {
  publisher: string;
  title: string;
  url: string;
  date?: string;
}

export interface Fact {
  id: string;
  title: string;
  text: string;
  type: FactType;
  sources: Source[];
  /** Context that keeps the claim honest (who started what, caveats). */
  note?: string;
}

export const CHECKED = '2026-10-29';

export const FACTS: readonly Fact[] = [
  {
    id: 'purvanchal',
    title: 'Purvanchal Expressway',
    text: 'The ~341 km Purvanchal Expressway (Lucknow to Ghazipur) was inaugurated by PM Narendra Modi on 16 November 2021, under the BJP state government.',
    type: 'verified',
    note: 'First announced in 2015 under the SP government as the "Samajwadi Purvanchal Expressway". The BJP government re-tendered and re-routed it; PM Modi laid a new foundation stone on 14 July 2018.',
    sources: [
      { publisher: 'PIB / Ministry of Road Transport & Highways', title: 'Purvanchal Expressway backgrounder', url: 'https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/nov/doc2021111531.pdf', date: '2021-11-15' },
      { publisher: 'UPEIDA', title: 'The Purvanchal Expressway', url: 'https://upeida.up.gov.in/en/page/the-purvanchal-expressway' },
      { publisher: 'Wikipedia', title: 'Purvanchal Expressway (history)', url: 'https://en.wikipedia.org/wiki/Purvanchal_Expressway' },
    ],
  },
  {
    id: 'agraLucknow',
    title: 'Agra–Lucknow Expressway',
    text: 'The ~302 km Agra–Lucknow Expressway was inaugurated on 21 November 2016 by then Chief Minister Akhilesh Yadav (SP government).',
    type: 'verified',
    note: 'An SP-era project. Shown here because a credible scoreboard credits work to whoever did it.',
    sources: [{ publisher: 'Business Today', title: 'Agra-Lucknow Expressway inaugurated ahead of Uttar Pradesh assembly poll', url: 'https://www.businesstoday.in/amp/latest/economy-politics/story/agra-lucknow-expressway-inaugurated-uttar-pradesh-poll-66754-2016-11-21', date: '2016-11-21' }],
  },
  {
    id: 'bundelkhand',
    title: 'Bundelkhand Expressway',
    text: 'The ~296 km Bundelkhand Expressway was inaugurated by PM Narendra Modi on 16 July 2022. Its foundation stone was laid on 29 February 2020.',
    type: 'verified',
    sources: [{ publisher: 'The Tribune', title: 'PM Modi inaugurates Bundelkhand Expressway in UP', url: 'https://m.tribuneindia.com/news/nation/pm-modi-inaugurates-bundelkhand-expressway-in-up-412990', date: '2022-07-16' }],
  },
  {
    id: 'ganga',
    title: 'Ganga Expressway',
    text: 'The ~594 km Ganga Expressway (Meerut to Prayagraj) was inaugurated by PM Narendra Modi on 29 April 2026.',
    type: 'verified',
    note: 'Some listings describe the opening as phase 1; check current status before quoting completion.',
    sources: [
      { publisher: 'IBEF', title: 'PM inaugurates 594 km Ganga Expressway connecting Meerut to Prayagraj', url: 'https://www.ibef.org/news/prime-minister-mr-narendra-modi-inaugurates-594-km-ganga-expressway-connecting-meerut-to-prayagraj', date: '2026-04' },
      { publisher: 'Wikipedia', title: 'Ganga Expressway', url: 'https://en.wikipedia.org/wiki/Ganga_Expressway' },
    ],
  },
  {
    id: 'ayodhyaAirport',
    title: 'Maharishi Valmiki International Airport, Ayodhya',
    text: 'Ayodhya’s Maharishi Valmiki International Airport was inaugurated by PM Narendra Modi on 30 December 2023.',
    type: 'verified',
    sources: [{ publisher: 'PMIndia (Prime Minister’s Office)', title: 'PM inaugurates Maharishi Valmiki International Airport at Ayodhya Dham', url: 'https://www.pmindia.gov.in/en/news_updates/pm-inaugurates-maharishi-valmiki-international-airport-at-ayodhya-dham/', date: '2023-12-30' }],
  },
  {
    id: 'pranPratishtha',
    title: 'Ram Mandir consecration',
    text: 'The Pran Pratishtha (consecration) ceremony at the Shri Ram Janmabhoomi temple in Ayodhya took place on 22 January 2024, with PM Narendra Modi taking part.',
    type: 'verified',
    sources: [{ publisher: 'PMIndia (Prime Minister’s Office)', title: 'PM’s programme for the Pran Pratishtha ceremony', url: 'https://www.pmindia.gov.in/?p=16365077', date: '2024-01' }],
  },
  {
    id: 'kashi',
    title: 'Shri Kashi Vishwanath Dham',
    text: 'The first phase of the Shri Kashi Vishwanath Dham corridor in Varanasi was inaugurated by PM Narendra Modi on 13 December 2021.',
    type: 'verified',
    sources: [{ publisher: 'Scroll.in', title: 'PM Modi inaugurates first phase of Kashi Vishwanath corridor', url: 'https://scroll.in/latest/1012699/prime-minister-narendra-modi-to-inaugurate-first-phase-of-kashi-vishwanath-corridor-today', date: '2021-12-13' }],
  },
  {
    id: 'kushinagar',
    title: 'Kushinagar International Airport',
    text: 'Kushinagar International Airport was inaugurated by PM Narendra Modi on 20 October 2021.',
    type: 'verified',
    sources: [
      { publisher: 'Indian Infrastructure', title: 'Prime Minister of India inaugurates Kushinagar International Airport', url: 'https://indianinfrastructure.com/?p=72100', date: '2021-10' },
      { publisher: 'Wikipedia', title: 'Kushinagar International Airport', url: 'https://en.wikipedia.org/wiki/Kushinagar_International_Airport' },
    ],
  },
  {
    id: 'noidaAirport',
    title: 'Noida International Airport (Jewar)',
    text: 'Phase 1 of Noida International Airport at Jewar was inaugurated by PM Narendra Modi on 28 March 2026.',
    type: 'verified',
    note: 'Airport authorities announced commercial flights from 15 June 2026 (Business Today, 1 May 2026). The opening slipped several times from an original 2022–2024 target.',
    sources: [
      { publisher: 'IANS', title: 'PM Modi to inaugurate Noida International Airport today', url: 'https://ianslive.in/pm-modi-to-inaugurate-noida-international-airport-today--20260328065335', date: '2026-03-28' },
      { publisher: 'Business Today', title: 'Noida International Airport to start commercial flights from June 15', url: 'https://www.businesstoday.in/india/story/noida-international-airport-to-start-commercial-flights-from-june-15-these-airlines-to-operate-first-flights-528494-2026-05-01', date: '2026-05-01' },
    ],
  },
  {
    id: 'pmKisan',
    title: 'PM-KISAN',
    text: 'PM-KISAN, which pays eligible small and marginal farmer families ₹6,000 a year in three instalments, was launched at Gorakhpur, Uttar Pradesh on 24 February 2019.',
    type: 'verified',
    note: 'A central (Government of India) scheme, launched in UP.',
    sources: [{ publisher: 'ICAR', title: 'PM to launch PM-KISAN scheme from Gorakhpur in Uttar Pradesh', url: 'https://icar.org.in/en/node/11512', date: '2019-02' }],
  },
  {
    id: 'ujjwala',
    title: 'Pradhan Mantri Ujjwala Yojana',
    text: 'Pradhan Mantri Ujjwala Yojana, which provides LPG cooking-gas connections to poor households, was launched on 1 May 2016 at Ballia, Uttar Pradesh.',
    type: 'verified',
    note: 'A central (Government of India) scheme, launched in UP.',
    sources: [
      { publisher: 'PIB', title: 'Pradhan Mantri Ujjwala Yojana factsheet', url: 'https://www.pib.gov.in/FactsheetDetails.aspx?Id=148555' },
      { publisher: 'PMUY', title: 'About PMUY', url: 'https://pmuy.gov.in/about.html' },
    ],
  },
  {
    id: 'jalJeevan',
    title: 'Jal Jeevan Mission (Har Ghar Jal)',
    text: 'Jal Jeevan Mission, announced on 15 August 2019, aims to give every rural household a tap-water connection. The government reports 15.91 crore households covered nationally (August 2026).',
    type: 'govt',
    note: 'National figure reported by the government; not a UP-only number. Coverage figures change frequently.',
    sources: [{ publisher: 'All India Radio (newsonair.gov.in)', title: 'Over 2 lakh villages declared Har Ghar Jal certified under Jal Jeevan Mission', url: 'https://newsonair.gov.in/over-2-lakh-villages-declared-har-ghar-jal-certified-under-jal-jeevan-mission-govt/', date: '2026-08-14' }],
  },
  {
    id: 'gis2023',
    title: 'UP Global Investors Summit 2023',
    text: 'The UP government reported investment proposals (MoUs) worth ₹33.5 lakh crore from the UP Global Investors Summit, held 10–12 February 2023 in Lucknow.',
    type: 'govt',
    note: 'These are proposals signed, not money already invested. MoU counts differ between reports.',
    sources: [
      { publisher: 'UP Legislative Assembly (NeVA)', title: 'Government reply on UP Global Investors Summit 2023', url: 'https://cms.neva.gov.in/NeVA/UP/FileStructure/PaperLaid/18/7/Signed/18_7_S_18629_V2_Signed.pdf' },
      { publisher: 'Outlook Business', title: 'Uttar Pradesh speeds ahead with investment proposals worth Rs 33.50 lakh crore', url: 'https://www.outlookbusiness.com/topic/uttar-pradesh-global-investors-summit-2023', date: '2023-02' },
    ],
  },
  {
    id: 'lucknowMetro',
    title: 'Lucknow Metro',
    text: 'Lucknow Metro’s first section opened on 5 September 2017 under the BJP government. Its foundation stone had been laid in March 2014 under the SP government.',
    type: 'verified',
    note: 'A project started under one government and completed under the next.',
    sources: [
      { publisher: 'Wikipedia', title: 'Lucknow Metro', url: 'https://en.wikipedia.org/wiki/Lucknow_Metro' },
      { publisher: 'The Quint', title: 'All set to board the Lucknow Metro? Here’s what you should know', url: 'https://www.thequint.com/amp/story/news/india/lucknow-metro-rail-all-you-need-to-know', date: '2017-09' },
    ],
  },
  {
    id: 'lawOrder',
    title: 'Law and order as a campaign theme',
    text: 'The BJP presents law and order as a central achievement of its Uttar Pradesh government. Opposition parties, including the SP, dispute that record.',
    type: 'claim',
    note: 'The game uses this as a campaign theme only. It shows no crime statistics.',
    sources: [],
  },
  {
    id: 'gundaraj',
    title: '“Gundaraj”',
    text: '“Gundaraj” (rule of goons) is a political attack line used in campaigns against rival governments.',
    type: 'claim',
    note: 'In this game it appears only on fictional signs and in campaign-style slogans. It is not a statement about any real person or party member.',
    sources: [],
  },
  {
    id: 'viksitUP',
    title: 'Viksit UP',
    text: '“Viksit Uttar Pradesh” (developed UP) is the state government’s stated development vision.',
    type: 'claim',
    note: 'A goal and slogan, not a measured outcome.',
    sources: [],
  },
  {
    id: 'gameElements',
    title: 'What is made up',
    text: 'Development tokens, the scoreboard, the Showdown Meter, the bulldozer showdown, rival encounters and all dialogue are fictional game elements.',
    type: 'fiction',
    note: 'Game scores are not a measure of any government’s real performance.',
    sources: [],
  },
];

export function factById(id: string): Fact | undefined {
  return FACTS.find((f) => f.id === id);
}
