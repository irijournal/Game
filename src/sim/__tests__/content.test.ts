import { describe, expect, it } from 'vitest';
import { DEBATE_ROUNDS } from '../../content/debate';
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

  it('debate rounds have three options and fictional framing', () => {
    expect(DEBATE_ROUNDS.length).toBeGreaterThanOrEqual(4);
    for (const r of DEBATE_ROUNDS) {
      expect(r.options).toHaveLength(3);
      expect(r.rival.length).toBeGreaterThan(5);
    }
  });
});
