import { useState } from 'react';
import { factById, FACT_TYPE_LABEL, type Fact } from '../content/facts';
import { LEVELS, levelById, type LevelDef, type LevelId } from '../content/levels';
import { NEWS_HEADLINES } from '../content/jokes';
import { GAME_SUBTITLE, GAME_TITLE, TAGLINE } from '../content/slogans';
import type { StartOptions } from '../engine/Engine';
import { activeMissions, levelUnlocked, priceOf, purchase, routeUnlocked, totalStars, type SaveData } from '../save/save';
import { CHARACTERS, CHARACTER_ORDER, ROUTES, RUN_STYLES, TRAILS, type CosmeticDef } from '../sim/characters';
import { MAYHEM_LENGTH, RACE_LENGTH } from '../sim/constants';
import { FAKE_PROMISES, MAYHEM_DISCLAIMER } from '../content/mayhem';
import { dayKey } from '../sim/missions';
import { THEME_INSPIRATION, THEME_NAMES } from '../sim/themes';
import type { CharacterId, EncounterKind } from '../sim/types';
import type { Screen } from './App';
import { DISCLAIMER, SCORE_NOTE, SHORT_DISCLAIMER } from './disclaimer';
import { saveStore, updateSave, useSave } from './store';

type Go = (s: Screen) => void;

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-IN');
}

/** The hero who runs campaign levels and races (the rival only runs Rivalry Mode). */
export function heroFor(save: SaveData): CharacterId {
  const id = save.selectedCharacter;
  return CHARACTERS[id].role === 'hero' && save.unlocked.includes('char.' + id) ? id : 'yogi';
}

export function nextLevel(save: SaveData): LevelDef {
  return LEVELS.find((l) => !save.levels[l.id].completed) ?? LEVELS[LEVELS.length - 1];
}

export const ENCOUNTER_LABEL: Record<EncounterKind, string> = {
  quiz: '✅ Accountability Gate',
  bulldozer: '🚜 Bulldozer power-up',
  redCap: '🧢 Red Cap Challenge',
  promises: '📜 Promises vs Performance',
};

function CoinPill({ coins }: { coins: number }) {
  return (
    <div className="coin-pill" aria-label={`${coins} coins`}>
      <span className="coin-icon">₹</span>
      {fmt(coins)}
    </div>
  );
}

function Header({ title, go, back = 'menu' }: { title: string; go: Go; back?: Screen }) {
  const save = useSave();
  return (
    <div className="screen-header">
      <button className="btn icon" onClick={() => go(back)} aria-label="Back">
        ←
      </button>
      <h2>{title}</h2>
      <CoinPill coins={save.coins} />
    </div>
  );
}

