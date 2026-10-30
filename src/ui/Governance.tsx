import { useEffect, useRef, useState } from 'react';
import { ACHIEVEMENTS } from '../content/achievements';
import { factById } from '../content/facts';
import {
  applyChoice,
  CASES_PER_SHIFT,
  dealShift,
  GOV_DISCLAIMER,
  GOV_LESSON,
  GOV_PITCH,
  GOV_TITLE,
  HERO_REACTION,
  METERS,
  METER_ORDER,
  rateGovernance,
  startMeters,
  type ChoiceTag,
  type GovCase,
  type GovChoice,
  type Meters,
} from '../content/governance';
import { tr } from '../content/lang';
import type { Sfx } from '../engine/audio';
import { applyGovernance, type GovernanceResultInfo } from '../save/save';
import type { Screen } from './App';
import { SCORE_NOTE } from './disclaimer';
import { useLang, useT, type UiKey } from './i18n';
import { FactCard, Header, Stars } from './Screens';
import { updateSave, useSave } from './store';

const TAG_KEY: Record<ChoiceTag, UiKey> = {
  best: 'tagBest',
  good: 'tagGood',
  shortcut: 'tagShortcut',
  wrong: 'tagWrong',
  comic: 'tagComic',
};

const CONTEXT_FACTS = ['lawOrder', 'gundaraj'];

type Phase = { kind: 'brief' } | { kind: 'case'; picked: GovChoice | null } | { kind: 'report'; info: GovernanceResultInfo };

/**
 * Governance Room: five fictional cases, four meters, one report card.
 * A decision mode between runs, about how public safety is restored.
 */
