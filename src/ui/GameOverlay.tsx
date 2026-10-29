import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ACHIEVEMENTS } from '../content/achievements';
import { factById } from '../content/facts';
import { LEVELS, levelById } from '../content/levels';
import type { Engine, StartOptions } from '../engine/Engine';
import type { CaptionTone, HudSnapshot, ToastTone, UiEvent } from '../engine/events';
import { levelUnlocked, type RunResultInfo } from '../save/save';
import { CHARACTERS } from '../sim/characters';
import { missionById } from '../sim/missions';
import type { RunSummary } from '../sim/simulation';
import { THEME_NAMES } from '../sim/themes';
import type { TokenVariant } from '../sim/types';
import { SCORE_NOTE } from './disclaimer';
import { FactTypeBadge, Stars } from './Screens';
import { updateSave, useSave } from './store';

export const TOKEN_ICON: Record<TokenVariant, string> = {
  road: '🛣️',
  diya: '🪔',
  plane: '✈️',
  wheat: '🌾',
  welfare: '🏠',
  shield: '🛡️',
  gear: '⚙️',
  star: '⭐',
};
const LETTERS = ['A', 'B', 'C'];
const LANE_NAMES = ['left lane', 'middle lane', 'right lane'];

interface Props {
  engine: Engine;
  events: UiEvent[];
  onMenu: () => void;
  onRetry: () => void;
  onStart: (o: StartOptions) => void;
  error: string | null;
  clearError: () => void;
}

interface Timed<T> {
  id: number;
  until: number;
  data: T;
}

let uid = 1;
const fmt = (n: number) => Math.floor(n).toLocaleString('en-IN');

