# Sources for real-world information in UP RUN

Everything the game says about the real world lives in `src/content/facts.ts`. To update a figure, edit that file, not the UI, and keep the source, its date and the note next to it.

Each entry is labelled with one of four types. The same labels appear in the game, on the **Achievements & Facts → Evidence board**, on level intro screens and on the card shown after an Accountability Gate.

| Label | Meaning |
|---|---|
| **Verified fact** | An event or date reported by multiple independent sources. |
| **Government-reported** | A figure or achievement as reported by a government body. Not independently audited here. |
| **Political claim** | A political argument, slogan or campaign position. Others contest it. |
| **Fictional game element** | Invented for the game. Not a statement about the real world. |

Sources were checked on **2026-10-29**. Some government pages could not be reached from the build environment (for example `invest.up.gov.in`). Those figures are cited from other published reports instead, and any figure that could not be sourced was left out of the game.

## Ground rules followed

- **No fabricated quotations.** All dialogue (captions, rival lines) and all slogans were written for the game. They are labelled as fictional, and none is attributed to a real person as something they said.
- **No accusations.** The game awards no points for accusations. "Gundaraj" appears only as a labelled campaign slogan on fictional signs. Criminals, corrupt officials and similar negative roles do not appear as real people; the only negative obstacles are fictional signs ("UNFINISHED PROJECT", "DELAYED").
- **Credit where it is due.** Where a project began under an earlier (SP) government, the note says so: the Agra–Lucknow Expressway, the Purvanchal Expressway's 2015 announcement, and the Lucknow Metro's 2014 foundation stone. The game does not claim that every expressway, metro or airport was proposed or built entirely by BJP governments.
- **Central vs. state.** PM-KISAN, Ujjwala and Jal Jeevan are central-government schemes. The notes say so; the game presents them as launched in or relevant to UP, not as state schemes.
- **Proposals are not investment.** The ₹33.5 lakh crore UP GIS 2023 figure is labelled government-reported and described as MoUs/proposals.
- **Game scores are fictional.** Points, stars, tokens and the scoreboard measure the player's run, not real governance. The UI repeats this wherever scores appear.

## Satire content (`src/content/jokes.ts`, `mayhem.ts`)

News-ticker headlines, hero catchphrases, the rival caricature's one-liners and the Manifesto Mayhem crate labels are **fictional satire written for the game**. The UI labels every one of them: "UP RUN NEWS • satire, not real news", "fictional line", "game slogan". Jokes that mention a real-world number use only figures from the entries below (for example, the SP's 47 seats in 2017). None of these lines is a quote from a real person, and none accuses a real person of a crime. The Mayhem crate promises ("FREE MOON TRIP", "EXPRESSWAY TO MARS"…) are invented exaggerations; they are not taken from any real manifesto, and the game says so on the mode screen and on every crate.

## Entries

### Purvanchal Expressway (verified)
The ~341 km Lucknow–Ghazipur expressway was inaugurated by PM Narendra Modi on 16 Nov 2021, under the BJP state government.
*Note:* first announced in 2015 under the SP government as the "Samajwadi Purvanchal Expressway". The BJP government re-tendered and re-routed it, and a new foundation stone was laid on 14 Jul 2018.
- PIB / MoRTH backgrounder (2021-11-15): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2021/nov/doc2021111531.pdf
- UPEIDA: https://upeida.up.gov.in/en/page/the-purvanchal-expressway
- Wikipedia (history): https://en.wikipedia.org/wiki/Purvanchal_Expressway

### Agra–Lucknow Expressway (verified)
The ~302 km expressway was inaugurated on 21 Nov 2016 by then Chief Minister Akhilesh Yadav (SP government). It is an SP-era project, credited as such.
- Business Today (2016-11-21): https://www.businesstoday.in/amp/latest/economy-politics/story/agra-lucknow-expressway-inaugurated-uttar-pradesh-poll-66754-2016-11-21

### Bundelkhand Expressway (verified)
The ~296 km expressway was inaugurated by PM Narendra Modi on 16 Jul 2022. Its foundation stone was laid on 29 Feb 2020.
- The Tribune (2022-07-16): https://m.tribuneindia.com/news/nation/pm-modi-inaugurates-bundelkhand-expressway-in-up-412990

