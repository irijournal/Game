import { useState } from 'react';
import type { StartOptions } from '../engine/Engine';
import { activeMissions, priceOf, purchase, type SaveData } from '../save/save';
import { CHARACTERS, CHARACTER_ORDER, ROUTES, RUN_STYLES, TRAILS, type CosmeticDef } from '../sim/characters';
import { dayKey } from '../sim/missions';
import { THEME_NAMES } from '../sim/themes';
import type { CharacterId, ThemeId } from '../sim/types';
import type { Screen } from './App';
import { saveStore, updateSave, useSave } from './store';
import { DISCLAIMER, SHORT_DISCLAIMER } from './disclaimer';

type Go = (s: Screen) => void;

function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-IN');
}

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

export function TitleScreen({ onStart, onMenu }: { onStart: () => void; onMenu: () => void }) {
  return (
    <div className="panel-screen title-screen">
      <div className="title-block">
        <div className="logo">UP RUN</div>
        <div className="subtitle">Uttar Pradesh: The Great Political Run</div>
      </div>
      <div className="tutorial card">
        <h3>How to play</h3>
        <ul>
          <li>
            <b>Swipe ← →</b> or press <kbd>←</kbd> <kbd>→</kbd> to change lanes
          </li>
          <li>
            <b>Swipe ↑</b> or press <kbd>Space</kbd> / <kbd>↑</kbd> to jump
          </li>
          <li>
            <b>Swipe ↓</b> or press <kbd>↓</kbd> to slide
          </li>
          <li>Collect coins, avoid obstacles, survive as long as you can.</li>
        </ul>
      </div>
      <div className="title-actions">
        <button className="btn primary huge" onClick={onStart} autoFocus>
          ▶ START
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
  return (
    <div className="panel-screen menu-screen">
      <div className="menu-top">
        <div className="logo small">UP RUN</div>
        <CoinPill coins={save.coins} />
      </div>
      <div className="menu-side">
        <div className="preview-name" style={{ borderColor: def.accent }}>
          <span>{def.name}</span>
          {def.fictional && <em> (fictional)</em>}
        </div>
        <button className="btn primary huge" onClick={() => go('modes')}>
          ▶ START GAME
        </button>
        <div className="menu-grid">
          <button className="btn" onClick={() => go('characters')}>
            🧢 Select Character
          </button>
          <button className="btn" onClick={() => go('missions')}>
            🎯 Missions
          </button>
          <button className="btn" onClick={() => go('shop')}>
            🛍 Unlocks
          </button>
          <button className="btn" onClick={() => go('scores')}>
            🏆 High Score <b>{fmt(save.best.overall)}</b>
          </button>
          <button className="btn" onClick={() => go('settings')}>
            ⚙ Settings
          </button>
        </div>
      </div>
      <p className="disclaimer">{SHORT_DISCLAIMER}</p>
    </div>
  );
}

export function ModeScreen({ go, start }: { go: Go; start: (o: StartOptions) => void }) {
  const save = useSave();
  const unlocked = CHARACTER_ORDER.filter((id) => save.unlocked.includes('char.' + id));
  const [pick, setPick] = useState<CharacterId>(unlocked.includes(save.selectedCharacter) ? save.selectedCharacter : 'akhilesh');
  return (
    <div className="panel-screen">
      <Header title="Choose a mode" go={go} />
      <div className="mode-list">
        <div className="card mode-card">
          <div className="mode-tag">MODE A</div>
          <h3>Political Run</h3>
          <p>Play as Akhilesh Yadav through a fictional Uttar Pradesh. Fill the satirical Gundaraj Meter — or stumble — and a rival makes an entrance.</p>
          <div className="mode-foot">
            <span>Best {fmt(save.best.A)}</span>
            <button className="btn primary" onClick={() => start({ mode: 'A', character: 'akhilesh' })}>
              Run ▸
            </button>
          </div>
        </div>
        <div className="card mode-card">
          <div className="mode-tag saffron">MODE B</div>
          <h3>Bulldozer Chase</h3>
          <p>A 30-second chase challenge featuring Yogi Adityanath and a stylised bulldozer. Dodge to escape — nobody gets hurt.</p>
          <div className="mode-foot">
            <span>Best {fmt(save.best.B)}</span>
            <button className="btn primary" onClick={() => start({ mode: 'B', character: 'akhilesh' })}>
              Chase ▸
            </button>
          </div>
        </div>
        <div className="card mode-card">
          <div className="mode-tag blue">MODE C</div>
          <h3>Political Showdown</h3>
          <p>Pick your runner. Same rules, same course of the day for everyone — compare who goes further.</p>
          <div className="seg" role="radiogroup" aria-label="Runner">
            {unlocked.map((id) => (
              <button key={id} role="radio" aria-checked={pick === id} className={pick === id ? 'on' : ''} onClick={() => setPick(id)}>
                {CHARACTERS[id].shortName}
              </button>
            ))}
          </div>
          <div className="mode-foot">
            <span>
              Today: {unlocked.map((id) => `${CHARACTERS[id].shortName} ${fmt(save.showdown.best[id])}`).join(' • ')}
            </span>
            <button className="btn primary" onClick={() => start({ mode: 'C', character: pick })}>
              Showdown ▸
            </button>
          </div>
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
  return (
    <div className="panel-screen char-screen">
      <Header title="Select character" go={go} />
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
            {def.fictional && <span className="tag">fictional</span>}
          </h3>
          <p>{def.description}</p>
          <p className="muted">
            Rival entrance: <b>{CHARACTERS[def.rival].name}</b> with the {CHARACTERS[def.rival].vehicle === 'bulldozer' ? 'bulldozer' : 'giant cycle'}.
          </p>
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
                <button
                  key={o.id}
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() => (has ? equipOutfit(o.id) : buy(o.id) && equipOutfit(o.id))}
                  disabled={!owned}
                >
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
              setMsg(`${def.shortName} selected for Political Showdown.`);
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

function ShopRow({ item, owned, equipped, onBuy, onEquip }: { item: CosmeticDef; owned: boolean; equipped: boolean; onBuy: () => void; onEquip: () => void }) {
  return (
    <div className="card shop-row">
      <span>{item.name}</span>
      {owned ? (
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
    it.kind === 'trail' ? save.equipped[char].trail === it.id : it.kind === 'runStyle' ? save.equipped[char].runStyle === it.id : 'route.' + save.startRoute === it.id;
  const equip = (it: CosmeticDef) => {
    updateSave((d) => {
      if (it.kind === 'trail') d.equipped[char].trail = it.id;
      else if (it.kind === 'runStyle') d.equipped[char].runStyle = it.id;
      else d.startRoute = it.id.replace('route.', '') as ThemeId;
    });
    refreshPreview();
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
        {tab === 'route' && <p className="muted center">Choose where runs start. Routes then rotate every 750 m.</p>}
        {items.map((it) => (
          <ShopRow key={it.id} item={it} owned={save.unlocked.includes(it.id)} equipped={isEquipped(it)} onBuy={() => buy(it.id)} onEquip={() => equip(it)} />
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
                {owned ? <span className="muted">Owned ✓</span> : <button className="btn small primary" onClick={() => buy('char.' + id)}>₹{fmt(priceOf('char.' + id))}</button>}
              </div>
            );
          })}
        {msg && <p className="msg center">{msg}</p>}
        <p className="muted center">The core game is free. No real-money purchases.</p>
      </div>
    </div>
  );
}

export function ScoresScreen({ go }: { go: Go }) {
  const save = useSave();
  const s = save.stats;
  return (
    <div className="panel-screen">
      <Header title="High scores" go={go} />
      <div className="list">
        <div className="card stats">
          <div>
            <span>Best overall</span>
            <b>{fmt(save.best.overall)}</b>
          </div>
          <div>
            <span>Political Run</span>
            <b>{fmt(save.best.A)}</b>
          </div>
          <div>
            <span>Bulldozer Chase</span>
            <b>{fmt(save.best.B)}</b>
          </div>
          <div>
            <span>Political Showdown</span>
            <b>{fmt(save.best.C)}</b>
          </div>
          <div>
            <span>Longest run</span>
            <b>{fmt(save.bestDistance)} m</b>
          </div>
        </div>
        <div className="card stats">
          <h3>Today's showdown course</h3>
          {CHARACTER_ORDER.filter((id) => save.unlocked.includes('char.' + id)).map((id) => (
            <div key={id}>
              <span>{CHARACTERS[id].name}</span>
              <b>{fmt(save.showdown.best[id])}</b>
            </div>
          ))}
        </div>
        <div className="card stats">
          <h3>Lifetime</h3>
          <div>
            <span>Runs</span>
            <b>{fmt(s.runs)}</b>
          </div>
          <div>
            <span>Distance</span>
            <b>{fmt(s.totalDistance)} m</b>
          </div>
          <div>
            <span>Coins collected</span>
            <b>{fmt(s.totalCoins)}</b>
          </div>
          <div>
            <span>Chases survived</span>
            <b>{fmt(s.chasesSurvived)}</b>
          </div>
          <div>
            <span>Routes discovered</span>
            <b>{save.discovered.map((t) => THEME_NAMES[t]).join(', ')}</b>
          </div>
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
        <Toggle label="Reduced motion" hint="No screen shake, fewer particles" value={s.reducedMotion} onChange={(v) => set((d) => (d.settings.reducedMotion = v))} />
        <Toggle label="Short cinematics" hint="Always use the quick rival entrance" value={s.shortCinematics} onChange={(v) => set((d) => (d.settings.shortCinematics = v))} />
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
            <p>Erase coins, unlocks, scores and missions on this device?</p>
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
          <p>All 3D models are generated in code; all music and sound effects are synthesised in your browser. No official logos or party symbols are used as branding. No personal data is collected; progress stays in this browser.</p>
        </div>
      </div>
    </div>
  );
}