export function Stars({ n, of = 3, big = false }: { n: number; of?: number; big?: boolean }) {
  return (
    <span className={`stars ${big ? 'big' : ''}`} aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

export function FactTypeBadge({ type }: { type: Fact['type'] }) {
  return <span className={`fact-type ${type}`}>{FACT_TYPE_LABEL[type]}</span>;
}

export function FactCard({ fact, open = false }: { fact: Fact; open?: boolean }) {
  const [more, setMore] = useState(open);
  return (
    <div className={`card fact-card ${fact.type}`}>
      <div className="fact-head">
        <b>{fact.title}</b>
        <FactTypeBadge type={fact.type} />
      </div>
      <p>{fact.text}</p>
      {fact.note && <p className="fact-note">{fact.note}</p>}
      {fact.sources.length > 0 && (
        <button className="link" onClick={() => setMore((v) => !v)}>
          {more ? 'Hide sources' : `Sources (${fact.sources.length})`}
        </button>
      )}
      {more && (
        <ul className="sources">
          {fact.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.publisher}: {s.title}
              </a>
              {s.date && <small> • {s.date}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Scrolling satire headlines for the menu (clearly labelled as not news). */
function NewsTicker() {
  const [items] = useState(() => [...NEWS_HEADLINES].sort(() => Math.random() - 0.5).slice(0, 8));
  return (
    <div className="ticker" aria-label="Satire headlines (not real news)">
      <span className="ticker-tag">UP RUN NEWS • SATIRE</span>
      <div className="ticker-window">
        <div className="ticker-track">
          {[...items, ...items].map((h, i) => (
            <span key={i}>{h} ✦ </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <div className={`logo ${small ? 'small' : ''}`}>{GAME_TITLE}</div>
      <div className="brand-sub">{GAME_SUBTITLE}</div>
    </div>
  );
}

export function TitleScreen({ onStart, onMenu }: { onStart: () => void; onMenu: () => void }) {
  const save = useSave();
  const lv = nextLevel(save);
  return (
    <div className="panel-screen title-screen">
      <div className="title-block">
        <Brand />
        <div className="subtitle">{TAGLINE}</div>
      </div>
      <div className="tutorial card">
        <h3>How to play</h3>
        <ul>
          <li>
            <b>Swipe ← →</b> or press <kbd>←</kbd> <kbd>→</kbd> (<kbd>A</kbd> <kbd>D</kbd>) to change lanes
          </li>
          <li>
            <b>Swipe ↑</b> or press <kbd>Space</kbd> / <kbd>↑</kbd> to jump
          </li>
          <li>
            <b>Swipe ↓</b> or press <kbd>↓</kbd> / <kbd>S</kbd> to slide • <kbd>Esc</kbd> pauses
          </li>
          <li>Collect development tokens, reach the finish line and earn up to 3 stars per level.</li>
        </ul>
        <p className="gundaraj-def">
          <b>“Gundaraj”</b> is a campaign word for lawlessness and intimidation. In this game it is a political claim and a set of fictional obstacles you leave behind — not a statement about any real person.
        </p>
      </div>
      <div className="title-actions">
        <button className="btn primary huge" onClick={onStart} autoFocus>
          ▶ PLAY LEVEL {lv.num}
        </button>
        <button className="btn ghost" onClick={onMenu}>
          Main menu
        </button>
      </div>
      <p className="disclaimer">{SHORT_DISCLAIMER}</p>
    </div>
  );
}

export function MenuScreen({ go }: { go: Go }) {
  const save = useSave();
  const def = CHARACTERS[save.selectedCharacter];
  const done = LEVELS.filter((l) => save.levels[l.id].completed).length;
  return (
    <div className="panel-screen menu-screen">
      <div className="menu-top">
        <Brand small />
        <CoinPill coins={save.coins} />
      </div>
      <div className="menu-side">
        <div className="preview-name" style={{ borderColor: def.accent }}>
          <span>{def.name}</span>
          {def.fictional && <em> (fictional)</em>}
        </div>
        <button className="btn primary huge" onClick={() => go('campaign')}>
          ▶ CAMPAIGN <small className="btn-sub">{done}/8 levels • ★ {totalStars(save)}/24</small>
        </button>
        <div className="menu-grid">
          <button className="btn" onClick={() => go('modes')}>
            🧢 Rivalry • Race • Free Run
          </button>
          <button className="btn" onClick={() => go('mayhem')}>
            🚁 Manifesto Mayhem
          </button>
          <button className="btn" onClick={() => go('board')}>
            🏅 Achievements &amp; Facts
          </button>
          <button className="btn" onClick={() => go('scores')}>
            📊 Scoreboard
          </button>
          <button className="btn" onClick={() => go('characters')}>
            👤 Characters
          </button>
          <button className="btn" onClick={() => go('missions')}>
            🎯 Missions
          </button>
          <button className="btn" onClick={() => go('shop')}>
            🛍 Unlocks
          </button>
          <button className="btn" onClick={() => go('settings')}>
            ⚙ Settings
          </button>
        </div>
      </div>
      <NewsTicker />
      <p className="disclaimer">{SHORT_DISCLAIMER}</p>
    </div>
  );
}

export function CampaignScreen({ go, pick }: { go: Go; pick: (id: LevelId) => void }) {
  const save = useSave();
  return (
    <div className="panel-screen">
      <Header title="Campaign" go={go} />
      <div className="list">
        <div className="card campaign-summary">
          <b>Eight levels across a fictionalised Uttar Pradesh</b>
          <span>
            ★ {totalStars(save)}/24 • Badges {save.badges.length}/8
          </span>
        </div>
        <div className="level-map">
          {LEVELS.map((l) => {
            const p = save.levels[l.id];
            const open = levelUnlocked(save, l.id);
            return (
              <button key={l.id} className={`card level-card ${open ? '' : 'locked'} ${p.completed ? 'done' : ''}`} onClick={() => open && pick(l.id)} disabled={!open} aria-label={`Level ${l.num}: ${l.name}${open ? '' : ' (locked)'}`}>
                <span className="level-num">{l.num}</span>
                <span className="level-main">
                  <b>{l.name}</b>
                  <small>
                    {l.topic} • {THEME_NAMES[l.id]}
                  </small>
                </span>
                <span className="level-side">
                  {open ? <Stars n={p.stars} /> : <span className="lock-ico">🔒</span>}
                  <small>{open ? (p.completed ? `${l.badge.icon} ${l.badge.name}` : `${fmt(l.length)} m`) : `Finish level ${l.num - 1}`}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted center">Environments are fictionalised and inspired by real places; they are not documentary depictions.</p>
      </div>
    </div>
  );
}

export function LevelIntroScreen({ go, level, start }: { go: Go; level: LevelId; start: (o: StartOptions) => void }) {
  const save = useSave();
  const l = levelById(level)!;
  const p = save.levels[l.id];
  const hero = heroFor(save);
  const facts = l.facts.map((id) => factById(id)).filter((f): f is Fact => !!f);
  return (
    <div className="panel-screen">
      <Header title={`Level ${l.num}`} go={go} back="campaign" />
      <div className="list">
        <div className="card level-intro">
          <div className="level-intro-head">
            <div>
              <h3>{l.name}</h3>
              <small className="muted">{THEME_INSPIRATION[l.id]} — a fictionalised setting.</small>
            </div>
            <Stars n={p.stars} big />
          </div>
          <p className="mission-text">🎯 {l.mission}</p>
          <ul className="level-facts">
            <li>
              Collect <b>{l.tokenGoal}</b> {l.tokenName} • reach the finish at <b>{fmt(l.length)} m</b>
            </li>
            <li>{l.events.map((e) => ENCOUNTER_LABEL[e.kind]).filter((v, i, a) => a.indexOf(v) === i).join(' • ')}</li>
            <li>
              ★ finish • ★★ + token goal • ★★★ + no collisions
            </li>
            <li>
              Reward: {l.badge.icon} <b>{l.badge.name}</b> — {l.badge.perkText}
            </li>
          </ul>
          <p className="slogan">“{l.slogan}” <small>(game slogan)</small></p>
          <div className="row">
            <button className="btn primary huge" onClick={() => start({ mode: 'campaign', level: l.id, character: hero })} autoFocus>
              ▶ START AS {CHARACTERS[hero].shortName.toUpperCase()}
            </button>
          </div>
          {p.best > 0 && <p className="muted center">Best {fmt(p.best)} • tokens {p.tokens}/{l.tokenGoal}</p>}
        </div>
        <h3 className="section-title">Real-world context</h3>
        {facts.map((f) => (
          <FactCard key={f.id} fact={f} />
        ))}
        <p className="muted center">{SCORE_NOTE}</p>
      </div>
    </div>
  );
}

export function ModeScreen({ go, start }: { go: Go; start: (o: StartOptions) => void }) {
  const save = useSave();
  const unlocked = CHARACTER_ORDER.filter((id) => save.unlocked.includes('char.' + id));
  const [pick, setPick] = useState<CharacterId>(unlocked.includes(save.selectedCharacter) ? save.selectedCharacter : 'yogi');
  const hero = heroFor(save);
  return (
    <div className="panel-screen">
      <Header title="Play modes" go={go} />
      <div className="mode-list">
        <div className="card mode-card">
          <div className="mode-tag red">RIVALRY MODE</div>
          <h3>The Red Cap Run</h3>
          <p>
            Play as the Akhilesh Yadav-inspired rival. A <b>Political Challenge</b> waits ahead: you stumble, the Yogi Adityanath-inspired hero makes an entrance with a stylised bulldozer, and the <b>Governance Showdown</b> begins. Dodge and grab report cards until the timer runs out to clear each stage.
          </p>
          <div className="mode-foot">
            <span>
              Best stage {save.stats.bestStage} • Best {fmt(save.best.rivalry)}
            </span>
            <button className="btn primary" onClick={() => start({ mode: 'rivalry', character: 'akhilesh' })}>
              Play rivalry ▸
            </button>
          </div>
        </div>
        <div className="card mode-card">
          <div className="mode-tag saffron">DEVELOPMENT RACE</div>
          <h3>Race for roads, jobs and services</h3>
          <p>
            {CHARACTERS[hero].shortName} races the rival over {fmt(RACE_LENGTH)} m on parallel lanes. Every development token is a +3 m boost; a stumble costs time. First to the finish wins.
          </p>
          <div className="mode-foot">
            <span>
              Races won {save.stats.racesWon} • Best {fmt(save.best.race)}
            </span>
            <button className="btn primary" onClick={() => start({ mode: 'race', character: hero })}>
              Race ▸
            </button>
          </div>
        </div>
        <div className="card mode-card">
          <div className="mode-tag green">FREE RUN</div>
          <h3>Endless run</h3>
          <p>Environments rotate every 750 m, with Accountability Gates, rival challenges and power-ups along the way. Unlock more start routes in the campaign.</p>
          <div className="seg" role="radiogroup" aria-label="Runner">
            {unlocked.map((id) => (
              <button key={id} role="radio" aria-checked={pick === id} className={pick === id ? 'on' : ''} onClick={() => setPick(id)}>
                {CHARACTERS[id].shortName}
              </button>
            ))}
          </div>
          <div className="mode-foot">
            <span>
              From {THEME_NAMES[save.startRoute]} • Best {fmt(save.best.free)}
            </span>
            <button className="btn primary" onClick={() => start({ mode: 'free', character: pick })}>
              Run ▸
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MayhemScreen({ go, start }: { go: Go; start: (o: StartOptions) => void }) {
  const save = useSave();
  const hero = heroFor(save);
  const [samples] = useState(() => [...FAKE_PROMISES].sort(() => Math.random() - 0.5).slice(0, 4));
  return (
    <div className="panel-screen">
      <Header title="Manifesto Mayhem" go={go} />
      <div className="list">
        <div className="card level-intro mayhem-intro">
          <div className="level-intro-head">
            <div>
              <h3>🚁 Manifesto Mayhem</h3>
              <small className="muted">The rival caricature’s campaign cycle-copter is airborne — and it is full of promises.</small>
            </div>
          </div>
          <ul className="level-facts">
            <li>Crates of fictional promises parachute onto the road. A red ring shows where each one lands.</li>
            <li>Dodge them for {fmt(MAYHEM_LENGTH)} m until the manifesto runs empty; collect real development tokens on the way.</li>
            <li>One bump only slows you down while the stumble guard is ready; a second one ends the run.</li>
          </ul>
          <div className="promise-samples">
            {samples.map((p) => (
              <span key={p} className="promise-chip">
                📦 {p}
              </span>
            ))}
          </div>
          <div className="row">
            <button className="btn primary huge" onClick={() => start({ mode: 'mayhem', character: hero })} autoFocus>
              ▶ PLAY AS {CHARACTERS[hero].shortName.toUpperCase()}
            </button>
          </div>
          <p className="muted center">
            Best {fmt(save.best.mayhem)} • Wins {fmt(save.stats.mayhemWins)} • Promises dodged {fmt(save.stats.fakePromisesDodged)}
          </p>
          <p className="muted center small-print">{MAYHEM_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}

export function CharacterScreen({ go, preview }: { go: Go; preview: (id: CharacterId) => void }) {
  const save = useSave();
  const [idx, setIdx] = useState(Math.max(0, CHARACTER_ORDER.indexOf(save.selectedCharacter)));
  const id = CHARACTER_ORDER[idx];
  const def = CHARACTERS[id];
  const owned = save.unlocked.includes('char.' + id);
  const [msg, setMsg] = useState('');
  const move = (k: number) => {
    const n = (idx + k + CHARACTER_ORDER.length) % CHARACTER_ORDER.length;
    setIdx(n);
    setMsg('');
    preview(CHARACTER_ORDER[n]);
  };
  const buy = (itemId: string) => {
    let ok = false;
    updateSave((d) => {
      ok = purchase(d, itemId);
    });
    setMsg(ok ? 'Unlocked!' : 'Not enough coins yet.');
    return ok;
  };
  const equipOutfit = (outfitId: string) => {
    updateSave((d) => (d.equipped[id].outfit = outfitId));
    preview(id);
  };
  const role = def.role === 'hero' ? 'Hero: runs the campaign, Development Race and Free Run.' : 'Rival: played in Rivalry Mode and Free Run.';
  return (
    <div className="panel-screen char-screen">
      <Header title="Characters" go={go} />
      <div className="char-body">
        <div className="char-nav">
          <button className="btn icon big" onClick={() => move(-1)} aria-label="Previous character">
            ‹
          </button>
          <button className="btn icon big" onClick={() => move(1)} aria-label="Next character">
            ›
          </button>
        </div>
        <div className="card char-card" style={{ borderColor: def.accent }}>
          <h3>
            {def.name}
            {def.fictional ? <span className="tag">fictional</span> : <span className="tag inspired">caricature</span>}
          </h3>
          <p>{def.description}</p>
          <p className="muted">{role}</p>
          {!owned && def.unlock.kind === 'distance' && (
            <p className="lock">
              🔒 Run {fmt(def.unlock.metres)} m in one run, or{' '}
              <button className="btn small" onClick={() => buy('char.' + id)}>
                unlock for ₹{fmt(def.unlock.price)}
              </button>
            </p>
          )}
          <div className="outfits">
            {def.outfits.map((o) => {
              const has = save.unlocked.includes(o.id);
              const on = save.equipped[id].outfit === o.id;
              return (
                <button key={o.id} className={`chip ${on ? 'on' : ''}`} onClick={() => (has ? equipOutfit(o.id) : buy(o.id) && equipOutfit(o.id))} disabled={!owned}>
                  {o.name} {has ? (on ? '✓' : '') : `₹${o.price}`}
                </button>
              );
            })}
          </div>
          {msg && <p className="msg">{msg}</p>}
          <button
            className="btn primary"
            disabled={!owned || save.selectedCharacter === id}
            onClick={() => {
              updateSave((d) => (d.selectedCharacter = id));
              setMsg(def.role === 'hero' ? `${def.shortName} will run your levels, races and free runs.` : `${def.shortName} selected for Free Run (campaign levels use a hero).`);
            }}
          >
            {save.selectedCharacter === id ? 'Selected ✓' : owned ? 'Select' : 'Locked'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionsScreen({ go }: { go: Go }) {
  const save = useSave();
  const list = activeMissions(save);
  return (
    <div className="panel-screen">
      <Header title="Daily missions" go={go} />
      <div className="list">
        {list.map((m) => {
          const v = Math.min(m.def.goal, m.base);
          const done = m.completed;
          return (
            <div key={m.def.id} className={`card mission ${done ? 'done' : ''}`}>
              <div className="mission-row">
                <b>{m.def.title}</b>
                <span className="reward">{done ? '✓ Done' : `₹${m.def.reward}`}</span>
              </div>
              <div className="bar">
                <div style={{ width: `${(v / m.def.goal) * 100}%` }} />
              </div>
              <small>
                {fmt(done ? m.def.goal : v)} / {fmt(m.def.goal)} {m.def.scope === 'run' ? '(best single run today)' : '(today, all runs)'}
              </small>
            </div>
          );
        })}
        <p className="muted center">Missions for {dayKey()} • a new set arrives at local midnight. Progress is stored on this device only.</p>
      </div>
    </div>
  );
}

function ShopRow({ item, owned, equipped, onBuy, onEquip, lockText }: { item: CosmeticDef; owned: boolean; equipped: boolean; onBuy: () => void; onEquip: () => void; lockText?: string }) {
  return (
    <div className="card shop-row">
      <span>{item.name}</span>
      {lockText ? (
        <span className="muted">🔒 {lockText}</span>
      ) : owned ? (
        <button className={`btn small ${equipped ? 'on' : ''}`} onClick={onEquip} disabled={equipped}>
          {equipped ? 'Equipped ✓' : 'Equip'}
        </button>
      ) : (
        <button className="btn small primary" onClick={onBuy}>
          ₹{fmt(item.price)}
        </button>
      )}
    </div>
  );
}

export function ShopScreen({ go, refreshPreview }: { go: Go; refreshPreview: () => void }) {
  const save = useSave();
  const [tab, setTab] = useState<'trail' | 'runStyle' | 'route' | 'chars'>('trail');
  const [msg, setMsg] = useState('');
  const char = save.selectedCharacter;
  const buy = (id: string) => {
    let ok = false;
    updateSave((d) => (ok = purchase(d, id)));
    setMsg(ok ? 'Unlocked!' : 'Not enough coins yet — keep running.');
  };
  const items = tab === 'trail' ? TRAILS : tab === 'runStyle' ? RUN_STYLES : tab === 'route' ? ROUTES : [];
  const isEquipped = (it: CosmeticDef) =>
    it.kind === 'trail' ? save.equipped[char].trail === it.id : it.kind === 'runStyle' ? save.equipped[char].runStyle === it.id : save.startRoute === it.theme;
  const equip = (it: CosmeticDef) => {
    updateSave((d) => {
      if (it.kind === 'trail') d.equipped[char].trail = it.id;
      else if (it.kind === 'runStyle') d.equipped[char].runStyle = it.id;
      else if (it.theme) d.startRoute = it.theme;
    });
    refreshPreview();
  };
  const routeLock = (it: CosmeticDef) => {
    if (it.kind !== 'route' || !it.theme || routeUnlocked(save, it.theme)) return undefined;
    return `Finish level ${levelById(it.theme)?.num}`;
  };
  return (
    <div className="panel-screen">
      <Header title="Unlocks" go={go} />
      <div className="seg tabs">
        {(
          [
            ['trail', 'Trails'],
            ['runStyle', 'Run styles'],
            ['route', 'Start route'],
            ['chars', 'Characters'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="list">
        {tab !== 'route' && tab !== 'chars' && <p className="muted center">Applies to {CHARACTERS[char].name}. Cosmetic only — gameplay is identical.</p>}
        {tab === 'route' && <p className="muted center">Where Free Run and the Development Race start. Each route unlocks when you finish its campaign level.</p>}
        {items.map((it) => (
          <ShopRow
            key={it.id}
            item={it}
            owned={it.kind === 'route' || save.unlocked.includes(it.id)}
            equipped={isEquipped(it)}
            lockText={routeLock(it)}
            onBuy={() => buy(it.id)}
            onEquip={() => equip(it)}
          />
        ))}
        {tab === 'chars' &&
          CHARACTER_ORDER.map((id) => {
            const owned = save.unlocked.includes('char.' + id);
            return (
              <div key={id} className="card shop-row">
                <span>
                  {CHARACTERS[id].name}
                  {CHARACTERS[id].fictional ? ' (fictional)' : ''}
                </span>
                {owned ? (
                  <span className="muted">Owned ✓</span>
                ) : (
                  <button className="btn small primary" onClick={() => buy('char.' + id)}>
                    ₹{fmt(priceOf('char.' + id))}
                  </button>
                )}
              </div>
            );
          })}
        {msg && <p className="msg center">{msg}</p>}
        <p className="muted center">The game is free. No real-money purchases.</p>
      </div>
    </div>
  );
}

export function ScoresScreen({ go }: { go: Go }) {
  const save = useSave();
  const s = save.stats;
  const done = LEVELS.filter((l) => save.levels[l.id].completed).length;
  const row = (label: string, value: string) => (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
  return (
    <div className="panel-screen">
      <Header title="Scoreboard" go={go} />
      <div className="list">
        <div className="card scoreboard-head">
          <b>Performance is the real scoreboard</b>
          <small>{SCORE_NOTE}</small>
        </div>
        <div className="card stats">
          <h3>Personal bests</h3>
          {row('Best overall', fmt(save.best.overall))}
          {row('Campaign', fmt(save.best.campaign))}
          {row('Rivalry Mode', fmt(save.best.rivalry))}
          {row('Development Race', fmt(save.best.race))}
          {row('Free Run', fmt(save.best.free))}
          {row('Manifesto Mayhem', fmt(save.best.mayhem))}
          {row('Longest run', `${fmt(save.bestDistance)} m`)}
        </div>
        <div className="card stats">
          <h3>Development record</h3>
          {row('Levels completed', `${done} / 8`)}
          {row('Stars', `${totalStars(save)} / 24`)}
          {row('Development tokens', fmt(s.devTokens))}
          {row('Missions completed', fmt(s.missionsCompleted))}
          {row('Obstacles avoided', fmt(s.obstaclesAvoided))}
          {row('Debris cleared by the bulldozer', fmt(s.roadsCleared))}
          {row('Promises delivered', fmt(s.promisesDelivered))}
        </div>
        <div className="card stats">
          <h3>Rivalry record</h3>
          {row('Red Cap Challenges won', fmt(s.rivalWins))}
          {row('Accountability Gates passed', `${fmt(s.quizCorrect)} / ${fmt(s.quizAnswered)}`)}
          {row('Manifesto Mayhem wins', fmt(s.mayhemWins))}
          {row('Fictional promises dodged', fmt(s.fakePromisesDodged))}
          {row('Development Races won', fmt(s.racesWon))}
          {row('Best Rivalry stage', fmt(s.bestStage))}
          {row('Showdowns survived', fmt(s.chasesSurvived))}
        </div>
        <div className="card stats">
          <h3>Lifetime</h3>
          {row('Runs', fmt(s.runs))}
          {row('Distance', `${fmt(s.totalDistance)} m`)}
          {row('Coins collected', fmt(s.totalCoins))}
          {row('Routes discovered', save.discovered.map((t) => THEME_NAMES[t]).join(', '))}
        </div>
        <p className="muted center">Scores are stored on this device only. There is no global leaderboard.</p>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="card toggle">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsScreen({ go, replayIntro, persistent, storageError }: { go: Go; replayIntro: () => void; persistent: boolean; storageError: string | null }) {
  const save = useSave();
  const s = save.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (fn: (d: SaveData) => void) => updateSave(fn);
  return (
    <div className="panel-screen">
      <Header title="Settings" go={go} />
      <div className="list">
        <Toggle label="Music" value={s.music} onChange={(v) => set((d) => (d.settings.music = v))} />
        <Toggle label="Sound effects" value={s.sfx} onChange={(v) => set((d) => (d.settings.sfx = v))} />
        <Toggle label="On-screen touch buttons" hint="◀ ▲ ▼ ▶ buttons in addition to swipes" value={s.touchButtons} onChange={(v) => set((d) => (d.settings.touchButtons = v))} />
        <Toggle label="Reduced motion" hint="No screen shake, fewer particles" value={s.reducedMotion} onChange={(v) => set((d) => (d.settings.reducedMotion = v))} />
        <Toggle label="Short cinematics" hint="Always use the quick hero entrance" value={s.shortCinematics} onChange={(v) => set((d) => (d.settings.shortCinematics = v))} />
        <div className="card toggle">
          <span>Graphics quality</span>
          <div className="seg">
            {(['auto', 'high', 'low'] as const).map((q) => (
              <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => set((d) => (d.settings.quality = q))}>
                {q}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="Show collision boxes" hint="Developer view" value={s.debugColliders} onChange={(v) => set((d) => (d.settings.debugColliders = v))} />
        <button className="btn" onClick={replayIntro}>
          ▶ Watch the intro again
        </button>
        {!persistent && <p className="msg">This browser is blocking storage (private mode?). Progress lasts until you close the tab.</p>}
        {storageError && <p className="msg">{storageError}</p>}
        {!confirmReset ? (
          <button className="btn danger" onClick={() => setConfirmReset(true)}>
            Reset all progress…
          </button>
        ) : (
          <div className="card confirm">
            <p>Erase coins, levels, badges, unlocks, scores and missions on this device?</p>
            <div className="row">
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  saveStore().reset();
                  setConfirmReset(false);
                }}
              >
                Erase
              </button>
            </div>
          </div>
        )}
        <div className="card credits">
          <h3>About</h3>
          <p>{DISCLAIMER}</p>
          <p>
            Political symbols: the game uses saffron, white and green colours but no party logos, election symbols or official emblems, and it does not imply any endorsement. The bulldozer is a stylised game symbol: it never touches a person, never demolishes a home, and only pushes unoccupied debris off the road.
          </p>
          <p>All 3D models are generated in code; all music and sound effects are synthesised in your browser. No personal data is collected; progress stays in this browser.</p>
        </div>
      </div>
    </div>
  );
}
