/**
 * Governance Room: a decision mode about restoring public safety.
 *
 * Every case, place, gang and person here is FICTIONAL. Each choice moves
 * four meters (public safety, rule of law, public trust, development). The
 * mode argues one thing: lasting safety comes from police, evidence and
 * courts working together. Shortcuts that skip due process are always
 * undone by the courts, and no option demolishes anyone's home or punishes
 * anyone without a case.
 */

import type { Txt } from './lang';

export type MeterId = 'safety' | 'law' | 'trust' | 'vikas';
export type Meters = Record<MeterId, number>;
export type ChoiceTag = 'best' | 'good' | 'shortcut' | 'wrong' | 'comic';

export interface GovChoice {
  id: string;
  text: Txt;
  result: Txt;
  tag: ChoiceTag;
  /** Change to each meter (meters run 0..100). */
  d: Partial<Meters>;
}

export interface GovCase {
  id: string;
  icon: string;
  title: Txt;
  situation: Txt;
  choices: readonly GovChoice[];
}

export const METER_ORDER: readonly MeterId[] = ['safety', 'law', 'trust', 'vikas'];

export const METERS: Record<MeterId, { icon: string; name: Txt }> = {
  safety: { icon: '🛡️', name: { en: 'Public safety', hi: 'Suraksha' } },
  law: { icon: '⚖️', name: { en: 'Rule of law', hi: 'Kanoon ka raaj' } },
  trust: { icon: '🤝', name: { en: 'Public trust', hi: 'Janta ka bharosa' } },
  vikas: { icon: '🚀', name: { en: 'Development', hi: 'Vikas' } },
};

export const START_METER = 50;
export const CASES_PER_SHIFT = 5;

export const GOV_TITLE: Txt = { en: 'Governance Room', hi: 'Governance Room' };

export const GOV_PITCH: Txt = {
  en: 'You run the Governance Room of Khushalpur, a fictional district. Five cases land on your desk. Pick a response for each one and watch four meters: public safety, rule of law, public trust and development.',
  hi: 'Aap Khushalpur (ek kaalpanik zila) ka Governance Room chala rahe hain. Desk par paanch case aate hain. Har case ka jawab chuniye aur chaar meter dekhiye: suraksha, kanoon ka raaj, janta ka bharosa aur vikas.',
};

export const GOV_LESSON: Txt = {
  en: 'Lasting safety comes from police, evidence and courts working together. Shortcuts that skip due process get undone in court, and the gang walks free.',
  hi: 'Tikau suraksha police, saboot aur adaalat ke saath kaam karne se aati hai. Due process chhodne wale shortcut court mein palat jaate hain, aur gang azaad ho jaata hai.',
};

export const GOV_DISCLAIMER: Txt = {
  en: 'Every case, place, gang and person in the Governance Room is fictional. The meters are game scores, not a measure of any real government or police force.',
  hi: 'Governance Room ke saare case, jagah, gang aur log kaalpanik hain. Meter sirf game score hain, kisi asli sarkar ya police ka maap nahi.',
};

/** The hero caricature's comic reaction to each kind of choice (game lines, not quotes). */
export const HERO_REACTION: Record<ChoiceTag, Txt> = {
  best: { en: 'Kanoon se kaam, kaam se naam!', hi: 'Kanoon se kaam, kaam se naam!' },
  good: { en: 'Sahi disha — ab poora karo!', hi: 'Sahi disha — ab poora karo!' },
  shortcut: { en: 'Shortcut se court ka chakkar — seedha raasta hi tez hai!', hi: 'Shortcut se court ka chakkar — seedha raasta hi tez hai!' },
  wrong: { en: 'Yeh jawab to Gundaraj ko hi faayda deta hai!', hi: 'Yeh jawab to Gundaraj ko hi faayda deta hai!' },
  comic: { en: 'Committee nahi, kaam chahiye!', hi: 'Committee nahi, kaam chahiye!' },
};