### Ganga Expressway (verified)
The ~594 km Meerut–Prayagraj expressway was inaugurated by PM Narendra Modi on 29 Apr 2026. *Note:* some listings describe this opening as phase 1.
- IBEF (2026-04): https://www.ibef.org/news/prime-minister-mr-narendra-modi-inaugurates-594-km-ganga-expressway-connecting-meerut-to-prayagraj
- Wikipedia: https://en.wikipedia.org/wiki/Ganga_Expressway

### Maharishi Valmiki International Airport, Ayodhya (verified)
Inaugurated by PM Narendra Modi on 30 Dec 2023.
- PMIndia (2023-12-30): https://www.pmindia.gov.in/en/news_updates/pm-inaugurates-maharishi-valmiki-international-airport-at-ayodhya-dham/

### Ram Mandir consecration (verified)
The Pran Pratishtha ceremony at the Shri Ram Janmabhoomi temple, Ayodhya, took place on 22 Jan 2024, with PM Narendra Modi taking part. The game's Ayodhya scenery is a stylised, fictionalised setting, not a depiction of the temple.
- PMIndia (2024-01): https://www.pmindia.gov.in/?p=16365077

### Shri Kashi Vishwanath Dham (verified)
Phase 1 of the corridor in Varanasi was inaugurated by PM Narendra Modi on 13 Dec 2021.
- Scroll.in (2021-12-13): https://scroll.in/latest/1012699/prime-minister-narendra-modi-to-inaugurate-first-phase-of-kashi-vishwanath-corridor-today

### Kushinagar International Airport (verified)
Inaugurated by PM Narendra Modi on 20 Oct 2021.
- Indian Infrastructure (2021-10): https://indianinfrastructure.com/?p=72100
- Wikipedia: https://en.wikipedia.org/wiki/Kushinagar_International_Airport

### Noida International Airport, Jewar (verified)
Phase 1 was inaugurated by PM Narendra Modi on 28 Mar 2026. *Note:* commercial flights were announced from 15 Jun 2026, and the opening slipped several times from an original 2022–2024 target.
- IANS (2026-03-28): https://ianslive.in/pm-modi-to-inaugurate-noida-international-airport-today--20260328065335
- Business Today (2026-05-01): https://www.businesstoday.in/india/story/noida-international-airport-to-start-commercial-flights-from-june-15-these-airlines-to-operate-first-flights-528494-2026-05-01

### PM-KISAN (verified)
Pays eligible small and marginal farmer families ₹6,000 a year in three instalments. Launched at Gorakhpur, UP on 24 Feb 2019. A central scheme.
- ICAR (2019-02): https://icar.org.in/en/node/11512

### Pradhan Mantri Ujjwala Yojana (verified)
Provides LPG connections to poor households. Launched on 1 May 2016 at Ballia, UP. A central scheme.
- PIB factsheet: https://www.pib.gov.in/FactsheetDetails.aspx?Id=148555
- PMUY: https://pmuy.gov.in/about.html

### Jal Jeevan Mission / Har Ghar Jal (government-reported)
Announced on 15 Aug 2019 to give every rural household a tap connection. The government reports 15.91 crore households covered nationally (Aug 2026). *Note:* a national figure, not UP-only, and it changes frequently.
- All India Radio / newsonair.gov.in (2026-08-14): https://newsonair.gov.in/over-2-lakh-villages-declared-har-ghar-jal-certified-under-jal-jeevan-mission-govt/

### UP Global Investors Summit 2023 (government-reported)
The UP government reported investment proposals (MoUs) worth ₹33.5 lakh crore from the summit held on 10–12 Feb 2023 in Lucknow. *Note:* these are proposals, not money invested, and MoU counts differ between reports.
- UP Legislative Assembly (NeVA) reply: https://cms.neva.gov.in/NeVA/UP/FileStructure/PaperLaid/18/7/Signed/18_7_S_18629_V2_Signed.pdf
- Outlook Business (2023-02): https://www.outlookbusiness.com/topic/uttar-pradesh-global-investors-summit-2023

### Lucknow Metro (verified)
The first section opened on 5 Sep 2017 under the BJP government. The foundation stone was laid in Mar 2014 under the SP government.
- Wikipedia: https://en.wikipedia.org/wiki/Lucknow_Metro
- The Quint (2017-09): https://www.thequint.com/amp/story/news/india/lucknow-metro-rail-all-you-need-to-know

