import { describe, expect, it } from 'vitest';
import { FAKE_PROMISES } from '../../content/mayhem';
import { COMIC_WORDS, HERO_LINES, NEWS_HEADLINES, RIVAL_LINES } from '../../content/jokes';
import { factById, FACTS } from '../../content/facts';
import { LEVELS } from '../../content/levels';
import { QUIZ, quizById } from '../../content/quiz';
import { THEME_ORDER } from '../types';

describe('content integrity', () => {
  it('every verified or government-reported fact has at least one https source', () => {
    for (const f of FACTS) {
      if (f.type === 'verified' || f.type === 'govt') {
        expect(f.sources.length, f.id).toBeGreaterThan(0);
        for (const s of f.sources) expect(s.url.startsWith('https://'), f.id).toBe(true);
      }
    }
  });

  it('fact ids are unique', () => {
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
  });

  it('quiz questions reference existing facts and have distinct options', () => {
    for (const q of QUIZ) {
      expect(factById(q.factId), q.id).toBeTruthy();
      expect(new Set(q.options).size, q.id).toBe(3);
      expect([0, 1, 2]).toContain(q.answer);
      for (const o of q.options) expect(o.length, q.id).toBeLessThanOrEqual(22);
    }
  });

  it('levels cover every environment once, in order, with valid references', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([...THEME_ORDER]);
    LEVELS.forEach((l, i) => {
      expect(l.num).toBe(i + 1);
      for (const id of l.facts) expect(factById(id), `${l.id}:${id}`).toBeTruthy();
      for (const e of l.events) {
        if (e.kind === 'quiz') expect(quizById(e.quiz ?? ''), `${l.id}:${e.quiz}`).toBeTruthy();
        expect(e.at + (e.len ?? 0)).toBeLessThan(l.length - 60);
      }
    });
  });

  it('SP-era projects are credited, not attributed to BJP governments', () => {
    expect(factById('agraLucknow')?.text).toMatch(/Akhilesh Yadav \(SP government\)/);
    expect(factById('purvanchal')?.note).toMatch(/SP government/);
    expect(factById('lucknowMetro')?.text).toMatch(/SP government/);
  });

  it('Manifesto Mayhem promises are absurd fictions, not real facts or claims', () => {
    expect(FAKE_PROMISES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(FAKE_PROMISES).size).toBe(FAKE_PROMISES.length);
    // Crate labels must fit on a crate and must not reuse a fact's title.
    const titles = new Set(FACTS.map((f) => f.title.toUpperCase()));
    for (const p of FAKE_PROMISES) {
      expect(p.length, p).toBeLessThanOrEqual(34);
      expect(titles.has(p), p).toBe(false);
    }
  });

  it('comic writing is non-empty and kept separate from facts', () => {
    expect(NEWS_HEADLINES.length).toBeGreaterThanOrEqual(20);
    expect(HERO_LINES.length).toBeGreaterThan(3);
    expect(COMIC_WORDS.length).toBeGreaterThan(4);
    for (const list of Object.values(RIVAL_LINES)) expect(list.length).toBeGreaterThan(0);
    // Election numbers quoted in jokes or signs must match the facts board.
    expect(factById('up2017')?.text).toMatch(/SP won 47 seats/);
    expect(factById('kaamBoltaHai')?.text).toMatch(/47 seats/);
  });
});