export function GovernanceScreen({ go, sfx }: { go: (s: Screen) => void; sfx: (s: Sfx) => void }) {
  const lang = useLang();
  const t = useT();
  const save = useSave();
  const [shift, setShift] = useState<GovCase[]>(() => dealShift());
  const [idx, setIdx] = useState(0);
  const [meters, setMeters] = useState<Meters>(startMeters);
  const [delta, setDelta] = useState<Partial<Meters>>({});
  const [calls, setCalls] = useState<GovChoice[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'brief' });
  const resultRef = useRef<HTMLDivElement>(null);
  const picked = phase.kind === 'case' ? phase.picked : null;

  // Bring the consequence into view on small screens.
  useEffect(() => {
    if (picked) resultRef.current?.scrollIntoView({ block: 'nearest', behavior: save.settings.reducedMotion ? 'auto' : 'smooth' });
  }, [picked, save.settings.reducedMotion]);

  const begin = () => {
    sfx('click');
    setShift(dealShift());
    setIdx(0);
    setMeters(startMeters());
    setDelta({});
    setCalls([]);
    setPhase({ kind: 'case', picked: null });
  };

  const choose = (c: GovChoice) => {
    if (phase.kind !== 'case' || phase.picked) return;
    sfx(c.tag === 'best' || c.tag === 'good' ? 'correct' : 'wrong');
    setMeters((m) => applyChoice(m, c));
    setDelta(c.d);
    setCalls((list) => [...list, c]);
    setPhase({ kind: 'case', picked: c });
  };

  const next = () => {
    setDelta({});
    if (idx + 1 < shift.length) {
      sfx('click');
      setIdx(idx + 1);
      setPhase({ kind: 'case', picked: null });
      return;
    }
    const rating = rateGovernance(meters, calls.map((c) => c.tag));
    let info: GovernanceResultInfo = { coins: 0, newBest: false, achievementsNow: [] };
    updateSave((d) => {
      info = applyGovernance(d, rating);
    });
    sfx(rating.stars >= 2 ? 'fanfare' : rating.stars === 1 ? 'success' : 'stinger');
    setPhase({ kind: 'report', info });
  };

  const current = shift[idx];
  const rating = rateGovernance(
    meters,
    calls.map((c) => c.tag),
  );

  return (
    <div className="panel-screen governance">
      <Header title={tr(GOV_TITLE, lang)} go={go} />
      <div className="list">
        {phase.kind !== 'brief' && <MeterPanel meters={meters} delta={delta} />}

        {phase.kind === 'brief' && (
          <div className="card level-intro gov-brief">
            <h3>🏛️ {tr(GOV_TITLE, lang)}</h3>
            <p>{tr(GOV_PITCH, lang)}</p>
            <div className="gov-meter-keys">
              {METER_ORDER.map((k) => (
                <span key={k} className="gov-chip">
                  {METERS[k].icon} {tr(METERS[k].name, lang)}
                </span>
              ))}
            </div>
            <p className="gov-lesson">{tr(GOV_LESSON, lang)}</p>
            <div className="row">
              <button className="btn primary huge" onClick={begin} autoFocus>
                {t('govStart')}
              </button>
            </div>
            <p className="muted center">
              {t('govShifts')} {save.stats.governanceShifts} • {t('govBest')} <Stars n={save.stats.governanceBest} />
            </p>
            <p className="muted center small-print">{tr(GOV_DISCLAIMER, lang)}</p>
          </div>
        )}

        {phase.kind === 'case' && current && (
          <div className="card gov-case" key={current.id}>
            <small className="gov-count">
              {t('govCase')} {idx + 1}/{CASES_PER_SHIFT}
            </small>
            <h3>
              <span aria-hidden="true">{current.icon}</span> {tr(current.title, lang)}
            </h3>
            <p className="gov-situation">{tr(current.situation, lang)}</p>
            {!phase.picked && <b className="gov-ask">{t('govChoose')}</b>}
            <div className="gov-choices">
              {current.choices.map((c, i) => {
                const picked = phase.picked?.id === c.id;
                return (
                  <button
                    key={c.id}
                    className={`btn gov-choice ${picked ? 'picked ' + c.tag : ''}`}
                    disabled={!!phase.picked && !picked}
                    aria-pressed={picked}
                    data-choice={c.id}
                    onClick={() => choose(c)}
                  >
                    <span className="gov-letter">{'ABCD'[i]}</span>
                    <span>{tr(c.text, lang)}</span>
                  </button>
                );
              })}
            </div>
            {phase.picked && (
              <div className={`gov-result ${phase.picked.tag}`} role="status" ref={resultRef}>
                <b>{t(TAG_KEY[phase.picked.tag])}</b>
                <p>{tr(phase.picked.result, lang)}</p>
                <p className="gov-hero">🗣️ “{tr(HERO_REACTION[phase.picked.tag], lang)}”</p>
                <button className="btn primary" onClick={next} autoFocus>
                  {idx + 1 < shift.length ? t('govNext') : t('govReport')}
                </button>
              </div>
            )}
          </div>
        )}

        {phase.kind === 'report' && (
          <>
            <div className={`card gov-report ${rating.id}`}>
              <small className="gov-count">{t('govReportTitle')}</small>
              <h3>{tr(rating.title, lang)}</h3>
              <Stars n={rating.stars} big />
              <p>{tr(rating.verdict, lang)}</p>
              <p className="gov-lesson">{tr(GOV_LESSON, lang)}</p>
              <p className="gov-coins">
                +{phase.info.coins} {t('coinsEarned')}
              </p>
              {phase.info.achievementsNow.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id);
                return a ? (
                  <p key={id} className="gov-ach">
                    {a.icon} {t('achievementUnlocked')}: <b>{a.name}</b>
                  </p>
                ) : null;
              })}
              <div className="row">
                <button className="btn primary" onClick={begin} autoFocus>
                  {t('govAgain')}
                </button>
                <button className="btn" onClick={() => go('menu')}>
                  {t('menu')}
                </button>
              </div>
            </div>
            <div className="card gov-calls">
              <b>{t('govYourCalls')}</b>
              <ol>
                {calls.map((c, i) => (
                  <li key={c.id}>
                    <span>{shift[i] ? tr(shift[i].title, lang) : ''}</span> <small className={`gov-tag ${c.tag}`}>{t(TAG_KEY[c.tag])}</small>
                  </li>
                ))}
              </ol>
            </div>
            <div className="card gov-context">
              <b>{t('govContext')}</b>
              <small className="muted">{t('govContextNote')}</small>
            </div>
            {CONTEXT_FACTS.map((id) => {
              const f = factById(id);
              return f ? <FactCard key={id} fact={f} /> : null;
            })}
            <p className="muted center small-print">{tr(GOV_DISCLAIMER, lang)}</p>
            <p className="muted center small-print">{SCORE_NOTE}</p>
          </>
        )}
      </div>
    </div>
  );
}

function MeterPanel({ meters, delta }: { meters: Meters; delta: Partial<Meters> }) {
  const lang = useLang();
  return (
    <div className="card gov-meters" aria-label="Governance meters (fictional game scores)">
      {METER_ORDER.map((k) => {
        const v = meters[k];
        const d = delta[k] ?? 0;
        return (
          <div key={k} className="gov-meter">
            <span className="gov-meter-name">
              {METERS[k].icon} {tr(METERS[k].name, lang)}
            </span>
            <div className={`bar gov-bar ${v < 35 ? 'low' : v >= 70 ? 'high' : ''}`}>
              <div style={{ width: `${v}%` }} />
            </div>
            <b className="gov-meter-val">
              {v}
              {d !== 0 && <small className={`gov-delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? `+${d}` : d}</small>}
            </b>
          </div>
        );
      })}
    </div>
  );
}
