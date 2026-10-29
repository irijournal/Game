import { useState } from 'react';
import { ACHIEVEMENTS } from '../content/achievements';
import { CHECKED, FACTS, FACT_TYPE_HELP, FACT_TYPE_LABEL, type FactType } from '../content/facts';
import { LEVELS } from '../content/levels';
import { SLOGANS } from '../content/slogans';
import type { Screen } from './App';
import { SCORE_NOTE } from './disclaimer';
import { FactCard, FactTypeBadge, fmt } from './Screens';
import { useSave } from './store';

type Tab = 'achievements' | 'badges' | 'evidence' | 'slogans';
const TYPES: FactType[] = ['verified', 'govt', 'claim', 'fiction'];

/**
 * Achievement & Evidence board. Achievements and badges are fictional game
 * awards; the evidence board keeps real-world information separate and
 * labelled by type, with sources and the date it was checked.
 */
export function BoardScreen({ go }: { go: (s: Screen) => void }) {
  const save = useSave();
  const [tab, setTab] = useState<Tab>('achievements');
  const [filter, setFilter] = useState<FactType | 'all'>('all');
  const facts = FACTS.filter((f) => filter === 'all' || f.type === filter);
  return (
    <div className="panel-screen">
      <div className="screen-header">
        <button className="btn icon" onClick={() => go('menu')} aria-label="Back">
          ←
        </button>
        <h2>Achievements &amp; Facts</h2>
      </div>
      <div className="seg tabs">
        {(
          [
            ['achievements', 'Achievements'],
            ['badges', 'Badges'],
            ['evidence', 'Evidence board'],
            ['slogans', 'Slogans'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="list">
        {tab === 'achievements' && (
          <>
            <p className="muted center">
              {save.achievements.length}/{ACHIEVEMENTS.length} unlocked • fictional game awards
            </p>
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => {
                const got = save.achievements.includes(a.id);
                const v = Math.min(a.goal, a.progress(save));
                return (
                  <div key={a.id} className={`card ach ${got ? 'got' : ''}`}>
                    <span className="ach-icon" aria-hidden="true">
                      {a.icon}
                    </span>
                    <div>
                      <b>{a.name}</b>
                      <small>{a.how}</small>
                      {!got && (
                        <div className="bar thin">
                          <div style={{ width: `${(v / a.goal) * 100}%` }} />
                        </div>
                      )}
                      <small className="ach-progress">{got ? 'Unlocked ✓' : `${fmt(v)} / ${fmt(a.goal)}`}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === 'badges' && (
          <>
            <p className="muted center">One badge per campaign level. Some come with a perk.</p>
            <div className="ach-grid">
              {LEVELS.map((l) => {
                const got = save.badges.includes(l.badge.id);
                return (
                  <div key={l.badge.id} className={`card ach ${got ? 'got' : ''}`}>
                    <span className="ach-icon" aria-hidden="true">
                      {got ? l.badge.icon : '🔒'}
                    </span>
                    <div>
                      <b>{l.badge.name}</b>
                      <small>
                        Level {l.num}: {l.name}
                      </small>
                      <small className="ach-progress">{l.badge.perkText}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === 'evidence' && (
          <>
            <div className="card legend">
              <b>How to read this board</b>
              {TYPES.map((t) => (
                <div key={t}>
                  <FactTypeBadge type={t} /> <small>{FACT_TYPE_HELP[t]}</small>
                </div>
              ))}
              <small className="muted">
                Sources checked on {CHECKED}. Where a project began under an earlier government, the note says so. No points are ever awarded for accusations.
              </small>
            </div>
            <div className="seg tabs" role="radiogroup" aria-label="Filter by type">
              <button className={filter === 'all' ? 'on' : ''} role="radio" aria-checked={filter === 'all'} onClick={() => setFilter('all')}>
                All
              </button>
              {TYPES.map((t) => (
                <button key={t} className={filter === t ? 'on' : ''} role="radio" aria-checked={filter === t} onClick={() => setFilter(t)}>
                  {FACT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            {facts.map((f) => (
              <FactCard key={f.id} fact={f} />
            ))}
          </>
        )}
        {tab === 'slogans' && (
          <>
            <div className="card legend">
              <FactTypeBadge type="claim" /> <small>These are the game’s own campaign-style slogans. They are political arguments, not facts and not quotes of any real person.</small>
            </div>
            {SLOGANS.map((s) => (
              <div key={s} className="card slogan-card">
                “{s}”
              </div>
            ))}
          </>
        )}
        <p className="muted center">{SCORE_NOTE}</p>
      </div>
    </div>
  );
}