export const GOV_CASES: readonly GovCase[] = [
  {
    id: 'mandi',
    icon: '🥬',
    title: { en: 'Hafta in the Sabzi Mandi', hi: 'Sabzi Mandi mein Hafta' },
    situation: {
      en: 'The fictional Kaala Haath gang collects weekly ‘hafta’ from vegetable sellers in the Khushalpur mandi. The sellers are too scared to complain.',
      hi: 'Kaalpanik ‘Kaala Haath’ gang Khushalpur mandi ke sabzi waalon se har hafte ‘hafta’ vasoolta hai. Dukandaar darr ke maare shikayat nahi karte.',
    },
    choices: [
      {
        id: 'mandi.squad',
        tag: 'best',
        d: { safety: 20, law: 15, trust: 15, vikas: 5 },
        text: { en: 'Anti-extortion squad, an anonymous complaint line and CCTV in the mandi', hi: 'Anti-extortion squad, gupt shikayat helpline aur mandi mein CCTV' },
        result: {
          en: 'Twelve sellers complain anonymously. FIRs are filed, evidence is collected, and the gang is arrested and charge-sheeted.',
          hi: 'Barah dukandaar gupt shikayat karte hain. FIR, saboot, giraftari aur chargesheet — sab kanoon se.',
        },
      },
      {
        id: 'mandi.tv',
        tag: 'shortcut',
        d: { safety: 5, law: -20, trust: -5 },
        text: { en: 'Declare the gang guilty on TV tonight and skip the investigation', hi: 'Aaj raat TV par gang ko doshi ghoshit karo, jaanch chhodo' },
        result: { en: 'With no evidence, the court grants bail within a week. The gang is back in the mandi, smiling.', hi: 'Saboot ke bina hafte bhar mein zamanat. Gang muskurate hue mandi waapas.' },
      },
      {
        id: 'mandi.ignore',
        tag: 'wrong',
        d: { safety: -20, law: -15, trust: -20, vikas: -5 },
        text: { en: 'Call it a ‘minor matter’: the gang ‘helps’ at election time', hi: '‘Chhota maamla’ keh do — chunav mein gang ‘madad’ karta hai' },
        result: { en: 'The hafta doubles and two sellers shut shop. Fictional headline: ‘Mandi mein Gundaraj’.', hi: 'Hafta double, do dukaanein band. Kaalpanik headline: ‘Mandi mein Gundaraj’.' },
      },
      {
        id: 'mandi.committee',
        tag: 'comic',
        d: { safety: -5, trust: -10, vikas: -10 },
        text: { en: 'Form a committee to study hafta for three years', hi: 'Teen saal ke liye hafta par committee bana do' },
        result: { en: 'The committee’s first meeting is postponed. The gang sends sweets.', hi: 'Committee ki pehli meeting postpone. Gang ne mithai bheji.' },
      },
    ],
  },
  {
    id: 'witness',
    icon: '🧾',
    title: { en: 'A Witness Under Pressure', hi: 'Dabaav mein Gawah' },
    situation: {
      en: 'The key witness in a fictional land-grab case says strangers follow her home every evening.',
      hi: 'Ek kaalpanik zameen-kabze ke case ki mukhya gawah kehti hain ki roz shaam anjaan log unka peecha karte hain.',
    },
    choices: [
      {
        id: 'witness.protect',
        tag: 'best',
        d: { safety: 15, law: 20, trust: 15, vikas: 5 },
        text: { en: 'Witness protection, a police escort and a fast-track trial date', hi: 'Gawah suraksha, police escort aur fast-track court ki taareekh' },
        result: {
          en: 'She testifies safely. With her statement and the land records, the court convicts the fictional land-grab gang.',
          hi: 'Gawahi surakshit hoti hai. Bayaan aur zameen ke record se court kaalpanik gang ko saza deta hai.',
        },
      },
      {
        id: 'witness.video',
        tag: 'good',
        d: { safety: 5, law: 15, trust: 10 },
        text: { en: 'Record her statement on video before a magistrate', hi: 'Magistrate ke saamne video par bayaan record karao' },
        result: { en: 'Her statement is safe on record, but she still needs protection. A good step, half the job.', hi: 'Bayaan record par surakshit — par suraksha abhi bhi chahiye. Achha kadam, aadha kaam.' },
      },
      {
        id: 'witness.tv',
        tag: 'shortcut',
        d: { safety: -15, law: -10, trust: -15 },
        text: { en: 'Show her name and photo on TV to prove we are serious', hi: 'Dikhane ke liye TV par uska naam aur photo chala do' },
        result: { en: 'Now the whole district knows who she is, and she stops answering calls. Publicity is not protection.', hi: 'Ab poore zile ko pata hai woh kaun hain. Woh phone uthana band kar deti hain. Publicity suraksha nahi hai.' },
      },
      {
        id: 'witness.adjust',
        tag: 'wrong',
        d: { safety: -15, law: -20, trust: -20 },
        text: { en: 'Ask her to ‘adjust’: the accused has ‘contacts’', hi: 'Unse ‘adjust’ karne ko kaho — aaropi ke ‘contacts’ hain' },
        result: { en: 'She turns hostile in court and the case collapses. Fictional headline: ‘Gawah gayab, gunda azaad’.', hi: 'Court mein gawah palat jaati hain, case dhah jaata hai. Kaalpanik headline: ‘Gawah gayab, gunda azaad’.' },
      },
    ],
  },
  {
    id: 'encroach',
    icon: '🏚️',
    title: { en: 'A Warehouse on the Service Road', hi: 'Service Road par Godown' },
    situation: {
      en: 'A fictional strongman, ‘Bhaukaali Bhaiya’, has built an empty warehouse on public land. It blocks the new expressway service road.',
      hi: 'Kaalpanik dabang ‘Bhaukaali Bhaiya’ ne sarkari zameen par khaali godown bana diya hai. Naye expressway ki service road band hai.',
    },
    choices: [
      {
        id: 'encroach.notice',
        tag: 'best',
        d: { safety: 5, law: 20, trust: 15, vikas: 20 },
        text: { en: 'Serve a legal notice, hold a hearing, then remove the empty illegal structure under the order', hi: 'Kanooni notice do, sunwai karo, phir order ke tahat khaali avaidh dhaancha hatao' },
        result: {
          en: 'He gets his hearing and loses it. The empty warehouse is removed by order and the road opens. No one’s home is touched.',
          hi: 'Sunwai hui, Bhaiya haare. Order se khaali godown hata, road khul gayi. Kisi ka ghar nahi chhua gaya.',
        },
      },
      {
        id: 'encroach.tonight',
        tag: 'shortcut',
        d: { law: -20, trust: -5, vikas: 5 },
        text: { en: 'Skip the notice and clear it tonight', hi: 'Notice chhodo, aaj raat hi hata do' },
        result: { en: 'The court stays the action because no notice was served. The road stays blocked for six more months.', hi: 'Notice na dene par court ne rok laga di. Road chhah mahine aur band.' },
      },
      {
        id: 'encroach.bend',
        tag: 'wrong',
        d: { safety: -5, law: -10, trust: -15, vikas: -15 },
        text: { en: 'Bend the road around his warehouse', hi: 'Road ko unke godown ke ird-gird ghuma do' },
        result: { en: 'The service road now has a mysterious S-bend. Locals call it ‘Bhaiya Turn’.', hi: 'Service road mein ab ek rahasyamay S-mod hai. Log ise ‘Bhaiya Turn’ kehte hain.' },
      },
      {
        id: 'encroach.name',
        tag: 'comic',
        d: { safety: -5, law: -10, trust: -15, vikas: -5 },
        text: { en: 'Name the road after Bhaukaali Bhaiya to keep him happy', hi: 'Bhaiya ko khush karne ke liye road ka naam unke naam par rakh do' },
        result: { en: 'He is delighted, and builds a second warehouse.', hi: 'Bhaiya khush — aur doosra godown bhi bana diya.' },
      },
    ],
  },
  {
    id: 'college',
    icon: '🚏',
    title: { en: 'Safe Streets Near the College', hi: 'College ke Paas Surakshit Sadak' },
    situation: {
      en: 'Students at a fictional Khushalpur college report harassment on the dark road to the bus stop.',
      hi: 'Khushalpur ke ek kaalpanik college ki chhatraayein bus stop tak ki andheri sadak par chhedkhani ki shikayat karti hain.',
    },
    choices: [
      {
        id: 'college.patrol',
        tag: 'best',
        d: { safety: 20, law: 10, trust: 20, vikas: 5 },
        text: { en: 'Street lights, CCTV, women police patrols and a quick-response helpline', hi: 'Street lights, CCTV, mahila police patrol aur turant helpline' },
        result: {
          en: 'The road is lit, patrols are regular and complaints are answered in minutes. Two repeat harassers are arrested on evidence.',
          hi: 'Sadak roshan, patrol niyamit, shikayat par minuton mein jawab. Do aadatan aaropi saboot ke saath giraftaar.',
        },
      },
      {
        id: 'college.curfew',
        tag: 'wrong',
        d: { safety: -5, law: -5, trust: -20, vikas: -10 },
        text: { en: 'Tell the students not to go out after 6 pm', hi: 'Chhatraaon se kaho shaam 6 baje ke baad bahar na niklein' },
        result: {
          en: 'The harassers keep the road and the students lose their evening classes. Safety means stopping harassers, not locking up the people they harass.',
          hi: 'Sadak aaropiyon ke paas, chhatraaon ki shaam ki classes gayi. Suraksha ka matlab aaropi ko rokna hai, peedit ko band karna nahi.',
        },
      },
      {
        id: 'college.moral',
        tag: 'shortcut',
        d: { law: -15, trust: -15 },
        text: { en: 'Have patrols question every couple in the park', hi: 'Patrol se park mein har jode se poochtaach karwao' },
        result: { en: 'Complaints pour in — about the patrol. Moral policing is not law enforcement.', hi: 'Shikayatein aati hain — patrol ke khilaaf. Moral policing kanoon ka paalan nahi hai.' },
      },
      {
        id: 'college.desk',
        tag: 'good',
        d: { safety: 10, law: 10, trust: 10 },
        text: { en: 'Open a women’s help desk at the nearest police station', hi: 'Paas ke thane mein mahila help desk kholo' },
        result: { en: 'Complaints are now taken seriously. Add lights and patrols and the road itself gets safer.', hi: 'Ab shikayat gambheerta se li jaati hai. Lights aur patrol bhi jodo to sadak bhi surakshit ho.' },
      },
    ],
  },
  {
    id: 'paper',
    icon: '📝',
    title: { en: 'Recruitment Exam Paper Leak', hi: 'Bharti Pariksha ka Paper Leak' },
    situation: {
      en: 'A fictional gang leaks a state recruitment exam paper the night before. Lakhs of candidates are angry.',
      hi: 'Ek kaalpanik gang ne bharti pariksha ka paper ek raat pehle leak kar diya. Laakhon ummeedwar naraaz hain.',
    },
    choices: [
      {
        id: 'paper.reexam',
        tag: 'best',
        d: { safety: 10, law: 20, trust: 20, vikas: 10 },
        text: {
          en: 'Cancel it, hold the exam again within weeks with sealed, tracked papers, and let the cyber cell charge the gang',
          hi: 'Pariksha radd, kuch hafton mein sealed-tracked paper se dobara pariksha, aur cyber cell gang par chargesheet kare',
        },
        result: { en: 'The new exam is clean, the gang is charge-sheeted and candidates get a fixed date.', hi: 'Dobara pariksha saaf, gang par chargesheet, ummeedwaron ko pakki taareekh.' },
      },
      {
        id: 'paper.deny',
        tag: 'wrong',
        d: { safety: -5, law: -20, trust: -25, vikas: -5 },
        text: { en: 'Say there was no leak and declare the results', hi: 'Keh do leak hua hi nahi, result ghoshit karo' },
        result: { en: 'Screenshots go viral within an hour. Trust collapses.', hi: 'Ghante bhar mein screenshots viral. Bharosa khatam.' },
      },
      {
        id: 'paper.cancelAll',
        tag: 'comic',
        d: { trust: -15, vikas: -20 },
        text: { en: 'Cancel every exam for a year, just to be safe', hi: 'Suraksha ke liye saal bhar ki saari parikshayein radd' },
        result: { en: 'No leaks — and no recruitment either. Coaching centres throw a party.', hi: 'Na leak, na bharti. Coaching centres mein party.' },
      },
      {
        id: 'paper.dragnet',
        tag: 'shortcut',
        d: { safety: 5, law: -15, trust: -10 },
        text: { en: 'Arrest the first hundred people the gang’s phone ever called', hi: 'Gang ke phone se jinhe bhi call gaya, un pehle sau logon ko pakdo' },
        result: {
          en: 'Ninety of them are pizza shops and relatives. The court releases them, and the real mastermind is still free.',
          hi: 'Unme se nabbe pizza shop aur rishtedaar nikle. Court ne chhoda; asli mastermind abhi bhi azaad.',
        },
      },
    ],
  },
  {
    id: 'rumour',
    icon: '📱',
    title: { en: 'A Fake Video on WhatsApp', hi: 'WhatsApp par Nakli Video' },
    situation: {
      en: 'A doctored video claims a fight broke out after the fictional Khushalpur cricket final. Tension is rising.',
      hi: 'Ek edited video daava karta hai ki kaalpanik Khushalpur cricket final ke baad jhagda hua. Tanaav badh raha hai.',
    },
    choices: [
      {
        id: 'rumour.factcheck',
        tag: 'best',
        d: { safety: 20, law: 15, trust: 20, vikas: 5 },
        text: { en: 'Fact-check it in public, call peace committee meetings and act against whoever made the fake', hi: 'Video ka sach saarvajanik roop se batao, shanti committee baithak karo, aur nakli video banane waalon par kaarvayi karo' },
        result: {
          en: 'The original footage shows both teams shaking hands. The edited clip dies within hours, and its makers face a case.',
          hi: 'Asli footage mein dono team haath mila rahi hain. Nakli clip ghanton mein khatam; banane waalon par case.',
        },
      },
      {
        id: 'rumour.shutdown',
        tag: 'comic',
        d: { safety: 5, law: -5, trust: -10, vikas: -20 },
        text: { en: 'Switch off the internet in the whole state for a month', hi: 'Poore pradesh ka internet ek mahine band' },
        result: { en: 'The rumour stops — and so do online payments, classes and mandi price updates.', hi: 'Afwaah ruki — saath mein online payment, classes aur mandi bhaav bhi.' },
      },
      {
        id: 'rumour.forward',
        tag: 'wrong',
        d: { safety: -20, law: -10, trust: -15 },
        text: { en: 'Forward it ‘for awareness’', hi: '‘Jaankari ke liye’ forward kar do' },
        result: { en: 'It reaches 40 groups by lunch. Awareness of the truth: zero.', hi: 'Dopahar tak 40 groups mein. Sach ki jaankari: zero.' },
      },
      {
        id: 'rumour.patrol',
        tag: 'good',
        d: { safety: 10, law: 5, trust: 5 },
        text: { en: 'Send extra police patrols to the area', hi: 'Ilaake mein police gasht badha do' },
        result: { en: 'The streets stay calm, but the fake video keeps spreading online.', hi: 'Sadkein shaant, par nakli video online failta raha.' },
      },
    ],
  },
  {
    id: 'sand',
    icon: '🚚',
    title: { en: 'Illegal Sand Mining at Night', hi: 'Raat mein Avaidh Ret Khanan' },
    situation: {
      en: 'Trucks run by a fictional mafia dig sand out of the river bed at night without permits.',
      hi: 'Kaalpanik mafia ke truck raat mein bina permit nadi se ret nikaal rahe hain.',
    },
    choices: [
      {
        id: 'sand.drone',
        tag: 'best',
        d: { safety: 15, law: 15, trust: 10, vikas: 10 },
        text: { en: 'Drone watch, an e-permit for every truck, and seize illegal trucks with a proper case', hi: 'Drone nigrani, har truck ka e-permit, aur avaidh trucks ko kanooni case ke saath zabt karo' },
        result: {
          en: 'Night checks catch 30 trucks with evidence. Legal sand gets cheaper and the river bank stops collapsing.',
          hi: 'Raat ki jaanch mein 30 truck saboot ke saath pakde gaye. Kanooni ret sasti, nadi ka kinara bacha.',
        },
      },
      {
        id: 'sand.share',
        tag: 'wrong',
        d: { safety: -15, law: -20, trust: -20, vikas: -5 },
        text: { en: 'Take a ‘share’ and look away', hi: '‘Hissa’ lo aur nazar pher lo' },
        result: { en: 'The river bank caves in near a village. Fictional headline: ‘Ret mafia ka raaj’.', hi: 'Gaon ke paas nadi ka kinara dhaha. Kaalpanik headline: ‘Ret mafia ka raaj’.' },
      },
      {
        id: 'sand.ban',
        tag: 'comic',
        d: { trust: -10, vikas: -20 },
        text: { en: 'Ban all construction in the district', hi: 'Zile mein saara nirmaan band' },
        result: { en: 'No illegal sand — and no houses, schools or roads either.', hi: 'Avaidh ret band — saath mein ghar, school aur sadak bhi.' },
      },
      {
        id: 'sand.post',
        tag: 'good',
        d: { safety: 10, law: 5, trust: 5 },
        text: { en: 'Put a police checkpost at the main ghat', hi: 'Mukhya ghat par police chowki' },
        result: { en: 'That ghat goes quiet. The trucks move two kilometres downstream.', hi: 'Woh ghat shaant. Truck do kilometre neeche chale gaye.' },
      },
    ],
  },
  {
    id: 'backlog',
    icon: '🏛️',
    title: { en: 'Cases Stuck for Years', hi: 'Saalon se Atke Case' },
    situation: {
      en: 'Hundreds of serious cases in fictional Khushalpur’s courts are stuck because forensic reports take years.',
      hi: 'Kaalpanik Khushalpur ki adaalaton mein saikdon gambheer case atke hain, kyunki forensic report mein saal lag jaate hain.',
    },
    choices: [
      {
        id: 'backlog.lab',
        tag: 'best',
        d: { safety: 15, law: 20, trust: 15, vikas: 10 },
        text: { en: 'A new forensic lab, e-courts and fast-track courts for serious crimes', hi: 'Naya forensic lab, e-court aur gambheer apraadhon ke liye fast-track court' },
        result: { en: 'Reports now take weeks, not years. Verdicts arrive while witnesses still remember.', hi: 'Report ab saalon nahi, hafton mein. Faisle tab aate hain jab gawahon ko yaad ho.' },
      },
      {
        id: 'backlog.tv',
        tag: 'shortcut',
        d: { safety: -5, law: -25, trust: -10 },
        text: { en: 'Decide cases in a TV debate: the loudest side wins', hi: 'Case TV debate mein tay karo — jo zor se chillaaye, wahi jeete' },
        result: { en: 'The anchor wins every case. Justice loses.', hi: 'Har case anchor jeet gaya. Insaaf haar gaya.' },
      },
      {
        id: 'backlog.contact',
        tag: 'wrong',
        d: { safety: -10, law: -15, trust: -20, vikas: -5 },
        text: { en: 'Let files ‘wait’ for the right ‘contact’', hi: 'Files ko sahi ‘contact’ ka ‘intezaar’ karne do' },
        result: { en: 'Cases with ‘contacts’ move. The rest gather dust.', hi: '‘Contact’ waale case chal pade. Baaki par dhool.' },
      },
      {
        id: 'backlog.judges',
        tag: 'good',
        d: { safety: 5, law: 15, trust: 10 },
        text: { en: 'Hire more judges and public prosecutors', hi: 'Aur judge aur sarkari vakeel bharti karo' },
        result: { en: 'A good start, but without forensic reports the cases still wait.', hi: 'Achhi shuruaat, par forensic report ke bina case abhi bhi atke hain.' },
      },
    ],
  },
];

