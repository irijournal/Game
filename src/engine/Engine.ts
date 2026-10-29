import * as THREE from 'three';
import { factById, FACT_TYPE_LABEL } from '../content/facts';
import { levelById, type LevelId } from '../content/levels';
import { COMIC_WORDS, HERO_LINES, NEWS_HEADLINES, pick, RIVAL_LINES } from '../content/jokes';
import { QUIZ, quizById } from '../content/quiz';
import { activeMissions, applyRun, perksFor, type RunResultInfo, type SaveStore, type Settings } from '../save/save';
import { Autopilot } from '../sim/autopilot';
import { CHARACTERS } from '../sim/characters';
import { LANE_X, RACE_LENGTH, RACE_PACE } from '../sim/constants';
import { hashString } from '../sim/rng';
import { Simulation, type RunSummary, type SimEvent } from '../sim/simulation';
import { THEME_NAMES } from '../sim/themes';
import type { Action, CharacterId, ModeId, ObstacleClass, ThemeId } from '../sim/types';
import { AudioEngine, type Track } from './audio';
import { CameraRig } from './camera';
import { HudStore, type CaptionTone, type HudSnapshot, type UiEvent } from './events';

type HudSnapshotQuiz = HudSnapshot['quiz'];
import { InputController, type InputAction } from './input';
import { buildCharacter, disposeRig } from './view/characterModels';
import type { CharacterRig } from './view/characterRig';
import { INTRO_LENGTH, introShot, RivalDirector } from './view/cinematics';
import { DebateStage, type Speaker } from './view/debateStage';
import { Particles } from './view/effects';
import { EncounterViews, RIBBON_RACE } from './view/encounterViews';
import { basic, mergeStatic, mesh, plane } from './view/materials';
import { buildAutoRickshaw } from './view/vehicles';
import { debugCollider, ObstaclePool, type ObstacleView } from './view/obstacleViews';
import { PickupViews } from './view/pickupViews';
import { blobShadow } from './view/textures';
import { World } from './view/world';

export interface StartOptions {
  mode: ModeId;
  character: CharacterId;
  /** Campaign only. */
  level?: LevelId;
}

type EngineMode = 'boot' | 'intro' | 'attract' | 'showcase' | 'game' | 'debate';

const CELEBRATION = 2.2;
const LETTERS = ['A', 'B', 'C'];

interface Knocked {
  view: ObstacleView;
  t: number;
  vx: number;
  vy: number;
  spin: number;
}

const HINTS: Record<ObstacleClass, string> = {
  low: 'JUMP!  Swipe ↑ or press Space / ↑',
  high: 'SLIDE!  Swipe ↓ or press ↓',
  wall: 'CHANGE LANE!  Swipe ← → or press ← →',
  gap: 'JUMP THE GAP!  Swipe ↑ or press Space',
};

/**
 * Owns the renderer, the single animation-frame loop, input, audio and the
 * mapping from simulation state to the 3D scene. There is exactly one loop;
 * starting a new run replaces the simulation, never the loop.
 */
export class Engine {
  readonly hud = new HudStore();
  readonly audio = new AudioEngine();
  private listeners = new Set<(e: UiEvent) => void>();
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new CameraRig();
  private world!: World;
  private fx = new Particles(700);
  private pickups = new PickupViews();
  private rival = new RivalDirector();
  private encounters = new EncounterViews();
  private debate = new DebateStage();
  private pool = new ObstaclePool();
  private input!: InputController;
  private player: CharacterRig | null = null;
  private playerKey = '';
  private playerShadow: THREE.Mesh;
  private obstacleViews = new Map<number, ObstacleView>();
  private gantries = new Map<number, THREE.Group>();
  private colliders = new Map<number, THREE.LineSegments>();
  private knocked = new Map<number, Knocked>();
  private fluttered = new Set<number>();
  sim: Simulation | null = null;
  private autopilot: Autopilot | null = null;
  private mode: EngineMode = 'boot';
  paused = false;
  private raf = 0;
  private lastT = 0;
  private time = 0;
  private introT = 0;
  private menuD = 0;
  private hudTimer = 0;
  private trailTimer = 0;
  private lastOpts: StartOptions | null = null;
  private captions: { at: number; ev: UiEvent; fired: boolean }[] = [];
  private settings: Settings;
  private frameTimes: number[] = [];
  private pixelRatio = 1;
  private coinSfxT = 0;
  private resizeObs: ResizeObserver | null = null;
  private disposers: (() => void)[] = [];
  private gameOverSent = false;
  private traffic = new THREE.Group();
  /** Seconds left of the per-character starting-line moment (menu starts only). */
  private flourish = 0;
  private static readonly FLOURISH = 1.5;
  private lastTrack: Track = 'none';
  /** Victory beat before the reward screen (level complete / race won). */
  private celebrateT = 0;
  /** Seconds since the simulation reached GAME_OVER. */
  private overT = 0;
  /** Seconds until the next "UP RUN News" satire flash. */
  private newsT = 18;
  private ribbonRaceShown = false;
  private pendingResult: { summary: RunSummary; info: RunResultInfo } | null = null;
  debugAutopilot = false;
  /** Test hook: when true the RAF loop idles and stepManual() drives time. */
  manual = false;

  constructor(
    private container: HTMLElement,
    private save: SaveStore,
  ) {
    this.settings = save.data.settings;
    this.playerShadow = mesh(plane(1.1, 1.1), basic(0xffffff, { map: null, transparent: true, key: 'pshadow' }));
  }

  // ---------------------------------------------------------------- setup

  /** Throws if WebGL is unavailable; the UI shows a readable error. */
  init(): void {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL is not available in this browser.');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.className = 'game-canvas';
    this.container.appendChild(canvas);

    this.world = new World(this.scene);
    this.scene.add(this.fx.points, this.pickups.group, this.rival.group, this.encounters.group, this.debate.group);
    (this.playerShadow.material as THREE.MeshBasicMaterial).map = blobShadow();
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.playerShadow);
    this.pool.warm();
    // Decorative traffic for the opening's aerial shot (never in gameplay).
    const proto = mergeStatic(buildAutoRickshaw());
    for (let i = 0; i < 6; i++) {
      const a = proto.clone();
      a.userData.lane = i % 3;
      a.userData.offset = i * 23;
      a.userData.speed = 6 + (i % 3) * 2.5;
      this.traffic.add(a);
    }
    this.traffic.visible = false;
    this.scene.add(this.traffic);

