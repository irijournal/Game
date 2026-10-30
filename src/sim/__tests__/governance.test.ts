import { describe, expect, it } from 'vitest';
import {
  applyChoice,
  CASES_PER_SHIFT,
  dealShift,
  GOV_CASES,
  governanceCoins,
  METER_ORDER,
  rateGovernance,
  startMeters,
  type ChoiceTag,
  type GovCase,
  type Meters,
} from '../../content/governance';
import { factById } from '../../content/facts';
import { applyGovernance, defaultSave, validateSave } from '../../save/save';
import { Rng } from '../rng';

/** Pick `tag` in every case (or `fallback` where a case has no such option). */
const playAll = (cases: readonly GovCase[], tag: ChoiceTag, fallback: ChoiceTag = tag): { m: Meters; tags: ChoiceTag[] } => {
  let m = startMeters();
  const tags: ChoiceTag[] = [];
  for (const c of cases) {
    const pick = c.choices.find((x) => x.tag === tag) ?? c.choices.find((x) => x.tag === fallback);
    if (!pick) throw new Error(`${c.id} has neither ${tag} nor ${fallback}`);
    m = applyChoice(m, pick);
    tags.push(pick.tag);
  }
  return { m, tags };
};
const rate = (r: { m: Meters; tags: ChoiceTag[] }) => rateGovernance(r.m, r.tags);

/** Every way of dealing CASES_PER_SHIFT cases from the deck. */
function* shifts(n = CASES_PER_SHIFT, from = 0, acc: GovCase[] = []): Generator<GovCase[]> {
  if (acc.length === n) {
    yield acc;
    return;
  }
  for (let i = from; i < GOV_CASES.length; i++) yield* shifts(n, i + 1, [...acc, GOV_CASES[i]]);
}

describe('Governance Room content', () => {
  it('has enough cases, unique ids and text in both languages', () => {
    expect(GOV_CASES.length).toBeGreaterThanOrEqual(CASES_PER_SHIFT + 2);
    const ids = new Set<string>();
    for (const c of GOV_CASES) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      for (const t of [c.title, c.situation]) expect(t.en && t.hi).toBeTruthy();
      expect(c.choices.length).toBe(4);
      for (const ch of c.choices) {
        expect(ids.has(ch.id)).toBe(false);
        ids.add(ch.id);
        expect(ch.text.en && ch.text.hi && ch.result.en && ch.result.hi).toBeTruthy();
      }
    }
  });

  it('every case has exactly one best answer, and it is due process, not a shortcut', () => {
    for (const c of GOV_CASES) {
      const best = c.choices.filter((x) => x.tag === 'best');
      expect(best.length, c.id).toBe(1);
      expect(best[0].d.law ?? 0, c.id).toBeGreaterThan(0);
      // The best answer improves every meter it touches.
      for (const k of METER_ORDER) expect(best[0].d[k] ?? 0, `${c.id}.${k}`).toBeGreaterThanOrEqual(0);
      // The best answer is strictly better in total than any other.
      const total = (x: (typeof c.choices)[number]) => METER_ORDER.reduce((n, k) => n + (x.d[k] ?? 0), 0);
      for (const other of c.choices) if (other !== best[0]) expect(total(best[0])).toBeGreaterThan(total(other));
    }
  });

  it('shortcuts that skip due process always cost rule of law', () => {
    let shortcuts = 0;
    for (const c of GOV_CASES)
      for (const ch of c.choices)
        if (ch.tag === 'shortcut') {
          shortcuts++;
          expect(ch.d.law ?? 0, ch.id).toBeLessThan(0);
        }
    expect(shortcuts).toBeGreaterThanOrEqual(5);
  });

  it('cases are fictional and never put a real party or politician in a negative role', () => {
    const banned = /\b(BJP|SP|Samajwadi|Congress|BSP|Akhilesh|Yogi|Mulayam|Lucknow|Azamgarh|Rampur)\b/i;
    for (const c of GOV_CASES) {
      const all = [c.title, c.situation, ...c.choices.flatMap((x) => [x.text, x.result])].flatMap((t) => [t.en, t.hi]);
      for (const line of all) expect(line, c.id).not.toMatch(banned);
      expect(c.situation.en, c.id).toMatch(/fictional/i);
    }
  });

  it('no option demolishes a home or punishes without a case', () => {
    for (const c of GOV_CASES)
      for (const ch of c.choices) {
        const line = `${ch.text.en} ${ch.result.en}`;
        expect(line, ch.id).not.toMatch(/(demolish|bulldoze)\w* (a |the |their |his |her )?(home|house)/i);
      }
  });
});