export type GovRatingId = 'model' | 'good' | 'shortcut' | 'shaky' | 'gundaraj';

export interface GovRating {
  id: GovRatingId;
  stars: 0 | 1 | 2 | 3;
  title: Txt;
  verdict: Txt;
}

const RATINGS: Record<GovRatingId, GovRating> = {
  model: {
    id: 'model',
    stars: 3,
    title: { en: 'Suraksha + Samvidhan: Model Governance', hi: 'Suraksha bhi, Samvidhan bhi: Model Sarkar' },
    verdict: { en: 'Safe streets, cases that hold up in court and a district that trusts its police.', hi: 'Surakshit sadkein, court mein tikne wale case, aur police par bharosa karta zila.' },
  },
  good: {
    id: 'good',
    stars: 2,
    title: { en: 'Good Governance, a Few Loose Ends', hi: 'Achhi Sarkar, Thode Dheele Pench' },
    verdict: { en: 'Mostly the right calls. A few half-measures left work for next time.', hi: 'Zyaadatar sahi faisle. Kuch aadhe-adhoore kadam agli baar ke liye.' },
  },
  shortcut: {
    id: 'shortcut',
    stars: 1,
    title: { en: 'Shortcut Sarkar', hi: 'Shortcut Sarkar' },
    verdict: { en: 'Big headlines, weak cases. The courts kept undoing your work.', hi: 'Bade headline, kamzor case. Court baar baar aapka kaam palat-ta raha.' },
  },
  shaky: {
    id: 'shaky',
    stars: 1,
    title: { en: 'Shaky Sarkar', hi: 'Dagmagati Sarkar' },
    verdict: { en: 'Some good calls, some bad ones. Khushalpur is not sure what to expect.', hi: 'Kuch sahi, kuch galat. Khushalpur ko samajh nahi aa raha kya ummeed kare.' },
  },
  gundaraj: {
    id: 'gundaraj',
    stars: 0,
    title: { en: 'GUNDARAJ RETURNS!', hi: 'GUNDARAJ WAPAS!' },
    verdict: { en: 'The fictional gangs are throwing a party. Try again — the district needs you.', hi: 'Kaalpanik gangs party kar rahe hain. Phir koshish kijiye — zile ko aapki zaroorat hai.' },
  },
};