    this.input = new InputController(this.container, (a) => this.onInput(a));
    this.applySettings(this.settings);
    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.container);

    const onVis = () => {
      if (document.hidden) {
        this.pauseGame('hidden');
        this.audio.suspend();
      } else if (!this.paused) this.audio.resume();
    };
    const onBlur = () => this.pauseGame('blur');
    const onOrient = () => this.pauseGame('orientation');
    // Closing or navigating away mid-run banks the run's coins and stats.
    const onPageHide = () => {
      if (this.mode === 'game' && this.sim && this.sim.state !== 'GAME_OVER' && !this.gameOverSent) this.finishRun(this.sim.quit(), false);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('orientationchange', onOrient);
    const onLost = (e: Event) => {
      e.preventDefault();
      this.pauseGame('context');
      this.emit({ type: 'error', message: 'The graphics context was lost (the device may be low on memory). Reload to continue — your saved progress is safe.' });
    };
    canvas.addEventListener('webglcontextlost', onLost);
    this.disposers.push(
      () => document.removeEventListener('visibilitychange', onVis),
      () => window.removeEventListener('blur', onBlur),
      () => window.removeEventListener('orientationchange', onOrient),
      () => window.removeEventListener('pagehide', onPageHide),
      () => canvas.removeEventListener('webglcontextlost', onLost),
    );
    this.showShowcase(this.save.data.selectedCharacter);
    this.startLoop();
  }

  on(fn: (e: UiEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: UiEvent): void {
    // Satire flashes wait for a quiet moment so they never pile on top of
    // gameplay messages.
    if (e.type === 'toast' || e.type === 'caption' || e.type === 'factCard') this.newsT = Math.max(this.newsT, 9);
    this.listeners.forEach((l) => l(e));
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.audio.setMusic(s.music);
    this.audio.setSfx(s.sfx);
    this.cam.reducedMotion = s.reducedMotion;
    this.fx.budget = s.reducedMotion ? 0.5 : 1;
    if (this.renderer) {
      const dpr = window.devicePixelRatio || 1;
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
      this.pixelRatio = s.quality === 'low' ? 1 : s.quality === 'high' ? Math.min(dpr, 2) : Math.min(dpr, mobile ? 1.5 : 2);
      this.world.lowQuality = s.quality === 'low';
      this.resize();
    }
    if (!s.debugColliders) {
      this.colliders.forEach((c) => c.removeFromParent());
      this.colliders.clear();
    }
  }

  private resize(): void {
    if (!this.renderer) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.cam.setAspect(w / h);
    this.fx.setScale(h * this.pixelRatio, this.cam.camera.fov);
  }

  private startLoop(): void {
    if (this.raf) return; // exactly one loop, ever
    this.lastT = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - this.lastT) / 1000));
      this.lastT = now;
      if (this.paused || this.manual) return;
      try {
        this.tick(dt);
        this.renderer.render(this.scene, this.cam.camera);
      } catch (err) {
        console.error(err);
        this.pauseGame('error');
        this.emit({ type: 'error', message: 'Something went wrong while running the game. You can restart the run; your progress is saved.' });
      }
      this.trackPerformance(dt);
    };
    this.raf = requestAnimationFrame(frame);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.input?.dispose();
    this.audio.dispose();
    this.resizeObs?.disconnect();
    this.disposers.forEach((d) => d());
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  // --------------------------------------------------------------- modes

  private setPlayer(id: CharacterId): CharacterRig {
    const eq = this.save.data.equipped[id];
    const key = `${id}|${eq.outfit}|${eq.runStyle}`;
    if (this.player && this.playerKey === key) return this.player;
    if (this.player) disposeRig(this.player);
    const runStyle = eq.runStyle === 'run.power' ? 'power' : eq.runStyle === 'run.strut' ? 'strut' : 'classic';
    this.player = buildCharacter(id, { outfit: eq.outfit, runStyle });
    this.playerKey = key;
    this.scene.add(this.player.root);
    return this.player;
  }

  private clearRunViews(): void {
    for (const v of this.obstacleViews.values()) this.pool.release(v);
    this.obstacleViews.clear();
    for (const g of this.gantries.values()) this.pool.releaseGantry(g);
    this.gantries.clear();
    for (const k of this.knocked.values()) this.pool.release(k.view);
    this.knocked.clear();
    this.colliders.forEach((c) => c.removeFromParent());
    this.colliders.clear();
    this.fluttered.clear();
    this.pickups.clear();
    this.fx.clear();
    this.rival.reset();
    this.encounters.reset();
    this.captions = [];
    this.celebrateT = 0;
    this.overT = 0;
    this.newsT = 18;
    this.ribbonRaceShown = false;
    this.pendingResult = null;
    this.audio.engine(false);
  }

  /** Menu background: the selected character idling on the street. */
  showShowcase(id: CharacterId): void {
    this.endRun();
    this.mode = 'showcase';
    this.debate.group.visible = false;
    const p = this.setPlayer(id);
    p.root.visible = true;
    p.root.position.set(0, 0, 0);
    p.root.rotation.set(0, Math.PI, 0);
    p.setAnim('idle', true);
    this.world.setTheme(this.save.data.startRoute, true);
    this.world.resetBlocks();
    this.input.enabled = false;
    this.setTrack('menu');
  }

  /** Title background after the intro: the runner jogging down the road. */
  showAttract(): void {
    this.endRun();
    this.mode = 'attract';
    const p = this.setPlayer(this.save.data.selectedCharacter);
    p.root.rotation.set(0, 0, 0);
    p.setAnim('run');
    this.input.enabled = false;
    this.setTrack('menu');
  }

  playIntro(): void {
    this.endRun();
    this.mode = 'intro';
    this.introT = 0;
    this.menuD = 0;
    const p = this.setPlayer('yogi');
    p.root.position.set(0, 0, 0);
    p.setAnim('idle', true);
    this.world.setTheme('lawandorder', true);
    const shot = introShot(0);
    this.cam.targetPos.copy(shot.pos);
    this.cam.targetLook.copy(shot.look);
    this.cam.snap();
    this.input.enabled = true; // Enter / tap skips
    this.setTrack('menu');
  }

  skipIntro(): void {
    if (this.mode !== 'intro') return;
    this.traffic.visible = false;
    this.input.enabled = false;
    this.showAttract();
    this.emit({ type: 'introDone' });
  }

  startRun(opts: StartOptions, flourish = false): void {
    this.audio.unlock();
    this.flourish = flourish && !this.settings.shortCinematics ? Engine.FLOURISH : 0;
    this.save.refreshDay();
    this.clearRunViews();
    this.debate.group.visible = false;
    const d = this.save.data;
    const level = opts.mode === 'campaign' ? levelById(opts.level ?? 'expressway') : undefined;
    // Rivalry Mode always puts the player in the rival's shoes.
    const character: CharacterId = opts.mode === 'rivalry' ? 'akhilesh' : opts.character;
    this.lastOpts = { ...opts, character };
    const rival = CHARACTERS[character].rival;
    const vehicle = CHARACTERS[rival].vehicle;
    // Levels are fixed courses (learnable for 3 stars); other modes vary.
    const seed = level ? hashString('level:' + level.id) : (Math.random() * 2 ** 31) >>> 0;
    const startTheme: ThemeId = level ? level.id : opts.mode === 'rivalry' ? 'lawandorder' : d.startRoute;
    this.sim = new Simulation({
      mode: opts.mode,
      character,
      rival,
      seed,
      startTheme,
      shortCinematics: d.settings.shortCinematics,
      missions: activeMissions(d),
      discovered: d.discovered,
      tutorial: !d.flags.tutorialDone,
      level: level ? { id: level.id, length: level.length, tokenGoal: level.tokenGoal, token: level.token, diff: level.diff, events: level.events } : undefined,
      race: opts.mode === 'race' ? { length: RACE_LENGTH, rivalPace: RACE_PACE } : undefined,
      perks: perksFor(d),
      quizPool: opts.mode === 'free' ? QUIZ.map((q) => ({ id: q.id, answer: q.answer })) : undefined,
      quizAnswers: Object.fromEntries(QUIZ.map((q) => [q.id, q.answer])),
    });
    this.autopilot = this.debugAutopilot ? new Autopilot() : null;
    const rivalOutfit = CHARACTERS[rival].outfits[0].id;
    this.rival.configure(rival, vehicle, rivalOutfit);
    this.encounters.configure(rival, rivalOutfit);
    const p = this.setPlayer(character);
    p.root.visible = true;
    p.root.rotation.set(0, 0, 0);
    p.root.position.set(LANE_X[1], 0, 0);
    p.setAnim('run', true);
    if (this.flourish > 0) {
      // Each character's own introductory gesture before the first step.
      p.root.rotation.y = Math.PI;
      p.setAnim(character === 'yogi' ? 'entrance' : 'idle', true);
      if (character === 'akhilesh') p.animT = 2.95; // lands on the cap adjust
    }
    this.world.setTheme(this.sim.theme, true);
    this.world.resetBlocks();
    this.mode = 'game';
    this.paused = false;
    this.gameOverSent = false;
    this.input.enabled = true;
    this.cameraForRun(true);
    if (this.flourish > 0) {
      // Facing the runner (who faces the camera), looking down the road.
      this.cam.targetPos.set(-1.1, 1.8, 4.3);
      this.cam.targetLook.set(0, 1.3, 0);
    }
    this.cam.snap();
    this.setTrack(this.sim.theme);
    this.emit({ type: 'paused', paused: false });
    this.emit({ type: 'clearCaptions' });
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (level) this.caption(`LEVEL ${level.num}: ${level.name.toUpperCase()}`, level.mission, 'info', 2000, 0);
    else if (opts.mode === 'rivalry') this.caption('RIVALRY MODE', 'You play the rival. A Political Challenge is ahead — escape the Governance Showdown to clear each stage.', 'info', 2200, 0);
    else if (opts.mode === 'race') this.caption('DEVELOPMENT RACE', 'Race for roads, jobs and better public services! Every development token = +3 m.', 'info', 2200, 0);
    this.lastT = performance.now();
    this.pushHud(true);
  }

  restart(): void {
    if (this.lastOpts) this.startRun(this.lastOpts);
  }

  /** Leave the current run (from pause or results) back to the menu scene. */
  quitToMenu(): void {
    if (this.sim && this.sim.state !== 'GAME_OVER' && !this.gameOverSent) {
      // Quitting still banks coins and stats, but never as a crash.
      const summary = this.sim.quit();
      this.finishRun(summary, false);
    }
    this.paused = false;
    this.showShowcase(this.save.data.selectedCharacter);
    this.emit({ type: 'paused', paused: false });
  }

  /** Debate Arena: the hero and the rival on stage (dialogue is in the UI). */
  showDebate(): void {
    this.endRun();
    this.mode = 'debate';
    const d = this.save.data;
    const hero: CharacterId = d.selectedCharacter === 'akhilesh' ? 'yogi' : d.selectedCharacter;
    this.debate.configure(hero, d.equipped[hero].outfit, 'akhilesh', d.equipped.akhilesh.outfit);
    this.debate.group.visible = true;
    if (this.player) this.player.root.visible = false;
    this.world.setTheme('lawandorder', true);
    this.world.resetBlocks();
    this.input.enabled = false;
    this.cam.snap();
    this.setTrack('debate');
  }

  debateSpeaker(who: Speaker): void {
    this.debate.speaker = who;
  }

  debateResult(winner: 'hero' | 'rival'): void {
    this.debate.speaker = null;
    this.debate.result = winner;
    if (winner === 'hero') {
      this.audio.play('fanfare');
      this.fx.confetti({ x: -2.4, y: 3.5, z: 0.5 }, [0xff8c1a, 0xffffff, 0x1f8a4c, 0xffd23a], 60, false);
    } else this.audio.play('wrong');
  }

  private endRun(): void {
    this.clearRunViews();
    this.sim = null;
    this.hud.set({ ...this.hud.get(), active: false, state: 'NONE', chase: null, power: null });
    this.playerShadow.visible = false;
  }

  pauseGame(reason = 'user'): void {
    if (this.mode !== 'game' || this.paused || !this.sim || this.sim.state === 'GAME_OVER') return;
    this.paused = true;
    this.audio.suspend();
    this.emit({ type: 'paused', paused: true, reason });
  }

  resumeGame(): void {
    if (!this.paused) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.paused = false;
    this.lastT = performance.now();
    this.audio.unlock();
    this.audio.resume();
    this.emit({ type: 'paused', paused: false });
  }

  skipCinematic(): void {
    this.sim?.skipCinematic();
  }

  /** On-screen touch buttons. */
  press(a: 'left' | 'right' | 'jump' | 'slide'): void {
    this.onInput(a);
  }

  setShowcaseCharacter(id: CharacterId): void {
    if (this.mode === 'showcase') this.showShowcase(id);
  }

  private onInput(a: InputAction): void {
    if (this.mode === 'intro') {
      if (a === 'tap' || a === 'pause') this.skipIntro();
      return;
    }
    if (this.mode !== 'game' || !this.sim) return;
    if (a === 'pause') {
      if (this.paused) this.resumeGame();
      else this.pauseGame('user');
      return;
    }
    if (this.paused) return;
    this.audio.unlock();
    if (this.flourish > 0) this.flourish = 0;
    if (a === 'tap') {
      if (this.sim.state === 'CINEMATIC') this.sim.input('skip');
      return;
    }
    this.sim.input(a as Action);
  }

  // ----------------------------------------------------------------- tick

  private tick(dt: number): void {
    this.time += dt;
    switch (this.mode) {
      case 'intro':
        this.tickIntro(dt);
        break;
      case 'attract':
      case 'showcase':
        this.tickMenu(dt);
        break;
      case 'game':
        this.tickGame(dt);
        break;
      case 'debate':
        this.tickDebate(dt);
        break;
    }
    this.cam.update(dt);
  }

  private tickIntro(dt: number): void {
    this.introT += dt;
    const s = introShot(this.introT);
    const p = this.player!;
    this.menuD += s.speed * dt;
    p.root.rotation.y = s.runnerYaw;
    p.root.position.set(0, 0, 0);
    if (s.runner === 'idle') {
      if (p.anim !== 'idle') p.setAnim('idle', true);
      if (this.introT > 4.2 && this.introT < 4.25) p.animT = 1.4; // cap adjust lands mid-shot
    } else p.setAnim('run');
    p.update(dt, Math.max(8, s.speed));
    this.cam.stiffness = this.introT < 4.2 ? 20 : 5;
    this.cam.targetPos.copy(s.pos);
    this.cam.targetLook.copy(s.look);
    this.world.update(dt, this.menuD, this.cam.camera, () => 'lawandorder', () => (this.menuD < 60 ? 'posterAlley' : null), false);
    this.traffic.visible = this.introT < 6.8;
    for (const a of this.traffic.children) {
      const u = a.userData as { lane: number; offset: number; speed: number };
      a.position.set(LANE_X[u.lane] * 1.0, 0, -12 - ((this.introT * u.speed + u.offset) % 140));
    }
    // The aerial establishing shot needs to see the whole city through the haze.
    this.world.fog.far = this.introT < 4.2 ? 420 : Math.min(this.world.fog.far + dt * 200, 200);
    this.updateShadow(p.root.position.x, 0, 0);
    this.fx.update(dt, s.speed * dt);
    if (this.introT >= INTRO_LENGTH) this.skipIntro();
  }

  private tickMenu(dt: number): void {
    const p = this.player!;
    if (this.mode === 'attract') {
      this.menuD += dt * 11;
      p.root.position.set(0, 0, 0);
      p.update(dt, 11);
      this.cam.stiffness = 3;
      this.cam.targetPos.set(Math.sin(this.time * 0.25) * 2.5, 3.3, 6.8);
      this.cam.targetLook.set(0, 1.4, -6);
    } else {
      p.update(dt, 0);
      const a = Math.sin(this.time * 0.22) * 0.45;
      const portrait = this.cam.portrait;
      this.cam.stiffness = 3;
      if (portrait) {
        // Menus cover the lower half on phones: frame the character high.
        this.cam.targetPos.set(Math.sin(a) * 6.4, 1.75, Math.cos(a) * 6.4);
        this.cam.targetLook.set(0, -1.6, 0);
      } else {
        this.cam.targetPos.set(Math.sin(a) * 4.6 + 1.1, 1.75, Math.cos(a) * 4.6);
        this.cam.targetLook.set(1.1, 1.15, 0);
      }
    }
    const route = this.save.data.startRoute;
    this.world.update(dt, this.menuD, this.cam.camera, () => route, () => null, false);
    this.updateShadow(0, 0, 0);
    this.fx.update(dt, this.mode === 'attract' ? dt * 11 : 0);
  }

  private tickDebate(dt: number): void {
    this.debate.update(dt, this.time);
    const portrait = this.cam.portrait;
    this.cam.stiffness = 3;
    const sway = Math.sin(this.time * 0.3) * 0.6;
    this.cam.targetPos.set(sway, 3.5 + (portrait ? 1.6 : 0), 11 + (portrait ? 7 : 0));
    this.cam.targetLook.set(0, portrait ? 0.4 : 1.4, 0);
    this.cam.fovBoost = 0;
    this.world.update(dt, 0, this.cam.camera, () => 'lawandorder', () => null, false);
    this.playerShadow.visible = false;
    this.fx.update(dt, 0);
  }

  private tickGame(dt: number): void {
    const sim = this.sim;
    if (!sim) return;
    if (this.flourish > 0) {
      this.flourish = Math.max(0, this.flourish - dt);
      const p = this.player!;
      const turn = Math.min(1, Math.max(0, (0.45 - this.flourish) / 0.45));
      p.root.rotation.y = Math.PI * (1 - turn);
      if (turn > 0) p.setAnim('run');
      p.update(dt, 4 + turn * 9);
      this.world.update(dt, sim.d, this.cam.camera, (s) => sim.themeAtS(s), (s) => sim.eventAt(s), false);
      this.encounters.update(dt, sim, this.time, this.fx);
      this.syncObstacles(dt, sim);
      this.pickups.sync(sim.pickups, sim.d, this.time);
      this.updateShadow(p.root.position.x, 0, 0);
      this.cam.stiffness = 3;
      if (turn > 0) this.cameraForRun(false);
      if (this.flourish === 0) {
        p.root.rotation.y = 0;
        this.caption('GO!', undefined, 'go', 700, 0);
      }
      this.fx.update(dt, 0);
      return;
    }
    if (this.autopilot) for (const a of this.autopilot.decide(sim)) sim.input(a);
    if (sim.state === 'GAME_OVER') this.overT += dt;
    const prevD = sim.d;
    sim.advance(dt);
    const dz = sim.d - prevD;
    for (const e of sim.events) this.handle(e, sim);
    sim.events.length = 0;
    this.runCaptions(sim);

    this.updatePlayer(dt, sim);
    this.world.update(dt, sim.d, this.cam.camera, (s) => sim.themeAtS(s), (s) => sim.eventAt(s), sim.vikasT > 0);
    this.encounters.update(dt, sim, this.time, this.fx);
    this.syncObstacles(dt, sim);
    this.pickups.sync(sim.pickups, sim.d, this.time);
    const shot = this.rival.update(dt, sim, this.cam.camera, this.fx, this.time);
    if (shot) {
      this.cam.stiffness = 3.2;
      this.cam.targetPos.copy(shot.pos);
      this.cam.targetLook.copy(shot.look);
      this.cam.fovBoost = 0;
    } else this.cameraForRun(false);
    this.fx.update(dt, dz);
    this.coinSfxT -= dt;

    this.tickComedy(dt, sim);

    if (this.celebrateT > 0) {
      this.celebrateT -= dt;
      if (Math.random() < dt * 3) this.fx.fireworks({ x: (Math.random() - 0.5) * 8, y: 5 + Math.random() * 2, z: -6 - Math.random() * 4 });
      if (this.celebrateT <= 0 && this.pendingResult) {
        this.emit({ type: 'gameOver', ...this.pendingResult });
        this.pendingResult = null;
      }
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.pushHud(false);
    }
  }

  /** Satire flashes and the Ribbon Race beat (presentation only). */
  private tickComedy(dt: number, sim: Simulation): void {
    const lv = sim.cfg.level;
    if (lv && !this.ribbonRaceShown && sim.state === 'RUNNING' && lv.length - sim.d < RIBBON_RACE) {
      this.ribbonRaceShown = true;
      this.audio.play('warn');
      this.caption('RIBBON RACE!', `${CHARACTERS[sim.cfg.rival].shortName} (caricature) brought giant scissors to cut YOUR ribbon. Get there first!`, 'challenge', 2000, 0);
    }
    if (sim.state !== 'RUNNING') return;
    this.newsT -= dt;
    if (this.newsT <= 0) {
      this.emit({ type: 'toast', text: pick(NEWS_HEADLINES), sub: 'UP RUN NEWS • satire, not real news', tone: 'news' });
      this.newsT = 24 + Math.random() * 10;
    }
  }

  private rivalSays(line: string): void {
    this.emit({ type: 'toast', text: `“${line}”`, sub: `${CHARACTERS[this.sim?.cfg.rival ?? 'akhilesh'].shortName} (caricature) • fictional line`, tone: 'rival' });
  }

  private heroSays(): void {
    const id = this.sim?.cfg.character ?? 'yogi';
    this.emit({ type: 'toast', text: `“${pick(HERO_LINES)}”`, sub: `${CHARACTERS[id].shortName} • game slogan`, tone: 'hero' });
  }

  private pushHud(force: boolean): void {
    const sim = this.sim;
    if (!sim) return;
    const power =
      sim.bulldozerT > 0
        ? { kind: 'bulldozer' as const, t: sim.bulldozerT, total: sim.bulldozerTotal }
        : sim.vikasT > 0
          ? { kind: 'vikas' as const, t: sim.vikasT, total: 5 }
          : sim.speedRunT > 0
            ? { kind: 'speedRun' as const, t: sim.speedRunT, total: 8 }
            : sim.magnetT > 0
              ? { kind: 'magnet' as const, t: sim.magnetT, total: 8 }
              : null;
    const ldef = sim.cfg.level ? levelById(sim.cfg.level.id) : undefined;
    const r2 = (x: number) => Math.round(x * 200) / 200;
    let quiz: HudSnapshotQuiz = null;
    for (const e of sim.encounters) {
      if (e.kind !== 'quiz' || !e.announced || !e.quizId || (e.ended && sim.d - e.s0 > 25)) continue;
      const q = quizById(e.quizId);
      if (!q) continue;
      quiz = { id: q.id, q: q.q, options: q.options, metres: Math.max(0, Math.round(e.s0 - sim.d)), chosen: e.ended ? (e.chosen ?? null) : null, correct: e.ended ? !!e.correct : null };
      break;
    }
    const enc = sim.encounters.find((e) => (e.kind === 'redCap' || e.kind === 'promises') && e.started && !e.ended);
    const snap = {
      active: true,
      score: sim.score.total,
      distance: Math.floor(sim.d),
      coins: sim.coins,
      meter: Math.round(sim.meter),
      guardReady: sim.guardReady,
      guardT: sim.guardT,
      state: sim.state,
      chase:
        sim.state === 'CHASE'
          ? {
              remaining: Math.max(0, Math.round(sim.chase.remaining * 10) / 10),
              total: sim.chase.total,
              escapes: sim.chase.escapes,
              kind: sim.chaseKind,
              stage: sim.isRivalry ? sim.stats.stage : 0,
            }
          : null,
      power: power ? { ...power, t: Math.round(power.t * 10) / 10 } : null,
      level: ldef ? { id: ldef.id, num: ldef.num, name: ldef.name, progress: r2(sim.progress), tokens: sim.stats.devTokens, goal: ldef.tokenGoal, token: ldef.token } : null,
      race: sim.cfg.race ? { progress: r2(sim.progress), rival: r2(sim.rivalProgress) } : null,
      quiz,
      encounter: enc ? { kind: enc.kind, got: enc.got, total: enc.total, failed: enc.failed, metres: Math.max(0, Math.round(enc.s1 - sim.d)) } : null,
      devTokens: sim.stats.devTokens,
      stage: sim.stats.stage,
      mode: sim.cfg.mode,
      character: sim.cfg.character,
      rival: sim.cfg.rival,
      theme: sim.theme,
      skippable: sim.state === 'CINEMATIC',
      multiplier: sim.speedRunT > 0 ? 2 : 1,
    };
    if (force) this.hud.set({ ...this.hud.get(), state: 'NONE' });
    this.hud.set(snap);
  }

  private cameraForRun(snap: boolean): void {
    const sim = this.sim;
    if (!sim) return;
    const p = sim.player;
    const portrait = this.cam.portrait;
    const st = sim.state;
    const chaseView = st === 'CHASE' || (st === 'SUCCESS' && sim.stateTime < 1.0) || st === 'CINEMATIC';
    this.cam.stiffness = snap ? 100 : st === 'STUMBLE' ? 8 : 5.5;
    let boost = 0;
    if (st === 'STUMBLE') {
      this.cam.targetPos.set(p.x * 0.6, 2.7, 5.0 + (portrait ? 1.2 : 0));
      this.cam.targetLook.set(p.x, 1.1, -3);
    } else if (st === 'GAME_OVER' && (sim.summary?.completed || sim.summary?.reason === 'raceLost')) {
      // Victory (or race-over) beat: in front of the runner, who turns to the camera.
      this.cam.stiffness = 2.5;
      this.cam.targetPos.set(p.x + 1.6, 2.3 + (portrait ? 0.8 : 0), -4.6 - (portrait ? 1.5 : 0));
      this.cam.targetLook.set(p.x, 1.2, 0);
    } else if (st === 'FAILURE' || st === 'GAME_OVER') {
      // High three-quarter view from the side the road is open on: always
      // above walls (max 3.1 m) and outside the crashed-into lane.
      const side = p.lane === 2 ? -1 : 1;
      const k = Math.min(1, sim.stateTime * 0.25);
      this.cam.stiffness = 2.2;
      this.cam.targetPos.set(p.x + side * (3.6 + k), 4.6 + (portrait ? 1.2 : 0), -2.4 - k * 0.8);
      this.cam.targetLook.set(p.x, 0.6, 0.3);
    } else if (chaseView) {
      // Pulled back and shifted towards the shoulder so runner and chaser
      // share the frame (the chaser stays on its own lane behind the runner).
      const cx = portrait ? p.x * 0.3 + 2.1 : p.x * 0.4 + 1.6;
      this.cam.targetPos.set(cx, 6.2 + (portrait ? 1.0 : 0), 13.2 + (portrait ? 2.0 : 0));
      this.cam.targetLook.set(cx - 0.3, 1.0, -4);
      boost = 4;
    } else {
      this.cam.targetPos.set(p.x * 0.55, 3.9 + p.y * 0.3 + (portrait ? 0.9 : 0), 7.2 + (portrait ? 1.8 : 0));
      this.cam.targetLook.set(p.x * 0.7, 1.25 + p.y * 0.2, -8);
    }
    if (sim.vikasT > 0) boost = 12;
    else if (sim.speedRunT > 0) boost = Math.max(boost, 8);
    this.cam.fovBoost += (boost - this.cam.fovBoost) * 0.08;
  }

  private updateShadow(x: number, ground: number, height: number): void {
    this.playerShadow.visible = true;
    const k = Math.max(0.35, 1 - height * 0.3);
    this.playerShadow.position.set(x, ground + 0.03, 0);
    this.playerShadow.scale.setScalar(k);
  }

  private updatePlayer(dt: number, sim: Simulation): void {
    const rig = this.player!;
    const p = sim.player;
    rig.root.position.set(p.x, p.y, 0);
    const lean = (LANE_X[p.lane] - p.x) * -0.09;
    rig.root.rotation.set(0, 0, lean + (p.bumpT > 0 ? Math.sin(p.bumpT * 40) * 0.12 : 0));
    const st = sim.state;
    if (st === 'STUMBLE') rig.setAnim('stumble');
    else if (st === 'GAME_OVER' && (sim.summary?.completed || sim.summary?.reason === 'raceLost')) {
      rig.setAnim(sim.summary.completed ? 'victory' : 'idle');
      rig.root.rotation.y = Math.min(Math.PI, this.overT * 5);
    } else if (st === 'FAILURE' || st === 'GAME_OVER') {
      const gap = sim.crashedInto?.cls === 'gap';
      if (gap) {
        rig.root.position.y = Math.max(-0.75, -sim.stateTime * 3);
        rig.setAnim(sim.stateTime < 1.0 ? 'fall' : 'sad');
      } else rig.setAnim(sim.stateTime < 0.55 && st === 'FAILURE' ? 'stumble' : 'sad');
      rig.root.rotation.y = Math.PI * 0.85;
    } else if (st === 'CINEMATIC') rig.setAnim(sim.stateTime < 0.4 ? 'stumble' : 'idle');
    else if (st === 'SUCCESS' && sim.stateTime < 0.9 && p.grounded && !p.sliding) rig.setAnim('victory');
    else if (!p.grounded) rig.setAnim('jump');
    else if (p.sliding) rig.setAnim('slide');
    else rig.setAnim('run');
    const animSpeed = st === 'STUMBLE' ? sim.speed * 0.3 : sim.speed;
    rig.update(st === 'STUMBLE' ? dt * 0.6 : dt, animSpeed);

    // Ground height under the runner (low obstacle tops) for the shadow.
    const ground = p.grounded ? p.y : 0;
    this.updateShadow(p.x, ground, p.y - ground);

    const trail = this.save.data.equipped[sim.cfg.character].trail;
    if (trail !== 'trail.none' && (st === 'RUNNING' || st === 'CHASE' || st === 'EVENT_PENDING' || st === 'SUCCESS')) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.05;
        this.fx.trail({ x: p.x, y: p.y + 0.4, z: 0.4 }, trail);
      }
    }
    if (sim.vikasT > 0 && Math.random() < 0.5) {
      this.fx.emit({ at: { x: p.x + (Math.random() - 0.5) * 6, y: 0.5 + Math.random() * 3, z: -20 }, count: 1, colors: [0x00e5d0, 0xffffff], tile: 0, speed: 0.1, life: [0.4, 0.6], size: [0.15, 0.3], alpha: 0.8 });
    }
  }

  private syncObstacles(dt: number, sim: Simulation): void {
    const seen = new Set<number>();
    const d = sim.d;
    for (const ob of sim.obstacles) {
      if (this.knocked.has(ob.id)) continue;
      const z = -(ob.s - d);
      if (z < -178 || z > 26 + ob.depth) continue;
      seen.add(ob.id);
      let v = this.obstacleViews.get(ob.id);
      if (!v) {
        v = this.pool.acquire(ob.kind);
        this.scene.add(v.root);
        this.obstacleViews.set(ob.id, v);
      }
      v.root.position.set(LANE_X[ob.lane], 0, z);
      v.tick?.(this.time, z);
      if (ob.gantry) {
        let g = this.gantries.get(ob.id);
        if (!g) {
          g = this.pool.acquireGantry();
          this.scene.add(g);
          this.gantries.set(ob.id, g);
        }
        g.position.set(0, 0, z - ob.depth / 2);
      }
      if (this.settings.debugColliders && !this.colliders.has(ob.id)) {
        const c = debugCollider(ob.kind);
        v.root.add(c);
        this.colliders.set(ob.id, c);
      }
      if ((ob.kind === 'fileMountain' || ob.kind === 'fileStack') && z > -1 && z < 3 && !this.fluttered.has(ob.id)) {
        this.fluttered.add(ob.id);
        this.fx.paper({ x: LANE_X[ob.lane], y: ob.top, z }, 8);
      }
    }
    for (const [id, v] of this.obstacleViews) {
      if (seen.has(id)) continue;
      this.releaseObstacle(id, v);
    }
    // Knocked-away obstacles tumble to the roadside, then return to the pool.
    for (const [id, k] of this.knocked) {
      k.t += dt;
      k.vy -= 18 * dt;
      k.view.root.position.x += k.vx * dt;
      k.view.root.position.y = Math.max(0, k.view.root.position.y + k.vy * dt);
      k.view.root.position.z += sim.speed * dt * (sim.state === 'STUMBLE' ? 0.3 : 1);
      k.view.root.rotation.z += k.spin * dt;
      if (k.t > 1.4) {
        this.pool.release(k.view);
        this.knocked.delete(id);
      }
    }
    if (this.fluttered.size > 200) this.fluttered.clear();
  }

  private releaseObstacle(id: number, v: ObstacleView): void {
    this.pool.release(v);
    this.obstacleViews.delete(id);
    const g = this.gantries.get(id);
    if (g) {
      this.pool.releaseGantry(g);
      this.gantries.delete(id);
    }
    const c = this.colliders.get(id);
    if (c) {
      c.removeFromParent();
      this.colliders.delete(id);
    }
  }

  // --------------------------------------------------------------- events

  private caption(text: string, sub: string | undefined, tone: CaptionTone, ms: number, at: number): void {
    const ev: UiEvent = { type: 'caption', text, sub, tone, ms };
    if (at <= 0) this.emit(ev);
    else this.captions.push({ at, ev, fired: false });
  }

  private runCaptions(sim: Simulation): void {
    if (!this.captions.length) return;
    if (sim.state !== 'CINEMATIC') {
      this.captions = [];
      return;
    }
    for (const c of this.captions) {
      if (!c.fired && sim.stateTime >= c.at) {
        c.fired = true;
        this.emit(c.ev);
      }
    }
  }

  private setTrack(t: Track): void {
    if (t === this.lastTrack) return;
    this.lastTrack = t;
    this.audio.setTrack(t);
  }

  private knock(id: number, vx: number): void {
    const v = this.obstacleViews.get(id);
    if (!v) return;
    this.obstacleViews.delete(id);
    const g = this.gantries.get(id);
    if (g) {
      this.pool.releaseGantry(g);
      this.gantries.delete(id);
    }
    this.knocked.set(id, { view: v, t: 0, vx, vy: 6, spin: 5 });
  }

  private handle(e: SimEvent, sim: Simulation): void {
    const p = sim.player;
    const a = this.audio;
    switch (e.type) {
      case 'coin':
        if (this.coinSfxT <= 0) {
          a.play('coin');
          this.coinSfxT = 0.045;
        }
        this.fx.sparkle({ x: p.x, y: p.y + 1.1, z: -0.4 });
        break;
      case 'pickup': {
        const token = e.kind === 'devToken' || e.kind === 'chaseToken' || e.kind === 'reportCard' || e.kind === 'promise';
        a.play(token ? 'token' : 'powerup');
        if (token) this.fx.sparkle({ x: p.x, y: p.y + 1.2, z: -0.5 }, e.kind === 'devToken' ? 0xff9a1a : 0xffffff);
        else this.fx.confetti({ x: p.x, y: p.y + 1.2, z: -0.5 }, [0xff8c1a, 0xffffff, 0x1f8a4c], 18);
        break;
      }
      case 'jump':
        a.play('jump');
        break;
      case 'slide':
        a.play('slide');
        break;
      case 'lane':
        a.play('lane');
        break;
      case 'land':
        this.fx.dust({ x: p.x, y: p.y + 0.1, z: 0.2 }, 3, 0xd9cbb5);
        break;
      case 'bump':
        a.play('bump');
        this.cam.shake(0.12);
        this.emit({ type: 'comic', text: 'BUMP!' });
        break;
      case 'stumble': {
        a.play('stumble');
        this.cam.shake(0.3);
        this.emit({ type: 'comic', text: e.scripted ? 'WHOA!' : COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)] });
        const v = this.obstacleViews.get(e.obstacleId);
        if (v) this.knock(e.obstacleId, (v.root.position.x >= 0 ? 1 : -1) * 7);
        break;
      }
      case 'recover':
        this.emit({ type: 'toast', text: 'BACK ON TRACK!', sub: 'Stumble guard used — it recharges soon', tone: 'info' });
        break;
      case 'eventPending':
        if (e.challenge) this.caption('POLITICAL CHALLENGE AHEAD!', 'Gundaraj or good governance? The showdown begins!', 'warn', 1600, 0);
        else this.caption('SOMETHING IS COMING…', undefined, 'warn', 1200, 0);
        a.play('warn');
        break;
      case 'cinematicStart': {
        const bulldozer = sim.chaseKind === 'bulldozer';
        const rivalName = CHARACTERS[sim.cfg.rival].name;
        a.engine(true);
        this.setTrack('chase');
        if (e.kind === 'full') {
          a.play('stinger');
          this.caption(bulldozer ? 'THE HERO ARRIVES!' : 'THE RIVAL ARRIVES!', `${rivalName} makes an entrance (satire)`, 'challenge', 1700, 0.05);
          this.caption(
            bulldozer ? 'GOVERNANCE SHOWDOWN!' : 'CYCLE YATRA SHOWDOWN!',
            bulldozer ? 'A stylised bulldozer: a game symbol that only clears unoccupied road debris' : 'A giant campaign cycle: just a race',
            'showdown',
            1500,
            1.8,
          );
          this.caption('ESCAPE!', sim.isRivalry ? 'Dodge everything and grab report cards until the timer runs out' : 'Dodge everything until the timer runs out', 'chase', 1100, 3.3);
          window.setTimeout(() => a.play('horn'), 2600);
        } else {
          a.play('horn');
          this.caption(bulldozer ? 'GOVERNANCE SHOWDOWN!' : 'THE CYCLE IS BACK!', undefined, 'showdown', 1000, 0.05);
          this.caption('ESCAPE!', undefined, 'chase', 800, 1.0);
        }
        break;
      }
      case 'chaseStart':
        this.emit({ type: 'clearCaptions' });
        this.caption('GO!', 'Control is back — escape the showdown', 'go', 900, 0);
        break;
      case 'chaseEnd':
        a.engine(false);
        if (e.success) {
          a.play('success');
          this.caption(sim.isRivalry ? 'STAGE CLEARED!' : 'CHASE SURVIVED!', `+${e.bonus} bonus • road cleared ahead`, 'success', 1800, 0);
          this.fx.confetti({ x: p.x, y: 2.5, z: -3 }, [0xffd23a, 0xff8c1a, 0x1f8a4c, 0xffffff], 70);
          this.setTrack(sim.theme);
        }
        break;
      case 'stageUp':
        this.emit({ type: 'toast', text: `STAGE ${e.stage} UNLOCKED`, sub: 'Faster road, tougher challenges', tone: 'mission' });
        break;
      case 'cleared': {
        let n = 0;
        for (const id of e.ids) {
          const v = this.obstacleViews.get(id);
          if (!v) continue;
          if (n++ < 8 && v.root.position.z > -120) this.fx.poof({ x: v.root.position.x, y: 1, z: v.root.position.z });
          this.releaseObstacle(id, v);
        }
        if (n) a.play('poof');
        break;
      }
      case 'bulldozed': {
        // The helper bulldozer pushes unoccupied debris off the road.
        for (const id of e.ids) {
          const v = this.obstacleViews.get(id);
          if (!v) continue;
          this.fx.dust({ x: v.root.position.x, y: 0.4, z: v.root.position.z }, 6, 0xc9b79a);
          this.knock(id, (v.root.position.x >= this.encounters.helperX ? 1 : -1) * 9);
        }
        if (e.ids.length) a.play('poof');
        break;
      }
      case 'crash':
        a.play('crash');
        a.engine(false);
        this.cam.shake(0.35);
        this.emit({ type: 'comic', text: e.cls === 'gap' ? 'PLOP!' : COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)] });
        this.setTrack('none');
        break;
      case 'gameOver':
        this.finishRun(e.summary, true);
        break;
      case 'mission':
        a.play('mission');
        this.emit({ type: 'toast', text: 'MISSION COMPLETE', sub: `${e.title} • +${e.points} pts, +${e.reward} coins`, tone: 'mission' });
        break;
      case 'theme':
        this.world.setTheme(e.theme);
        if (sim.state === 'RUNNING') this.setTrack(e.theme);
        break;
      case 'discovery':
        a.play('bell');
        this.emit({ type: 'toast', text: `NEW ROUTE: ${THEME_NAMES[e.theme].toUpperCase()}`, sub: `Environment discovered • +${e.points}`, tone: 'discovery' });
        break;
      case 'director':
        this.onDirector(e.kind, e.phase);
        break;
      case 'powerup':
        if (e.phase === 'start') {
          a.play('powerup');
          if (e.kind === 'vikas') this.caption('VIKAS EXPRESS!', 'A fictional flyover opens… for five seconds', 'info', 1400, 0);
          else if (e.kind === 'bulldozer') {
            a.engine(true);
            this.caption('BULLDOZER POWER-UP!', 'It clears unoccupied debris off the road ahead', 'info', 1500, 0);
          } else this.emit({ type: 'toast', text: 'VOTE MAGNET!', sub: 'Coins come to you for 8 s', tone: 'powerup' });
        } else if (e.kind === 'bulldozer' && sim.state !== 'CHASE' && sim.state !== 'CINEMATIC') a.engine(false);
        break;
      case 'token':
        if (e.kind === 'chaseToken') this.emit({ type: 'toast', text: `TIME TOKEN +${e.points}`, sub: 'Showdown extended by 2.5 s (with 2× coins)', tone: 'bonus' });
        else if (e.kind === 'reportCard') this.emit({ type: 'toast', text: `REPORT CARD +${e.points}`, sub: 'Performance noted!', tone: 'bonus' });
        break;
      case 'encounter':
        this.onEncounter(e, sim);
        break;
      case 'levelComplete':
        a.play('fanfare');
        this.caption('RIBBON CUT! LEVEL COMPLETE!', `${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)} • +${e.points}`, 'success', 2000, 0);
        this.heroSays();
        this.rivalSays(pick(RIVAL_LINES.ribbonLate));
        this.fx.confetti({ x: p.x, y: 3, z: -2 }, [0xff8c1a, 0xffffff, 0x1f8a4c, 0xffd23a], 90);
        break;
      case 'raceEnd':
        if (e.won) {
          a.play('fanfare');
          this.caption('DEVELOPMENT RACE WON!', `Ahead by ${Math.max(0, e.margin)} m`, 'success', 2000, 0);
          this.rivalSays(pick(RIVAL_LINES.raceLost));
          this.fx.confetti({ x: p.x, y: 3, z: -2 }, [0xff8c1a, 0xffffff, 0x1f8a4c, 0xffd23a], 90);
        } else {
          a.play('wrong');
          this.caption('THE RIVAL FINISHED FIRST', `Behind by ${Math.max(0, e.margin)} m — collect more tokens for a boost`, 'warn', 2000, 0);
          this.rivalSays(pick(RIVAL_LINES.raceWon));
        }
        break;
      case 'guard':
        if (e.ready && sim.state === 'RUNNING')
          this.emit({ type: 'toast', text: 'STUMBLE GUARD READY', sub: sim.hasChases ? 'Your next bump starts a showdown instead of ending the run' : 'Your next bump only slows you down', tone: 'info' });
        break;
      case 'hint':
        this.emit({ type: 'hint', text: HINTS[e.cls] });
        break;
      case 'state':
        if (e.to === 'RUNNING' && e.from === 'SUCCESS') this.setTrack(sim.theme);
        break;
      default:
        break;
    }
  }

  private onEncounter(e: Extract<SimEvent, { type: 'encounter' }>, sim: Simulation): void {
    const a = this.audio;
    const enc = e.enc;
    if (e.kind === 'quiz') {
      const q = enc.quizId ? quizById(enc.quizId) : undefined;
      if (!q) return;
      if (e.phase === 'announce') {
        a.play('warn');
        this.caption('ACCOUNTABILITY GATE!', 'Run through the lane with the right answer', 'warn', 1500, 0);
        return;
      }
      if (e.phase !== 'end') return;
      const fact = factById(q.factId);
      if (enc.correct) {
        a.play('correct');
        this.emit({ type: 'toast', text: `CORRECT! +${e.points}`, sub: `${LETTERS[q.answer]}) ${q.options[q.answer]}`, tone: 'bonus' });
      } else {
        a.play('wrong');
        this.emit({ type: 'toast', text: 'NOT QUITE', sub: `Answer: ${LETTERS[q.answer]}) ${q.options[q.answer]}`, tone: 'warn' });
      }
      if (fact) this.emit({ type: 'factCard', factId: fact.id, heading: `${FACT_TYPE_LABEL[fact.type]} • ${fact.title}` });
      return;
    }
    if (e.kind === 'redCap') {
      if (e.phase === 'start') {
        a.play('warn');
        this.caption('RED CAP CHALLENGE!', `Outpace ${CHARACTERS[sim.cfg.rival].shortName} to the end of the stretch — no crashes!`, 'challenge', 1600, 0);
      } else if (e.phase === 'end') {
        if (!enc.failed) {
          a.play('success');
          this.emit({ type: 'toast', text: `CHALLENGE WON +${e.points}`, sub: 'Har challenge ka jawab — performance!', tone: 'bonus' });
          this.rivalSays(pick(RIVAL_LINES.challengeLost));
        } else {
          this.emit({ type: 'toast', text: 'CHALLENGE LOST', sub: 'A stumble cost you the Red Cap Challenge', tone: 'warn' });
          this.rivalSays(pick(RIVAL_LINES.challengeWon));
        }
      }
      return;
    }
    if (e.kind === 'promises') {
      if (e.phase === 'start') {
        a.play('warn');
        this.caption('PROMISES VS PERFORMANCE!', 'Deliver at least 60% of the promise scrolls', 'challenge', 1600, 0);
      } else if (e.phase === 'end') {
        if (!enc.failed) {
          a.play('success');
          this.emit({ type: 'toast', text: `PROMISES DELIVERED +${e.points}`, sub: `${enc.got}/${enc.total} delivered`, tone: 'bonus' });
        } else this.emit({ type: 'toast', text: 'PROMISES UNDELIVERED', sub: `${enc.got}/${enc.total} — promises are easy, delivery is the challenge!`, tone: 'warn' });
      }
    }
  }

  private onDirector(kind: string, phase: 'warn' | 'start' | 'end'): void {
    const a = this.audio;
    if (kind === 'speedRun') {
      if (phase === 'warn') {
        a.play('warn');
        this.caption('SPEED RUN INCOMING!', 'Faster for 8 s • 2× distance points', 'warn', 1500, 0);
      } else if (phase === 'start') this.caption('SPEED RUN!', '2× points', 'info', 900, 0);
      else this.emit({ type: 'toast', text: 'SPEED RUN OVER', tone: 'info' });
    } else if (kind === 'coinRush' && phase === 'start') {
      a.play('powerup');
      this.caption('COIN RUSH!', 'Grab what you can', 'info', 1100, 0);
    } else if (kind === 'posterAlley' && phase === 'start') {
      this.emit({ type: 'toast', text: 'POSTER ALLEY', sub: 'Fictional campaign posters ahead — purely decorative', tone: 'info' });
    } else if (kind === 'developmentRoute' && phase === 'start') {
      this.emit({
        type: 'infoCard',
        title: 'GAME SCENARIO (FICTIONAL): DEVELOPMENT ROUTE',
        body: 'A made-up "Vikas Path" is under construction in this made-up city. Expect cones, barriers and extra coins. Fictional — not a claim about any real project.',
      });
    }
  }

  private finishRun(summary: RunSummary, show: boolean): void {
    if (this.gameOverSent || !this.sim) return;
    this.gameOverSent = true;
    const progress: Record<string, number> = {};
    for (const m of this.sim.missions) progress[m.def.id] = this.sim.missionProgress(m);
    let info!: RunResultInfo;
    this.save.update((d) => {
      info = applyRun(d, summary, progress);
    });
    this.input.enabled = false;
    this.audio.engine(false);
    if (!show) return;
    // A short victory beat before the reward screen.
    if (summary.level?.completed || summary.race) {
      this.pendingResult = { summary, info };
      this.celebrateT = CELEBRATION;
    } else this.emit({ type: 'gameOver', summary, info });
  }

  // ----------------------------------------------------------- performance

  private trackPerformance(dt: number): void {
    if (this.settings.quality !== 'auto' || this.mode !== 'game') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 180) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 1 / 40 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.fx.budget = 0.5;
      this.world.lowQuality = true;
      this.resize();
    }
  }

  // ----------------------------------------------------------- debugging

  /** Small introspection API used by the browser tests (window.__UPRUN__). */
  debugInfo(): Record<string, unknown> {
    const info = this.renderer?.info;
    return {
      mode: this.mode,
      paused: this.paused,
      state: this.sim?.state ?? null,
      stateTime: this.sim ? Math.round(this.sim.stateTime * 100) / 100 : 0,
      cinematic: this.sim?.cinematic.kind ?? null,
      d: this.sim ? Math.floor(this.sim.d) : 0,
      score: this.sim?.score.total ?? 0,
      coins: this.sim?.coins ?? 0,
      obstacles: this.sim?.obstacles.length ?? 0,
      pickups: this.sim?.pickups.length ?? 0,
      obstacleViews: this.obstacleViews.size,
      poolCreated: this.pool.created,
      particles: this.fx.count,
      geometries: info?.memory.geometries ?? 0,
      textures: info?.memory.textures ?? 0,
      calls: info?.render.calls ?? 0,
      chaseCount: this.sim?.chase.count ?? 0,
      chasesSurvived: this.sim?.stats.chasesSurvived ?? 0,
      pixelRatio: this.pixelRatio,
      heapMB: Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1048576),
    };
  }

  /** Deterministically advance the game (tests/screenshots only). */
  stepManual(seconds: number, dt = 1 / 30): void {
    this.manual = true;
    for (let t = 0; t < seconds - 1e-6; t += dt) this.tick(dt);
    this.renderer.render(this.scene, this.cam.camera);
  }

  setAutopilot(on: boolean): void {
    this.debugAutopilot = on;
    this.autopilot = on ? new Autopilot() : null;
  }

  get themeName(): string {
    return this.sim ? THEME_NAMES[this.sim.theme] : THEME_NAMES[this.save.data.startRoute];
  }
}
