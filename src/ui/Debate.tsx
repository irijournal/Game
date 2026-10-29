import { useEffect, useRef, useState } from 'react';
import { DEBATE_ROUNDS, DEBATE_WIN_SCORE } from '../content/debate';
import { ACHIEVEMENTS } from '../content/achievements';
import type { Engine } from '../engine/Engine';
import { applyDebate } from '../save/save';
import { CHARACTERS } from '../sim/characters';
import type { Screen } from './App';
import { heroFor } from './Screens';
import { updateSave, useSave } from './store';

type Phase = 'rival' | 'choose' | 'reply' | 'done';
const LINE_MS = 2200;

/**
 * Debate Arena: five rounds of comic, clearly fictional dialogue. The rival
 * says a campaign line; the player picks a reply; the audience reacts. The
 * engine animates the two characters on stage.
 */
export function DebateScreen({ engine, go }: { engine: Engine; go: (s: Screen) => void }) {
  const save = useSave();
  const hero = CHARACTERS[heroFor(save)];
  const rival = CHARACTERS.akhilesh;
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('rival');
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [earned, setEarned] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  /** Each finished debate is recorded exactly once. */
  const recorded = useRef(false);
  const max = DEBATE_ROUNDS.length * 3;
  const r = DEBATE_ROUNDS[Math.min(round, DEBATE_ROUNDS.length - 1)];
  const won = score >= DEBATE_WIN_SCORE;

  const later = (fn: () => void, ms = LINE_MS) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };

  useEffect(() => {
    engine.showDebate();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [engine]);

  // Drive the stage: who is talking in each phase.
  useEffect(() => {
    if (phase === 'rival') {
      engine.debateSpeaker('rival');
      later(() => setPhase('choose'));
    } else if (phase === 'choose') engine.debateSpeaker(null);
    else if (phase === 'reply') {
      engine.debateSpeaker('hero');
      later(() => {
        if (round + 1 < DEBATE_ROUNDS.length) {
          setRound(round + 1);
          setPick(null);
          setPhase('rival');
        } else setPhase('done');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  useEffect(() => {
    if (phase !== 'done' || recorded.current) return;
    recorded.current = true;
    engine.debateResult(won ? 'hero' : 'rival');
    let now: string[] = [];
    updateSave((d) => {
      now = applyDebate(d, won);
    });
    setEarned(now);
  }, [phase, won, engine]);

  const choose = (i: number) => {
    if (phase !== 'choose') return;
    engine.audio.play('click');
    setPick(i);
    setScore((s) => s + r.options[i].score);
    engine.audio.play(r.options[i].score >= 2 ? 'correct' : 'wrong');
    setPhase('reply');
  };

  const skip = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (phase === 'rival') setPhase('choose');
    else if (phase === 'reply') {
      if (round + 1 < DEBATE_ROUNDS.length) {
        setRound(round + 1);
        setPick(null);
        setPhase('rival');
      } else setPhase('done');
    }
  };

  const restart = () => {
    setRound(0);
    setScore(0);
    setPick(null);
    setEarned([]);
    recorded.current = false;
    engine.showDebate();
    setPhase('rival');
  };

  return (
    <div className="debate-ui">
      <div className="debate-top">
        <button className="btn icon" onClick={() => go('menu')} aria-label="Leave the debate">
          ←
        </button>
        <div className="debate-title">
          <b>DEBATE ARENA</b>
          <small>All dialogue is fictional — not real quotes</small>
        </div>
        <div className="debate-score" aria-label={`Audience score ${score} of ${max}`}>
          👏 {score}/{max}
        </div>
      </div>
      <div className="applause bar" title={`Win with ${DEBATE_WIN_SCORE}+`}>
        <div style={{ width: `${(score / max) * 100}%` }} />
        <span className="goal" style={{ left: `${(DEBATE_WIN_SCORE / max) * 100}%` }} />
      </div>

      {phase !== 'done' && (
        <div className="debate-panel">
          <div className="round-tag">
            Round {round + 1}/{DEBATE_ROUNDS.length}: {r.topic}
          </div>
          <div className="bubble rival">
            <b>{rival.shortName} (caricature):</b> “{r.rival}”
          </div>
          {phase === 'choose' && (
            <div className="debate-options">
              {r.options.map((o, i) => (
                <button key={o.text} className="btn" onClick={() => choose(i)}>
                  {o.text}
                </button>
              ))}
            </div>
          )}
          {phase === 'reply' && pick !== null && (
            <>
              <div className="bubble hero">
                <b>{hero.shortName} (caricature):</b> “{r.options[pick].text}”
              </div>
              <div className="reaction">
                {r.options[pick].reaction} <b>+{r.options[pick].score}</b>
              </div>
            </>
          )}
          {phase !== 'choose' && (
            <button className="btn ghost small" onClick={skip}>
              Continue ▸
            </button>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="debate-panel">
          <h2 className={won ? 'win' : ''}>{won ? 'DEBATE WON!' : 'THE CROWD WANTS MORE'}</h2>
          <p>
            Audience score <b>{score}</b> / {max} {won ? '— the arena is on its feet!' : `— reach ${DEBATE_WIN_SCORE} to win.`}
          </p>
          {earned.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id);
            return a ? (
              <div key={id} className="msg">
                {a.icon} Achievement unlocked: {a.name}
              </div>
            ) : null;
          })}
          <div className="row">
            <button className="btn primary" onClick={restart} autoFocus>
              ↻ Debate again
            </button>
            <button className="btn" onClick={() => go('menu')}>
              ⌂ Main menu
            </button>
          </div>
          <small className="muted">Fictional dialogue written for the game. The score is a game score.</small>
        </div>
      )}
    </div>
  );
}
