import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Engine, StartOptions } from '../engine/Engine';
import type { CaptionTone, ToastTone, UiEvent } from '../engine/events';
import type { RunResultInfo } from '../save/save';
import { CHARACTERS, CHARACTER_ORDER } from '../sim/characters';
import { missionById } from '../sim/missions';
import type { RunSummary } from '../sim/simulation';
import { THEME_NAMES } from '../sim/themes';
import { updateSave, useSave } from './store';

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
          setToasts((t) => [...t.filter((x) => x.until > now), { id: uid++, until: now + 2800, data: { text: ev.text, sub: ev.sub, tone: ev.tone } }].slice(-3));
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
        case 'paused':
          setPaused(ev.paused ? { reason: ev.reason } : null);
          if (!ev.paused) setConfirm(null);
          break;
        case 'gameOver':
          setOver({ summary: ev.summary, info: ev.info, at: now });
          setCaptions([]);
          setHint(null);
          setCard(null);
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
      force((n) => n + 1);
    }, 150);
    return () => window.clearInterval(t);
  }, []);

  const chase = hud.chase;
  const p = hud.power;
  const speedLines = p?.kind === 'vikas' || p?.kind === 'speedRun';
  const chaseLabel = chase?.kind === 'cycle' ? 'CYCLE YATRA CHASE' : 'BULLDOZER CHASE';

  return (
    <div className={`game-ui ${hud.state === 'CHASE' ? 'chasing' : ''}`}>
      {speedLines && <div className={`speed-lines ${p?.kind}`} />}
      {hud.active && !over && (
        <>
          <div className="hud-left">
            <div className="score" aria-label="score">
              {fmt(hud.score)}
              {hud.multiplier > 1 && <span className="mult">×{hud.multiplier}</span>}
            </div>
            <div className="dist">{fmt(hud.distance)} m • {THEME_NAMES[hud.theme]}</div>
            {hud.mode !== 'B' && (
              <div className="meter" title="A fictional satirical meter, not a measurement of anything real">
                <div className="meter-label">
                  GUNDARAJ METER <small>satire</small>
                </div>
                <div className="bar">
                  <div style={{ width: `${hud.meter}%` }} />
                </div>
              </div>
            )}
            {hud.mode !== 'B' && (
              <div className={`guard ${hud.guardReady && hud.state !== 'CHASE' ? 'ready' : ''}`}>
                {hud.state === 'CHASE' || hud.state === 'CINEMATIC'
                  ? '⚠ Chase: one hit ends the run'
                  : hud.guardReady
                    ? '🛡 Stumble guard ready'
                    : hud.guardT > 0
                      ? `🛡 Guard recharging ${Math.ceil(hud.guardT)}s`
                      : '🛡 Guard used'}
              </div>
            )}
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
                <span>{p.kind === 'vikas' ? '🚄 Vikas Express' : p.kind === 'magnet' ? '🧲 Vote Magnet' : '⚡ Speed Run ×2'}</span>
                <div className="bar thin">
                  <div style={{ width: `${(p.t / p.total) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          {chase && (
            <div className="chase-bar" role="timer" aria-label={`${chaseLabel} ${chase.remaining.toFixed(1)} seconds left`}>
              <div className="chase-title">
                {chase.kind === 'cycle' ? '🚲' : '🚜'} {chaseLabel} {chase.stage > 0 && <span className="stage">Stage {chase.stage}/3</span>} <b>{chase.remaining.toFixed(1)}s</b>
              </div>
              <div className="bar">
                <div style={{ width: `${100 - (chase.remaining / chase.total) * 100}%` }} />
              </div>
              <small>Escapes: {chase.escapes} • every dodge shortens the chase • 2× coins</small>
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
  const title = s.completed ? 'CHALLENGE COMPLETE!' : s.chaseResult === 'failed' ? 'CAUGHT IN THE CHASE!' : s.reason === 'quit' ? 'RUN ENDED' : 'RUN OVER';
  const best = save.best[s.mode];
  const others = CHARACTER_ORDER.filter((id) => id !== s.character && save.unlocked.includes('char.' + id));
  const b = s.breakdown;
  return (
    <div className="modal">
      <div className="card modal-card results">
        <h2 className={s.completed ? 'win' : ''}>{title}</h2>
        {info.newBest && <div className="badge">NEW BEST!</div>}
        <div className="final-score">{fmt(s.score)}</div>
        <div className="stats compact">
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
          <div>
            <span>Chase</span>
            <b>{s.chaseResult === 'survived' ? `Survived ×${s.stats.chasesSurvived}` : s.chaseResult === 'failed' ? (s.stats.chasesSurvived ? `Survived ×${s.stats.chasesSurvived}, then caught` : 'Caught') : 'No chase'}</b>
          </div>
        </div>
        {s.missionsCompleted.length > 0 && (
          <div className="missions-done">
            {s.missionsCompleted.map((id) => (
              <div key={id}>🎯 {missionById(id)?.title}</div>
            ))}
          </div>
        )}
        {info.unlockedNow.map((id) => (
          <div key={id} className="msg">🔓 Unlocked {CHARACTERS[id.replace('char.', '') as keyof typeof CHARACTERS]?.name}!</div>
        ))}
        {s.mode === 'C' && (
          <div className="faceoff">
            <b>Today's Political Face-Off</b>
            {CHARACTER_ORDER.filter((id) => save.unlocked.includes('char.' + id)).map((id) => (
              <div key={id} className={id === s.character ? 'me' : ''}>
                <span>{CHARACTERS[id].shortName}</span>
                <b>{fmt(save.showdown.best[id])}</b>
              </div>
            ))}
          </div>
        )}
        <button className="link" onClick={() => setDetails((v) => !v)}>
          {details ? 'Hide' : 'Show'} score breakdown
        </button>
        {details && (
          <div className="stats compact small">
            <div><span>Distance</span><b>{fmt(b.distance)}</b></div>
            <div><span>Coins</span><b>{fmt(b.coins)}</b></div>
            <div><span>Dodges</span><b>{fmt(b.dodges)}</b></div>
            <div><span>Chase bonuses</span><b>{fmt(b.chase)}</b></div>
            <div><span>Missions</span><b>{fmt(b.missions)}</b></div>
            <div><span>Discoveries</span><b>{fmt(b.discovery)}</b></div>
            <div><span>Tokens</span><b>{fmt(b.tokens)}</b></div>
            {s.discoveries.length > 0 && <div><span>New routes</span><b>{s.discoveries.map((t) => THEME_NAMES[t]).join(', ')}</b></div>}
          </div>
        )}
        <button className="btn primary huge" disabled={!armed} onClick={onRetry} autoFocus>
          ↻ Retry
        </button>
        {s.mode === 'C' &&
          others.map((id) => (
            <button key={id} className="btn" disabled={!armed} onClick={() => onStart({ mode: 'C', character: id })}>
              Try the same course as {CHARACTERS[id].shortName}
            </button>
          ))}
        <button className="btn" disabled={!armed} onClick={onMenu}>
          ⌂ Main menu
        </button>
      </div>
    </div>
  );
}