### Maha Kumbh 2025 (government-reported)
The UP government reported over 66.21 crore devotees bathing at the Triveni Sangam during the Maha Kumbh (13 Jan – 26 Feb 2025). This is the official tally announced on 26 Feb 2025; it has not been independently audited.
- Morung Express (2025-02-26): https://morungexpress.com/6621-crore-devotees-in-maha-kumbh-set-global-record
- India TV (2025-02-26): https://www.indiatvnews.com/uttar-pradesh/mahakumbh-over-66-21-crore-devotees-took-holy-dip-at-triveni-sangam-cm-yogi-adityanath-shares-count-2025-02-26-978119

### One District One Product (verified)
Launched by the UP government on 24 Jan 2018 to promote one signature product from each of the 75 districts. Job and export figures quoted for ODOP are government-reported.
- UP Government: https://www.library.up.gov.in/Pages/odop/en

### UP Assembly election 2017 (verified)
The BJP won 312 of 403 seats on its own (325 with allies), returning to power after 15 years. The SP won 47 seats and its ally Congress 7.
- Wikipedia: https://en.wikipedia.org/wiki/2017_Uttar_Pradesh_Legislative_Assembly_election

### UP Assembly election 2022 (verified)
The BJP won 255 seats (273 with allies) and kept power; the SP won 111 and became the main opposition party.
- ETV Bharat (2022-03-10): https://www.etvbharat.com/english/bharat/up-election-result-2022-a-saffron-landscape-with-patches-of-red/na20220310222016822

### "Kaam Bolta Hai" (verified)
"Kaam Bolta Hai" (the work speaks) was the theme of the SP's 2017 assembly campaign, and the SP won 47 seats in that election. The in-game "KAAM BOLTA HAI?" board pairs the real slogan with the real result; the joke itself is satire.
- The Pioneer (2020): https://www.dailypioneer.com/2020/state-editions/sp-launches-campaign--for-up-assembly-polls.html
- Millennium Post (2017-02): https://www.millenniumpost.in/nation/news-183720

### The 2017 Samajwadi family feud (verified)
The SP split on 1 Jan 2017 when Akhilesh Yadav's faction replaced his father Mulayam Singh Yadav as party president. On 16 Jan 2017 the Election Commission awarded the party name and the cycle symbol to Akhilesh's faction. The in-game "PARIVAAR MEETING" roadblock uses *fictional* red-cap relatives, not real people.
- Scroll.in (2017-01-16): https://scroll.in/a/826874
- Onmanorama (2017-01): https://www.onmanorama.com/in-depth/assembly-poll--five-states-up/ec-gives-cycle-symbol-to-akhilesh-faction-sp-feud-.amp.html

### SP's free laptop scheme (verified)
The SP's 2012 manifesto promised free laptops to Class 12 pass-outs. The 2012–13 budget set aside ₹2,721 crore, and the scheme was shelved in the 2014–15 budget. Reports disagree on how many laptops were finally handed out, so the game quotes no number.
- Wikipedia: https://en.wikipedia.org/wiki/Free_laptop_distribution_scheme_of_the_Uttar_Pradesh_government
- Gulf News: https://gulfnews.com/world/asia/india/uttar-pradesh-governments-laptop-scheme-crashes-1.1205091

### "Parivarvad" / dynasty politics (political claim)
The BJP attacks the SP as a party of dynasty politics. The SP was founded by Mulayam Singh Yadav and is led by his son Akhilesh Yadav, and several family members have held party posts and seats. Those family facts are on the record; whether that makes a party worse is the political argument, and the SP rejects the charge.
- Wikipedia: https://en.wikipedia.org/wiki/Samajwadi_Party

### Law and order as a campaign theme (political claim)
The BJP presents law and order as a central achievement of its UP government, and opposition parties including the SP dispute that record. The game uses this as a campaign theme only and shows no crime statistics.

### "Gundaraj" (political claim)
A political attack line used in campaigns against rival governments. In the game it appears only on fictional signs and in campaign-style slogans. It is not a statement about any real person or party member.

### Viksit UP (political claim)
"Viksit Uttar Pradesh" (developed UP) is the state government's stated development vision. It is a goal and slogan, not a measured outcome.

### What is made up (fictional)
Development tokens, the scoreboard, the Showdown Meter, the bulldozer showdown, rival encounters and all dialogue are fictional game elements.
