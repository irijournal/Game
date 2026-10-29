import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, type StartOptions } from '../engine/Engine';
import type { UiEvent } from '../engine/events';
import type { CharacterId } from '../sim/types';
import { GameOverlay } from './GameOverlay';
import { saveStore, updateSave, useSave } from './store';
import { CharacterScreen, MenuScreen, MissionsScreen, ModeScreen, ScoresScreen, SettingsScreen, ShopScreen, TitleScreen } from './Screens';

export type Screen = 'boot' | 'intro' | 'title' | 'menu' | 'modes' | 'characters' | 'missions' | 'shop' | 'scores' | 'settings' | 'game' | 'error';

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
    if (engine && (s === 'menu' || s === 'characters' || s === 'modes' || s === 'missions' || s === 'shop' || s === 'scores' || s === 'settings')) {
      engine.showShowcase(store.data.selectedCharacter);
    }
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
      {screen === 'title' && engine && <TitleScreen onStart={() => start({ mode: 'A', character: 'akhilesh' })} onMenu={() => go('menu')} />}
      {screen === 'menu' && <MenuScreen go={go} />}
      {screen === 'modes' && <ModeScreen go={go} start={start} />}
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