export function GameOverlay({ engine, events, onMenu, onRetry, onStart, error, clearError }: Props) {
  const hud = useSyncExternalStore(engine.hud.subscribe, engine.hud.get);
  const save = useSave();
  const [captions, setCaptions] = useState<Timed<{ text: string; sub?: string; tone: CaptionTone }>[]>([]);
  const [toasts, setToasts] = useState<Timed<{ text: string; sub?: string; tone: ToastTone }>[]>([]);
  const [comic, setComic] = useState<Timed<string> | null>(null);
  const [hint, setHint] = useState<Timed<string> | null>(null);
  const [card, setCard] = useState<Timed<{ title: string; body: string }> | null>(null);
  const [fact, setFact] = useState<Timed<{ factId: string; heading: string }> | null>(null);
  const [paused, setPaused] = useState<{ reason?: string } | null>(null);
  const [over, setOver] = useState<{ summary: RunSummary; info: RunResultInfo; at: number } | null>(null);
  const [confirm, setConfirm] = useState<'restart' | 'menu' | null>(null);
  const [, force] = useState(0);
  const seen = useRef(0);

  // Consume engine events once each.
  useEffect(() => {
    const now = performance.now();
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    for (const ev of fresh) {
      switch (ev.type) {
        case 'caption':
          // One headline at a time: a new caption replaces the previous one.
          setCaptions([{ id: uid++, until: now + ev.ms, data: { text: ev.text, sub: ev.sub, tone: ev.tone } }]);
          break;
        case 'clearCaptions':
          setCaptions([]);
          break;
        case 'toast':
          setToasts((t) => [...t.filter((x) => x.until > now), { id: uid++, until: now + 3200, data: { text: ev.text, sub: ev.sub, tone: ev.tone } }].slice(-2));
          break;
        case 'comic':
          setComic({ id: uid++, until: now + 900, data: ev.text });
          break;
        case 'hint':
          setHint({ id: uid++, until: now + 1800, data: ev.text });
          break;
        case 'infoCard':
          setCard({ id: uid++, until: now + 7000, data: { title: ev.title, body: ev.body } });
          break;
        case 'factCard':
          setFact({ id: uid++, until: now + 6500, data: { factId: ev.factId, heading: ev.heading } });
          break;
        case 'paused':
          setPaused(ev.paused ? { reason: ev.reason } : null);
          if (!ev.paused) setConfirm(null);
          break;
        case 'gameOver':
          setOver({ summary: ev.summary, info: ev.info, at: now });
          setCaptions([]);
          setHint(null);
          setCard(null);
          setFact(null);
          break;
      }
    }
    if (events.length === 0) {
      seen.current = 0;
      setOver(null);
      setPaused(null);
      setCaptions([]);
      setToasts([]);
      setComic(null);
      setHint(null);
      setCard(null);
      setFact(null);
    }
  }, [events]);

  // Expire timed overlays.
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = performance.now();
      setCaptions((c) => (c.some((x) => x.until <= now) ? c.filter((x) => x.until > now) : c));
      setToasts((c) => (c.some((x) => x.until <= now) ? c.filter((x) => x.until > now) : c));
      setComic((c) => (c && c.until <= now ? null : c));
      setHint((c) => (c && c.until <= now ? null : c));
      setCard((c) => (c && c.until <= now ? null : c));
      setFact((c) => (c && c.until <= now ? null : c));
      force((n) => n + 1);
    }, 150);
    return () => window.clearInterval(t);
  }, []);

  const chase = hud.chase;
  const p = hud.power;
  const speedLines = p?.kind === 'vikas' || p?.kind === 'speedRun';
  const chaseLabel = chase?.kind === 'cycle' ? 'CYCLE YATRA SHOWDOWN' : 'GOVERNANCE SHOWDOWN';
  const showdowns = hud.mode === 'rivalry' || hud.mode === 'free';
  const touch = save.settings.touchButtons && hud.active && !over && !paused;

  return (
    <div className={`game-ui ${hud.state === 'CHASE' ? 'chasing' : ''} ${touch ? 'with-touch' : ''}`}>
      {speedLines && <div className={`speed-lines ${p?.kind}`} />}
      {hud.active && !over && (
        <>
          <div className="hud-left">
            <div className="score" aria-label="score">
              {fmt(hud.score)}
              {hud.multiplier > 1 && <span className="mult">×{hud.multiplier}</span>}
            </div>
            <div className="dist">
              {fmt(hud.distance)} m • {THEME_NAMES[hud.theme]}
            </div>
            {hud.level && <LevelBar level={hud.level} />}
            {hud.race && <RaceBar race={hud.race} you={CHARACTERS[hud.character].shortName} rival={CHARACTERS[hud.rival].shortName} tokens={hud.devTokens} />}
            {hud.mayhem && <MayhemBar mayhem={hud.mayhem} tokens={hud.devTokens} />}
            {showdowns && (
              <div className="meter" title="A fictional game meter, not a measurement of anything real">
                <div className="meter-label">
                  {hud.mode === 'rivalry' ? `STAGE ${hud.stage} • CHALLENGE METER` : 'SHOWDOWN METER'} <small>fictional</small>
                </div>
                <div className="bar">
                  <div style={{ width: `${hud.meter}%` }} />
                </div>
              </div>
            )}
            <div className={`guard ${hud.guardReady && hud.state !== 'CHASE' ? 'ready' : ''}`}>
              {hud.state === 'CHASE' || hud.state === 'CINEMATIC'
                ? '⚠ Showdown: one hit ends the run'
                : hud.guardReady
                  ? showdowns
                    ? '🛡 Stumble guard ready'
                    : '🛡 Guard ready: a bump only slows you'
                  : hud.guardT > 0
                    ? `🛡 Guard recharging ${Math.ceil(hud.guardT)}s`
                    : '🛡 Guard used'}
            </div>
          </div>
          <div className="hud-right">
            <div className="coin-pill">
              <span className="coin-icon">₹</span>
              {fmt(hud.coins)}
            </div>
            <button className="btn icon pause-btn" aria-label="Pause" onClick={() => engine.pauseGame('user')}>
              ❚❚
            </button>
            {p && (
              <div className={`power ${p.kind}`}>
                <span>{p.kind === 'vikas' ? '🚄 Vikas Express' : p.kind === 'magnet' ? '🧲 Vote Magnet' : p.kind === 'bulldozer' ? '🚜 Clearing debris' : '⚡ Speed Run ×2'}</span>
                <div className="bar thin">
                  <div style={{ width: `${(p.t / p.total) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          {hud.quiz && !fact && !chase && <QuizPanel quiz={hud.quiz} />}
          {hud.encounter && !hud.quiz && !fact && <EncounterPanel enc={hud.encounter} />}
          {chase && (
            <div className="chase-bar" role="timer" aria-label={`${chaseLabel} ${chase.remaining.toFixed(1)} seconds left`}>
              <div className="chase-title">
                {chase.kind === 'cycle' ? '🚲' : '🚜'} {chaseLabel} {chase.stage > 0 && <span className="chase-stage">Stage {chase.stage}</span>} <b>{chase.remaining.toFixed(1)}s</b>
              </div>
              <div className="bar">
                <div style={{ width: `${100 - (chase.remaining / chase.total) * 100}%` }} />
              </div>
              <small>Escapes: {chase.escapes} • every dodge shortens it • 2× coins{hud.mode === 'rivalry' ? ' • grab report cards' : ''}</small>
            </div>
          )}
        </>
      )}

      <div className="captions">
        {captions.map((c) => (
          <div key={c.id} className={`caption ${c.data.tone}`}>
            <div className="caption-text">{c.data.text}</div>
            {c.data.sub && <div className="caption-sub">{c.data.sub}</div>}
          </div>
        ))}
      </div>

      {comic && (
        <div key={comic.id} className="comic">
          <svg viewBox="0 0 200 120" aria-hidden="true">
            <polygon
              points="100,2 118,30 150,8 145,42 196,40 160,62 190,90 145,82 140,118 110,92 84,116 78,86 30,104 50,72 4,60 46,46 22,14 70,30"
              fill="#ffd400"
              stroke="#111"
              strokeWidth="4"
            />
          </svg>
          <span>{comic.data}</span>
        </div>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.data.tone}`}>
            <b>{t.data.text}</b>
            {t.data.sub && <span>{t.data.sub}</span>}
          </div>
        ))}
      </div>

      {hint && <div className="hint">{hint.data}</div>}

      {fact && !over && <FactToast factId={fact.data.factId} heading={fact.data.heading} onClose={() => setFact(null)} />}

      {touch && <TouchButtons engine={engine} />}

      {card && !over && (
        <div className="info-card">
          <button className="btn icon small close" aria-label="Dismiss" onClick={() => setCard(null)}>
            ✕
          </button>
          <b>{card.data.title}</b>
          <p>{card.data.body}</p>
        </div>
      )}

      {hud.skippable && !paused && (
        <button className="btn ghost skip" onClick={() => engine.skipCinematic()}>
          Skip ▸
        </button>
      )}

      {paused && !over && (
        <div className="modal">
          <div className="card modal-card">
            <h2>Paused</h2>
            {paused.reason === 'hidden' || paused.reason === 'blur' ? <p className="muted">Paused while the game was in the background.</p> : null}
            {paused.reason === 'orientation' ? <p className="muted">Paused while the screen rotated.</p> : null}
            {error && (
              <p className="msg">
                {error}{' '}
                <button className="btn small" onClick={() => location.reload()}>
                  Reload
                </button>
              </p>
            )}
            {confirm === null && (
              <>
                <button className="btn primary huge" onClick={() => { clearError(); engine.resumeGame(); }} autoFocus>
                  ▶ Resume
                </button>
                <div className="row">
                  <button className={`btn small ${save.settings.music ? 'on' : ''}`} onClick={() => updateSave((d) => (d.settings.music = !d.settings.music))}>
                    {save.settings.music ? '♪ Music on' : '♪ Music off'}
                  </button>
                  <button className={`btn small ${save.settings.sfx ? 'on' : ''}`} onClick={() => updateSave((d) => (d.settings.sfx = !d.settings.sfx))}>
                    {save.settings.sfx ? '🔊 Sound on' : '🔇 Sound off'}
                  </button>
                </div>
                <button className="btn" onClick={() => setConfirm('restart')}>
                  ↻ Restart run
                </button>
                <button className="btn" onClick={() => setConfirm('menu')}>
                  ⌂ Main menu
                </button>
              </>
            )}
            {confirm && (
              <>
                <p>{confirm === 'restart' ? 'Restart from zero? This run will end.' : 'Leave this run? Coins collected so far are kept.'}</p>
                <div className="row">
                  <button className="btn" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      setConfirm(null);
                      clearError();
                      if (confirm === 'restart') {
                        engine.resumeGame();
                        onRetry();
                      } else onMenu();
                    }}
                  >
                    {confirm === 'restart' ? 'Restart' : 'Leave'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {over && <GameOver over={over} onMenu={onMenu} onRetry={onRetry} onStart={onStart} />}
    </div>
  );
}

function LevelBar({ level }: { level: NonNullable<HudSnapshot['level']> }) {
  return (
    <div className="progress-box">
      <div className="meter-label">
        LEVEL {level.num} • {level.name.toUpperCase()}
      </div>
      <div className="bar progress">
        <div style={{ width: `${level.progress * 100}%` }} />
        <span className="flag">🏁</span>
      </div>
      <div className={`tokens ${level.tokens >= level.goal ? 'met' : ''}`}>
        {TOKEN_ICON[level.token]} {level.tokens}/{level.goal}
      </div>
    </div>
  );
}

function MayhemBar({ mayhem, tokens }: { mayhem: NonNullable<HudSnapshot['mayhem']>; tokens: number }) {
  return (
    <div className="progress-box mayhem">
      <div className="meter-label">🚁 MANIFESTO MAYHEM</div>
      <div className="bar progress manifesto">
        <div style={{ width: `${(1 - mayhem.progress) * 100}%` }} />
      </div>
      <div className="tokens">
        📦 {mayhem.dodged} dodged • ⭐ {tokens}
      </div>
    </div>
  );
}

function RaceBar({ race, you, rival, tokens }: { race: NonNullable<HudSnapshot['race']>; you: string; rival: string; tokens: number }) {
  const ahead = race.progress >= race.rival;
  return (
    <div className="progress-box race">
      <div className="meter-label">DEVELOPMENT RACE • {ahead ? 'YOU LEAD' : 'RIVAL LEADS'}</div>
      <div className="race-track">
        <span className="runner you" style={{ left: `${race.progress * 100}%` }} title={you}>
          {you}
        </span>
        <span className="runner rival" style={{ left: `${race.rival * 100}%` }} title={rival}>
          {rival}
        </span>
        <span className="flag">🏁</span>
      </div>
      <div className="tokens">⭐ {tokens} tokens • +3 m each</div>
    </div>
  );
}

function QuizPanel({ quiz }: { quiz: NonNullable<HudSnapshot['quiz']> }) {
  const done = quiz.chosen !== null;
  return (
    <div className={`quiz-panel ${done ? (quiz.correct ? 'right' : 'wrong') : ''}`} role="status" aria-live="polite">
      <div className="quiz-head">
        <b>✅ ACCOUNTABILITY GATE</b>
        <small>{done ? (quiz.correct ? 'Correct!' : 'Not this time') : `in ${quiz.metres} m • run through your answer`}</small>
      </div>
      <div className="quiz-q">{quiz.q}</div>
      <div className="quiz-options">
        {quiz.options.map((o, i) => (
          <div key={o} className={`quiz-opt lane${i} ${done && i === quiz.chosen ? 'chosen' : ''}`} title={LANE_NAMES[i]}>
            <b>{LETTERS[i]}</b> {o}
          </div>
        ))}
      </div>
    </div>
  );
}

function EncounterPanel({ enc }: { enc: NonNullable<HudSnapshot['encounter']> }) {
  if (enc.kind === 'redCap')
    return (
      <div className={`enc-panel ${enc.failed ? 'failed' : ''}`}>
        🧢 <b>RED CAP CHALLENGE</b> • {enc.failed ? 'challenge lost' : `${enc.metres} m to go • no crashes`}
      </div>
    );
  if (enc.kind === 'promises') {
    const pct = enc.total ? Math.round((enc.got / enc.total) * 100) : 0;
    return (
      <div className={`enc-panel ${enc.total && pct < 60 ? 'warn' : ''}`}>
        📜 <b>PROMISES VS PERFORMANCE</b> • {enc.got}/{enc.total} delivered ({pct}%, 60% needed) • {enc.metres} m
      </div>
    );
  }
  return null;
}

function FactToast({ factId, heading, onClose }: { factId: string; heading: string; onClose: () => void }) {
  const f = factById(factId);
  if (!f) return null;
  return (
    <div className="fact-toast">
      <button className="btn icon small close" aria-label="Dismiss" onClick={onClose}>
        ✕
      </button>
      <FactTypeBadge type={f.type} />
      <b>{heading.split(' • ').slice(1).join(' • ') || f.title}</b>
      <p>{f.text}</p>
      <small>Sources on the Achievements &amp; Facts board.</small>
    </div>
  );
}

const TOUCH: [string, 'left' | 'jump' | 'slide' | 'right', string][] = [
  ['◀', 'left', 'Move left'],
  ['▲', 'jump', 'Jump'],
  ['▼', 'slide', 'Slide'],
  ['▶', 'right', 'Move right'],
];

function TouchButtons({ engine }: { engine: Engine }) {
  return (
    <div className="touch-pad">
      {TOUCH.map(([label, action, name]) => (
        <button
          key={action}
          className="btn touch-btn"
          aria-label={name}
          onPointerDown={(e) => {
            e.preventDefault();
            engine.press(action);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function GameOver({
  over,
  onMenu,
  onRetry,
  onStart,
}: {
  over: { summary: RunSummary; info: RunResultInfo; at: number };
  onMenu: () => void;
  onRetry: () => void;
  onStart: (o: StartOptions) => void;
}) {
  const save = useSave();
  const { summary: s, info } = over;
  const [armed, setArmed] = useState(false);
  const [details, setDetails] = useState(false);
  // Guard against a swipe/tap from gameplay landing on Retry by accident.
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 700);
    return () => window.clearTimeout(t);
  }, []);
  const level = s.level ? levelById(s.level.id) : undefined;
  const next = level ? LEVELS[level.num] : undefined;
  const nextOpen = next ? levelUnlocked(save, next.id) : false;
  const won = !!(s.level?.completed || s.race?.won || (s.mode === 'mayhem' && s.completed));
  const title = level
    ? s.level?.completed
      ? 'LEVEL COMPLETE!'
      : 'LEVEL NOT FINISHED'
    : s.race
      ? s.race.won
        ? 'RACE WON!'
        : 'RIVAL WINS THE RACE'
      : s.mode === 'mayhem'
        ? s.completed
          ? 'MANIFESTO EMPTY!'
          : 'BURIED IN PROMISES!'
      : s.chaseResult === 'failed'
        ? 'CAUGHT IN THE SHOWDOWN!'
        : s.reason === 'quit'
          ? 'RUN ENDED'
          : 'RUN OVER';
  const best = save.best[s.mode];
  const b = s.breakdown;
  const badge = info.badgeEarned && level ? level.badge : null;
  return (
    <div className="modal">
      <div className={`card modal-card results ${won ? 'won' : ''}`}>
        <h2 className={won ? 'win' : ''}>{title}</h2>
        {level && (
          <div className="result-level">
            Level {level.num}: {level.name}
            {s.level?.completed && <Stars n={s.level.stars} big />}
          </div>
        )}
        {info.newBest && <div className="badge">NEW BEST!</div>}
        <div className="final-score" title={SCORE_NOTE}>
          {fmt(s.score)}
        </div>
        {badge && (
          <div className="reward-badge">
            <span className="reward-icon">{badge.icon}</span>
            <div>
              <b>Badge earned: {badge.name}</b>
              <small>{badge.perkText}</small>
            </div>
          </div>
        )}
        {info.giftCoins > 0 && <div className="msg">🏠 Public Service bonus: +₹{info.giftCoins}</div>}
        <div className="stats compact">
          {level && s.level && (
            <div>
              <span>{level.tokenName}</span>
              <b>
                {s.level.tokens}/{s.level.goal}
              </b>
            </div>
          )}
          {level && s.level && !s.level.completed && (
            <div>
              <span>Progress</span>
              <b>{Math.min(100, Math.round((s.distance / level.length) * 100))}%</b>
            </div>
          )}
          {s.race && (
            <div>
              <span>{s.race.won ? 'Winning margin' : 'Behind by'}</span>
              <b>{Math.abs(s.race.margin)} m</b>
            </div>
          )}
          {s.mode === 'mayhem' && (
            <div>
              <span>Fictional promises dodged</span>
              <b>{s.stats.fakePromisesDodged}</b>
            </div>
          )}
          {s.mode === 'rivalry' && (
            <div>
              <span>Stage reached</span>
              <b>
                {s.stats.stage} • report cards {s.stats.reportCards}
              </b>
            </div>
          )}
          <div>
            <span>Best</span>
            <b>{fmt(best)}</b>
          </div>
          <div>
            <span>Distance</span>
            <b>{fmt(s.distance)} m</b>
          </div>
          <div>
            <span>Coins</span>
            <b>
              ₹{fmt(s.coins)}
              {info.missionRewards > 0 && ` + ₹${info.missionRewards}`}
            </b>
          </div>
          {s.stats.quizAnswered > 0 && (
            <div>
              <span>Accountability Gates</span>
              <b>
                {s.stats.quizCorrect}/{s.stats.quizAnswered}
              </b>
            </div>
          )}
          {s.stats.rivalChallenges > 0 && (
            <div>
              <span>Red Cap Challenges</span>
              <b>
                {s.stats.rivalWins}/{s.stats.rivalChallenges} won
              </b>
            </div>
          )}
          {s.chaseResult !== 'none' && (
            <div>
              <span>Showdowns</span>
              <b>{s.chaseResult === 'survived' ? `Escaped ×${s.stats.chasesSurvived}` : s.stats.chasesSurvived ? `Escaped ×${s.stats.chasesSurvived}, then caught` : 'Caught'}</b>
            </div>
          )}
        </div>
        {s.missionsCompleted.length > 0 && (
          <div className="missions-done">
            {s.missionsCompleted.map((id) => (
              <div key={id}>🎯 {missionById(id)?.title}</div>
            ))}
          </div>
        )}
        {info.achievementsNow.map((id) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          return a ? (
            <div key={id} className="msg">
              {a.icon} Achievement unlocked: {a.name}
            </div>
          ) : null;
        })}
        {info.unlockedNow.map((id) => (
          <div key={id} className="msg">
            🔓 Unlocked {CHARACTERS[id.replace('char.', '') as keyof typeof CHARACTERS]?.name}!
          </div>
        ))}
        {info.nextLevelUnlocked && <div className="msg">🔓 Level {levelById(info.nextLevelUnlocked)?.num} unlocked: {levelById(info.nextLevelUnlocked)?.name}</div>}
        <button className="link" onClick={() => setDetails((v) => !v)}>
          {details ? 'Hide' : 'Show'} score breakdown
        </button>
        {details && (
          <div className="stats compact small">
            <div><span>Distance</span><b>{fmt(b.distance)}</b></div>
            <div><span>Coins</span><b>{fmt(b.coins)}</b></div>
            <div><span>Dodges</span><b>{fmt(b.dodges)}</b></div>
            <div><span>Showdown bonuses</span><b>{fmt(b.chase)}</b></div>
            <div><span>Development tokens</span><b>{fmt(b.tokens)}</b></div>
            <div><span>Rivalry &amp; gates</span><b>{fmt(b.rival)}</b></div>
            <div><span>Level / race</span><b>{fmt(b.level)}</b></div>
            <div><span>Missions</span><b>{fmt(b.missions)}</b></div>
            <div><span>Discoveries</span><b>{fmt(b.discovery)}</b></div>
            {s.discoveries.length > 0 && <div><span>New routes</span><b>{s.discoveries.map((t) => THEME_NAMES[t]).join(', ')}</b></div>}
          </div>
        )}
        <small className="muted">{SCORE_NOTE}</small>
        {level && s.level?.completed && next && nextOpen ? (
          <>
            <button className="btn primary huge" disabled={!armed} onClick={() => onStart({ mode: 'campaign', level: next.id, character: s.character })} autoFocus>
              ▶ Next: {next.name}
            </button>
            <button className="btn" disabled={!armed} onClick={onRetry}>
              ↻ Replay level
            </button>
          </>
        ) : (
          <button className="btn primary huge" disabled={!armed} onClick={onRetry} autoFocus>
            ↻ {level ? 'Replay level' : s.race ? 'Race again' : s.mode === 'mayhem' ? 'Fly again' : 'Retry'}
          </button>
        )}
        <button className="btn" disabled={!armed} onClick={onMenu}>
          ⌂ Main menu
        </button>
      </div>
    </div>
  );
}