describe('Governance Room scoring', () => {
  it('the best call on every possible shift earns 3 stars', () => {
    for (const s of shifts()) expect(rate(playAll(s, 'best')).stars).toBe(3);
  });

  it('Gundaraj answers on every possible shift end in “Gundaraj returns”', () => {
    for (const s of shifts()) expect(rate(playAll(s, 'wrong')).id).toBe('gundaraj');
    for (const s of shifts()) expect(rate(playAll(s, 'comic', 'wrong')).stars).toBe(0);
  });

  it('taking every shortcut on offer is rated Shortcut Sarkar, never good governance', () => {
    for (const s of shifts()) {
      const r = rate(playAll(s, 'shortcut', 'good'));
      expect(r.id).toBe('shortcut');
      expect(r.stars).toBe(1);
    }
  });

  it('half-measures alone never reach model governance', () => {
    // A shift of only “good steps” (no best calls) stays below 3 stars.
    const goodOnly = GOV_CASES.filter((c) => c.choices.some((x) => x.tag === 'good')).slice(0, CASES_PER_SHIFT);
    expect(goodOnly.length).toBe(CASES_PER_SHIFT);
    expect(rate(playAll(goodOnly, 'good')).stars).toBeLessThan(3);
  });

  it('meters stay within 0..100', () => {
    let m = startMeters();
    for (let i = 0; i < 20; i++) m = applyChoice(m, GOV_CASES[0].choices.find((x) => x.tag === 'wrong')!);
    for (const k of METER_ORDER) expect(m[k]).toBe(0);
    for (let i = 0; i < 20; i++) m = applyChoice(m, GOV_CASES[0].choices.find((x) => x.tag === 'best')!);
    expect(m.safety).toBe(100);
  });

  it('deals distinct cases and keeps every option', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 20; i++) {
      const shift = dealShift(() => rng.next());
      expect(shift.length).toBe(CASES_PER_SHIFT);
      expect(new Set(shift.map((c) => c.id)).size).toBe(CASES_PER_SHIFT);
      for (const c of shift) {
        const orig = GOV_CASES.find((x) => x.id === c.id)!;
        expect(new Set(c.choices.map((x) => x.id))).toEqual(new Set(orig.choices.map((x) => x.id)));
      }
    }
  });

  it('links to evidence-board entries that exist', () => {
    expect(factById('lawOrder')?.type).toBe('claim');
    expect(factById('gundaraj')?.type).toBe('claim');
  });
});

describe('Governance Room save', () => {
  it('records shifts, best stars, coins and the achievement', () => {
    const d = defaultSave('2026-10-30');
    const shift = GOV_CASES.slice(0, CASES_PER_SHIFT);
    const model = rate(playAll(shift, 'best'));
    const info = applyGovernance(d, model);
    expect(info.coins).toBe(governanceCoins(model));
    expect(info.newBest).toBe(true);
    expect(info.achievementsNow).toContain('ach.ruleOfLaw');
    expect(d.coins).toBe(info.coins);
    expect(d.stats.governanceShifts).toBe(1);
    expect(d.stats.governanceBest).toBe(3);
    const worse = applyGovernance(d, rate(playAll(shift, 'wrong')));
    expect(worse.newBest).toBe(false);
    expect(d.stats.governanceBest).toBe(3);
    expect(d.stats.governanceShifts).toBe(2);
  });

  it('validates the language setting and governance stats', () => {
    const d = defaultSave('2026-10-30');
    expect(d.settings.language).toBe('en');
    const raw = JSON.parse(JSON.stringify(d));
    raw.settings.language = 'hi';
    raw.stats.governanceBest = 99;
    const ok = validateSave(raw, '2026-10-30');
    expect(ok.settings.language).toBe('hi');
    expect(ok.stats.governanceBest).toBe(3);
    raw.settings.language = 'klingon';
    expect(validateSave(raw, '2026-10-30').settings.language).toBe('en');
  });
});