export function clampMeter(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function startMeters(): Meters {
  return { safety: START_METER, law: START_METER, trust: START_METER, vikas: START_METER };
}

export function applyChoice(m: Meters, c: GovChoice): Meters {
  const out = { ...m };
  for (const k of METER_ORDER) out[k] = clampMeter(out[k] + (c.d[k] ?? 0));
  return out;
}

/**
 * Rate a finished shift from its meters. `tags` (the kinds of calls made)
 * tell a shift sunk by shortcuts apart from one sunk by Gundaraj answers.
 */
export function rateGovernance(m: Meters, tags: readonly ChoiceTag[] = []): GovRating {
  const vals = METER_ORDER.map((k) => m[k]);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  const shortcuts = tags.filter((t) => t === 'shortcut').length;
  const failures = tags.filter((t) => t === 'wrong' || t === 'comic').length;
  if (avg < 40) return shortcuts > failures ? RATINGS.shortcut : RATINGS.gundaraj;
  if (m.law < 40) return RATINGS.shortcut;
  if (avg >= 75 && min >= 60) return RATINGS.model;
  if (avg >= 60) return RATINGS.good;
  return RATINGS.shaky;
}

/** Coins for a finished shift: a small thank-you plus a bonus per star. */
export function governanceCoins(r: GovRating): number {
  return 10 + r.stars * 25;
}

/** Pick `n` different cases and shuffle each case's options. */
export function dealShift(random: () => number = Math.random, n = CASES_PER_SHIFT): GovCase[] {
  const shuffle = <T,>(list: readonly T[]): T[] => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return shuffle(GOV_CASES)
    .slice(0, n)
    .map((c) => ({ ...c, choices: shuffle(c.choices) }));
}
