import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, type StartOptions } from '../engine/Engine';
import type { UiEvent } from '../engine/events';
import type { LevelId } from '../content/levels';
import type { CharacterId } from '../sim/types';
import { BoardScreen } from './Board';
import { GameOverlay } from './GameOverlay';
import { saveStore, updateSave, useSave } from './store';
import { CampaignScreen, CharacterScreen, heroFor, LevelIntroScreen, MayhemScreen, MenuScreen, MissionsScreen, ModeScreen, nextLevel, ScoresScreen, SettingsScreen, ShopScreen, TitleScreen } from './Screens';

export type Screen =
  | 'boot'
  | 'intro'
  | 'title'
  | 'menu'
  | 'campaign'
  | 'level'
  | 'modes'
  | 'mayhem'
  | 'board'
  | 'characters'
  | 'missions'
  | 'shop'
  | 'scores'
  | 'settings'
  | 'game'
  | 'error';

/** Screens shown over the idling character on the street. */
const SHOWCASE: readonly Screen[] = ['menu', 'campaign', 'level', 'characters', 'modes', 'mayhem', 'board', 'missions', 'shop', 'scores', 'settings'];

const store = saveStore();

async function loadFonts(): Promise<void> {
  try {
    const fonts = document.fonts;
    if (!fonts) return;
    await Promise.race([
      Promise.all([fonts.load("800 32px 'Baloo 2'"), fonts.load("600 32px 'Baloo 2'"), fonts.load("400 32px 'Bangers'")]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fallback fonts are fine */
  }
}

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [screen, setScreen] = useState<Screen>('boot');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [level, setLevel] = useState<LevelId>('expressway');
  const save = useSave();

  useEffect(() => {
    let cancelled = false;
    let off: (() => void) | undefined;
    (async () => {
      await loadFonts();
      if (cancelled || !hostRef.current) return;
      const engine = new Engine(hostRef.current, store);
      try {
        engine.init();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setScreen('error');
        return;
      }
      engineRef.current = engine;
      (window as unknown as { __UPRUN__: unknown }).__UPRUN__ = {
        engine,
        save: store,
        info: () => engine.debugInfo(),
        autopilot: (on: boolean) => engine.setAutopilot(on),
        fillMeter: () => engine.sim?.debugFillMeter(),
        stumble: () => engine.sim?.debugStumble(),
        clearRoad: (m: number) => engine.sim?.debugClearRoad(m),
        collect: (kind: string) => engine.sim?.debugCollect(kind as never),
        hud: () => engine.hud.get(),
      };
      off = engine.on((ev) => {
        if (ev.type === 'introDone') {
          updateSave((d) => (d.flags.introSeen = true));
          setScreen('title');
          return;
        }
        if (ev.type === 'error') {
          setError(ev.message);
        }
        setEvents((list) => [...list.slice(-40), ev]);
      });
      if (!store.data.flags.introSeen && !new URLSearchParams(location.search).has('nointro')) {
        engine.playIntro();
        setScreen('intro');
      } else setScreen('menu');
    })();
    return () => {
      cancelled = true;
      off?.();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.applySettings(save.settings);
  }, [save.settings]);

  const go = useCallback((s: Screen) => {
    const engine = engineRef.current;
    engine?.audio.unlock();
    engine?.audio.play('click');
    if (engine && SHOWCASE.includes(s)) engine.showShowcase(store.data.selectedCharacter);
    setScreen(s);
  }, []);

  const start = useCallback((opts: StartOptions) => {
    const engine = engineRef.current;
    if (!engine) return;
    setEvents([]);
    engine.startRun(opts, true);
    setScreen('game');
  }, []);

  const replayIntro = useCallback(() => {
    engineRef.current?.playIntro();
    setScreen('intro');
  }, []);

  const engine = engineRef.current;

  return (
    <div className="app">
      <div className="stage" ref={hostRef} />
      {screen === 'boot' && (
        <div className="boot">
          <div className="logo small">UP RUN</div>
          <p>Loading the streets…</p>
        </div>
      )}
      {screen === 'error' && (
        <div className="fatal">
          <h1>UP RUN can't start</h1>
          <p>{error}</p>
          <p className="muted">UP RUN needs WebGL. Try a current version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.</p>
          <button className="btn primary" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      )}
      {screen === 'intro' && engine && (
        <div className="intro-overlay">
          <div className="intro-caption">Uttar Pradesh • somewhere near Lucknow • a fictional morning</div>
          <button className="btn ghost skip" onClick={() => engine.skipIntro()}>
            Skip intro ▸
          </button>
        </div>
      )}
      {screen === 'title' && engine && (
        <TitleScreen onStart={() => start({ mode: 'campaign', level: nextLevel(store.data).id, character: heroFor(store.data) })} onMenu={() => go('menu')} />
      )}
      {screen === 'menu' && <MenuScreen go={go} />}
      {screen === 'campaign' && (
        <CampaignScreen
          go={go}
          pick={(id) => {
            engine?.audio.play('click');
            setLevel(id);
            setScreen('level');
          }}
        />
      )}
      {screen === 'level' && <LevelIntroScreen go={go} level={level} start={start} />}
      {screen === 'modes' && <ModeScreen go={go} start={start} />}
      {screen === 'mayhem' && <MayhemScreen go={go} start={start} />}
      {screen === 'board' && <BoardScreen go={go} />}
      {screen === 'characters' && engine && (
        <CharacterScreen go={go} preview={(id: CharacterId) => engine.showShowcase(id)} />
      )}
      {screen === 'missions' && <MissionsScreen go={go} />}
      {screen === 'shop' && engine && <ShopScreen go={go} refreshPreview={() => engine.showShowcase(store.data.selectedCharacter)} />}
      {screen === 'scores' && <ScoresScreen go={go} />}
      {screen === 'settings' && <SettingsScreen go={go} replayIntro={replayIntro} persistent={store.persistent} storageError={store.lastError} />}
      {screen === 'game' && engine && (
        <GameOverlay
          engine={engine}
          events={events}
          onMenu={() => {
            engine.quitToMenu();
            setEvents([]);
            setScreen('menu');
          }}
          onRetry={() => {
            setEvents([]);
            engine.restart();
          }}
          onStart={start}
          error={error}
          clearError={() => setError(null)}
        />
      )}
    </div>
  );
}
