import {
  ACCEL,
  CHASE_DODGE_REWARD,
  CHASE_FULL,
  CHASE_OPENING_CLEAR,
  CHASE_SHORT,
  CHASE_TOKEN_TIME,
  CINEMATIC_FULL,
  CINEMATIC_SHORT,
  DESPAWN_BEHIND,
  CHALLENGE_WARNING,
  EVENT_PENDING_MAX,
  FAILURE_TIME,
  GEN_SPEED_MARGIN,
  GUARD_RECHARGE,
  INPUT_BUFFER_TIME,
  LANE_X,
  MAGNET_TIME,
  MAX_FRAME_DT,
  PLAYER_HALF_D,
  PLAYER_HALF_W,
  SIM_DT,
  SPAWN_AHEAD_MIN,
  SPAWN_AHEAD_TIME,
  SPEED_FACTOR,
  SPEED_RUN_TIME,
  SPEED_RUN_WARNING,
  STUMBLE_TIME,
  STUMBLE_TIMESCALE,
  SUCCESS_TIME,
  VIKAS_TIME,
} from './constants';
import { contactFor, isOverhead, supportFrom, type RunnerBox } from './collision';
import { buildChunk, placeCoins, type ChunkKind, type GenContext, type PickupSpec } from './generator';
import { missionValue, type ActiveMission, type MissionStat } from './missions';
import { DEBRIS_KINDS, OBSTACLES } from './obstacles';
import { Player } from './player';
import { Rng } from './rng';
import { ScoreKeeper, type ScoreBreakdown } from './scoring';
import { baseSpeedAt, difficultyAt, levelSpeed } from './speed';
import { THEME_TOKEN, themeAt, themeIndexAt } from './themes';
import {
  THEME_ORDER,
  type Action,
  type CharacterId,
  type DirectorEventKind,
  type Encounter,
  type EncounterKind,
  type ModeId,
  type Obstacle,
  type ObstacleClass,
  type ObstacleKind,
  type Pickup,
  type PickupKind,
  type PlannedEvent,
  type Row,
  type SimState,
  type ThemeId,
  type TokenVariant,
} from './types';

export interface LevelRuntime {
  id: string;
  length: number;
  tokenGoal: number;
  token: TokenVariant;
  diff: number;
  events: { kind: EncounterKind; at: number; len?: number; quiz?: string }[];
}

export interface Perks {
  /** Connectivity Boost: power-ups last 25% longer. */
  powerupBoost?: boolean;
  /** Governance Shield: stumble guard recharges 30% faster. */
  guardBoost?: boolean;
  /** Growth Multiplier: development tokens score 20% more. */
  tokenBoost?: boolean;
}

export interface SimConfig {
  mode: ModeId;
  character: CharacterId;
  rival: CharacterId;
  seed: number;
  startTheme: ThemeId;
  shortCinematics: boolean;
  missions: ActiveMission[];
  discovered: ThemeId[];
  tutorial: boolean;
  /** Campaign only: the level being played. */
  level?: LevelRuntime;
  /** Development Race only. */
  race?: { length: number; rivalPace: number };
  perks?: Perks;
  /** Quiz ids for procedurally scheduled Accountability Gates (free run). */
  quizPool?: { id: string; answer: number }[];
  /** Answer lane per quiz id (from content/quiz.ts), used to score gates. */
  quizAnswers?: Record<string, number>;
}

export interface RunStats {
  distance: number;
  coins: number;
  chasesStarted: number;
  chasesSurvived: number;
  jumps: number;
  slides: number;
  jumpsOver: number;
  slidesUnder: number;
  dodges: number;
  bumps: number;
  collisions: number;
  devTokens: number;
  reportCards: number;
  rivalChallenges: number;
  rivalWins: number;
  quizAnswered: number;
  quizCorrect: number;
  promisesDelivered: number;
  roadsCleared: number;
  vikasRides: number;
  cleanDistance: number;
  laneChanges: number;
  stage: number;
}

export type ChaseResult = 'none' | 'survived' | 'failed';
export type CinematicTrigger = 'stumble' | 'meter' | 'challenge';
export type EndReason = 'chase' | 'stumble' | 'completed' | 'quit' | 'raceLost';

export interface RunSummary {
  mode: ModeId;
  character: CharacterId;
  seed: number;
  score: number;
  breakdown: ScoreBreakdown;
  distance: number;
  coins: number;
  chaseResult: ChaseResult;
  completed: boolean;
  reason: EndReason;
  crashedInto: ObstacleKind | null;
  missionsCompleted: string[];
  discoveries: ThemeId[];
  stats: RunStats;
  level: { id: string; completed: boolean; tokens: number; goal: number; stars: number } | null;
  race: { won: boolean; margin: number } | null;
}

export type SimEvent =
  | { type: 'coin'; id: number; value: number }
  | { type: 'pickup'; id: number; kind: PickupKind; variant: TokenVariant | null }
  | { type: 'jump' }
  | { type: 'slide' }
  | { type: 'land' }
  | { type: 'lane'; dir: -1 | 1 }
  | { type: 'bump'; obstacleId: number }
  | { type: 'dodge'; over: 'jump' | 'slide' | null; points: number }
  | { type: 'escape'; remaining: number }
  | { type: 'stumble'; obstacleId: number; scripted: boolean }
  | { type: 'recover' }
  | { type: 'state'; from: SimState; to: SimState }
  | { type: 'eventPending'; challenge: boolean }
  | { type: 'cinematicStart'; kind: 'full' | 'short'; trigger: CinematicTrigger }
  | { type: 'chaseStart'; duration: number }
  | { type: 'chaseEnd'; success: boolean; bonus: number }
  | { type: 'stageUp'; stage: number }
  | { type: 'cleared'; ids: number[] }
  | { type: 'bulldozed'; ids: number[]; points: number }
  | { type: 'crash'; reason: 'chase' | 'stumble'; kind: ObstacleKind | null; cls: ObstacleClass | null }
  | { type: 'gameOver'; summary: RunSummary }
  | { type: 'mission'; id: string; title: string; reward: number; points: number }
  | { type: 'theme'; theme: ThemeId }
  | { type: 'discovery'; theme: ThemeId; points: number }
  | { type: 'director'; kind: DirectorEventKind; phase: 'warn' | 'start' | 'end' }
  | { type: 'powerup'; kind: 'magnet' | 'vikas' | 'bulldozer'; phase: 'start' | 'end' }
  | { type: 'token'; kind: 'chaseToken' | 'devToken' | 'reportCard' | 'promise'; points: number }
  | { type: 'encounter'; kind: EncounterKind; phase: 'announce' | 'start' | 'end'; enc: Encounter; points: number }
  | { type: 'guard'; ready: boolean }
  | { type: 'hint'; cls: ObstacleClass }
  | { type: 'levelComplete'; stars: number; points: number }
  | { type: 'raceEnd'; won: boolean; margin: number };

export interface ChaseInfo {
  active: boolean;
  remaining: number;
  total: number;
  elapsed: number;
  escapes: number;
  tokens: number;
  count: number;
  startS: number;
  tokensSpawned: number;
  chunks: number;
}

const GUNDARAJ_KINDS = new Set<ObstacleKind>(['gundarajBoard', 'aframeSign', 'fileMountain', 'mediaVan', 'fileStack', 'unfinishedSign', 'delaySign']);
const METER_PER_ROW = 3;
const METER_GUNDARAJ_BONUS = 3;
const MAX_OBSTACLE_REACH = 12;
const QUIZ_WINDOW_BEFORE = 48;
const QUIZ_WINDOW_AFTER = 14;
const QUIZ_ANNOUNCE_TIME = 8.5;
const BULLDOZER_TIME = 6;
const RACE_TOKEN_BOOST = 3;
const FINISH_CLEAR = 35;

/**
 * The whole game, minus rendering. Owns the finite-state machine
 *   RUNNING → EVENT_PENDING → CINEMATIC → CHASE → SUCCESS | FAILURE → RUNNING | GAME_OVER
 * (plus STUMBLE between a recoverable collision and the cinematic or the
 * recovery). Every state has a timeout or an explicit exit, so no animation
 * can freeze a run.
 */
export class Simulation {
  readonly cfg: SimConfig;
  private rng: Rng;
  state: SimState = 'RUNNING';
  stateTime = 0;
  time = 0;
  d = 0;
  speed: number;
  readonly player = new Player();
  obstacles: Obstacle[] = [];
  rows: Row[] = [];
  pickups: Pickup[] = [];
  private obstaclePool: Obstacle[] = [];
  private pickupPool: Pickup[] = [];
  private nextId = 1;
  private genCursor: number;
  readonly score = new ScoreKeeper();
  coins = 0;
  readonly stats: RunStats = {
    distance: 0,
    coins: 0,
    chasesStarted: 0,
    chasesSurvived: 0,
    jumps: 0,
    slides: 0,
    jumpsOver: 0,
    slidesUnder: 0,
    dodges: 0,
    bumps: 0,
    collisions: 0,
    devTokens: 0,
    reportCards: 0,
    rivalChallenges: 0,
    rivalWins: 0,
    quizAnswered: 0,
    quizCorrect: 0,
    promisesDelivered: 0,
    roadsCleared: 0,
    vikasRides: 0,
    cleanDistance: 0,
    laneChanges: 0,
    stage: 1,
  };
  meter = 0;
  guardReady = true;
  guardT = 0;
  readonly chase: ChaseInfo = {
    active: false,
    remaining: 0,
    total: 0,
    elapsed: 0,
    escapes: 0,
    tokens: 0,
    count: 0,
    startS: 0,
    tokensSpawned: 0,
    chunks: 0,
  };
  chaseResult: ChaseResult = 'none';
  cinematic: { kind: 'full' | 'short'; trigger: CinematicTrigger; duration: number } = {
    kind: 'full',
    trigger: 'meter',
    duration: CINEMATIC_FULL,
  };
  fullEntranceUsed = false;
  failureReason: 'chase' | 'stumble' | null = null;
  crashedInto: Obstacle | null = null;
  magnetT = 0;
  vikasT = 0;
  bulldozerT = 0;
  bulldozerTotal = BULLDOZER_TIME;
  speedRunT = 0;
  plannedEvents: PlannedEvent[] = [];
  private nextEventPlanS = 400;
  encounters: Encounter[] = [];
  private nextEncounterPlanS = 600;
  /** Track ranges where no obstacle rows may be generated. */
  private reserved: { s0: number; s1: number }[] = [];
  themeIndex: number;
  theme: ThemeId;
  private discovered: Set<ThemeId>;
  private discoveries: ThemeId[] = [];
  events: SimEvent[] = [];
  private inputs: { a: Action; t: number }[] = [];
  private acc = 0;
  private cleanStart = 0;
  readonly missions: ActiveMission[];
  private missionsCompleted: string[] = [];
  private hinted = new Set<ObstacleClass>();
  private stumbleRecovers = false;
  /** Development Race: rival progress along its parallel route. */
  rivalD = 0;
  raceBoost = 0;
  summary: RunSummary | null = null;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    this.speed = this.targetSpeed();
    this.player.reset(1);
    this.themeIndex = themeIndexAt(cfg.startTheme, 0);
    this.theme = cfg.startTheme;
    this.discovered = new Set([...cfg.discovered, cfg.startTheme]);
    this.missions = cfg.missions.map((m) => ({ ...m }));
    if (cfg.perks?.tokenBoost) this.score.tokenMultiplier = 1.2;
    if (cfg.perks?.powerupBoost) this.bulldozerTotal = BULLDOZER_TIME * 1.25;
    this.genCursor = 42;
    if (cfg.level) {
      for (const ev of cfg.level.events) this.addEncounter(ev.kind, ev.at, ev.len ?? 0, ev.quiz);
      this.reserved.push({ s0: cfg.level.length - FINISH_CLEAR, s1: Number.POSITIVE_INFINITY });
    }
    this.ensureAhead();
  }

  // ------------------------------------------------------------- modes

  get isCampaign(): boolean {
    return this.cfg.mode === 'campaign';
  }

  get isRace(): boolean {
    return this.cfg.mode === 'race';
  }

  get isRivalry(): boolean {
    return this.cfg.mode === 'rivalry';
  }

  /** Themes rotate in endless modes and stay fixed in levels and races. */
  private get rotates(): boolean {
    return this.cfg.mode === 'free' || this.cfg.mode === 'rivalry';
  }

  /** Chases (rival entrance + chaser vehicle) exist only in endless modes. */
  get hasChases(): boolean {
    return this.rotates;
  }

  themeAtS(s: number): ThemeId {
    return this.rotates ? themeAt(this.cfg.startTheme, s) : this.cfg.startTheme;
  }

  /** 0..1 progress through a level or race (0 in endless modes). */
  get progress(): number {
    if (this.cfg.level) return Math.min(1, this.d / this.cfg.level.length);
    if (this.cfg.race) return Math.min(1, (this.d + this.raceBoost) / this.cfg.race.length);
    return 0;
  }

  get rivalProgress(): number {
    return this.cfg.race ? Math.min(1, this.rivalD / this.cfg.race.length) : 0;
  }

  // ---------------------------------------------------------------- inputs

  input(a: Action): void {
    if (this.state === 'GAME_OVER') return;
    if (this.state === 'CINEMATIC') {
      if (this.stateTime > 0.35) this.skipCinematic();
      return;
    }
    if (!this.acceptsInput()) return;
    if (this.inputs.length >= 3) this.inputs.shift();
    this.inputs.push({ a, t: this.time });
  }

  acceptsInput(): boolean {
    return (
      this.state === 'RUNNING' || this.state === 'EVENT_PENDING' || this.state === 'CHASE' || this.state === 'SUCCESS'
    );
  }

  skipCinematic(): void {
    if (this.state === 'CINEMATIC') this.enterChase();
  }

  // ------------------------------------------------------------------ loop

  /** Advance by a real frame delta. Runs zero or more fixed steps. */
  advance(frameDt: number): void {
    if (!(frameDt > 0)) return;
    this.acc += Math.min(frameDt, MAX_FRAME_DT);
    let guard = 0;
    while (this.acc >= SIM_DT && guard++ < 24) {
      this.step(SIM_DT);
      this.acc -= SIM_DT;
    }
    if (guard >= 24) this.acc = 0;
  }

  step(dt: number): void {
    if (this.state === 'GAME_OVER') return;
    this.time += dt;
    this.stateTime += dt;
    if (this.cfg.race) this.stepRival(dt);
    switch (this.state) {
      case 'STUMBLE':
        this.stepWorld(dt * STUMBLE_TIMESCALE);
        if (this.stateTime >= STUMBLE_TIME) {
          if (this.stumbleRecovers) this.recover();
          else this.enterCinematic(this.cinematic.trigger);
        }
        break;
      case 'CINEMATIC':
        if (this.stateTime >= this.cinematic.duration) this.enterChase();
        break;
      case 'FAILURE':
        if (this.stateTime >= FAILURE_TIME) this.finish(this.failureReason ?? 'stumble');
        break;
      default:
        this.stepGameplay(dt);
    }
  }

  private setState(to: SimState): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.stateTime = 0;
    this.events.push({ type: 'state', from, to });
  }

  runnerBox(): RunnerBox {
    return { x: this.player.x, y: this.player.y, h: this.player.height, d: this.d };
  }

  private near(ob: Obstacle): boolean {
    return ob.s < this.d + MAX_OBSTACLE_REACH && ob.s + ob.depth > this.d - 2;
  }

  /** Move the world without player control (slow-motion stumble). */
  private stepWorld(dt: number): void {
    const box = this.runnerBox();
    let ground = 0;
    for (const ob of this.obstacles) if (this.near(ob)) ground = Math.max(ground, supportFrom(box, ob));
    this.player.step(dt, ground, false);
    this.d += this.speed * dt;
    for (const ob of this.obstacles) if (this.near(ob)) ob.flags = 0;
  }

  private stepRival(dt: number): void {
    const race = this.cfg.race!;
    if (this.state === 'GAME_OVER' || this.state === 'FAILURE') return;
    this.rivalD += dt * baseSpeedAt(this.rivalD) * race.rivalPace;
    if (this.rivalD >= race.length && this.d + this.raceBoost < race.length) {
      const margin = Math.round(this.rivalD - (this.d + this.raceBoost));
      this.events.push({ type: 'raceEnd', won: false, margin });
      this.finish('raceLost');
    }
  }

  private processInputs(underOverhead: boolean): void {
    while (this.inputs.length) {
      const inp = this.inputs[0];
      if (this.time - inp.t > INPUT_BUFFER_TIME) {
        this.inputs.shift();
        continue;
      }
      const p = this.player;
      if (inp.a === 'left' || inp.a === 'right') {
        const ok = inp.a === 'left' ? p.moveLeft() : p.moveRight();
        if (ok) {
          this.stats.laneChanges++;
          this.events.push({ type: 'lane', dir: inp.a === 'left' ? -1 : 1 });
        }
        this.inputs.shift();
      } else if (inp.a === 'jump') {
        // Never stand up into a hanging obstacle: hold the jump until clear.
        if (underOverhead) break;
        if (p.jump()) {
          this.stats.jumps++;
          this.events.push({ type: 'jump' });
          this.inputs.shift();
        } else break; // airborne: buffered until landing (or expiry)
      } else if (inp.a === 'slide') {
        if (p.slide()) {
          this.stats.slides++;
          this.events.push({ type: 'slide' });
        }
        this.inputs.shift();
      } else {
        this.inputs.shift();
      }
    }
  }

  private baseSpeed(s: number): number {
    const lv = this.cfg.level;
    if (lv) return levelSpeed(lv.diff, s / lv.length);
    return baseSpeedAt(s);
  }

  private targetSpeed(): number {
    let factor = 1;
    if (this.vikasT > 0) factor = SPEED_FACTOR.vikas;
    else if (this.speedRunT > 0) factor = SPEED_FACTOR.speedRun;
    else if (this.state === 'CHASE') factor = SPEED_FACTOR.chase;
    return this.baseSpeed(this.d) * factor;
  }

  /** Upper bound on speed at s, used to space obstacles. */
  vCons = (s: number): number => this.baseSpeed(s) * GEN_SPEED_MARGIN;

  get invulnerable(): boolean {
    return this.vikasT > 0 || this.bulldozerT > 0 || this.state === 'SUCCESS';
  }

  private stepGameplay(dt: number): void {
    const p = this.player;
    let box = this.runnerBox();
    let ground = 0;
    let under = false;
    for (const ob of this.obstacles) {
      if (!this.near(ob)) continue;
      ground = Math.max(ground, supportFrom(box, ob));
      if (isOverhead(box, ob)) under = true;
    }
    this.processInputs(under);

    const dv = this.targetSpeed() - this.speed;
    this.speed += Math.max(-ACCEL * 2 * dt, Math.min(ACCEL * dt, dv));

    const res = p.step(dt, ground, under);
    if (res.landed) this.events.push({ type: 'land' });
    const dd = this.speed * dt;
    this.d += dd;
    this.score.addDistance(dd, this.speedRunT > 0 ? 2 : 1);
    this.stats.distance = this.d;
    this.stats.cleanDistance = Math.max(this.stats.cleanDistance, this.d - this.cleanStart);

    this.tickTimers(dt);

    // Collisions.
    const invulnerable = this.invulnerable;
    box = this.runnerBox();
    for (const ob of this.obstacles) {
      if (!this.near(ob)) continue;
      const r = contactFor(box, ob, ob.flags);
      ob.flags = r.flags;
      if (invulnerable || r.contact === 'none') continue;
      if (r.contact === 'crash') {
        this.onCrash(ob);
        return;
      }
      if (r.contact === 'bump') {
        p.bounceBack();
        this.stats.bumps++;
        this.cleanStart = this.d;
        this.events.push({ type: 'bump', obstacleId: ob.id });
      } else if (r.contact === 'land') {
        p.y = ob.top;
        p.vy = 0;
        p.grounded = true;
        p.airTime = 0;
        p.jumpedThisAir = false;
      }
    }

    this.updateBulldozer();
    this.updatePickups(dt);
    this.updateRows();
    this.updateTheme();
    this.updateDirector();
    this.updateEncounters();
    this.updateMissions();
    this.updateHints();

    switch (this.state) {
      case 'RUNNING':
        if (this.hasChases && this.meter >= 100 && this.vikasT <= 0 && this.bulldozerT <= 0 && this.d > 150) {
          this.setState('EVENT_PENDING');
          this.events.push({ type: 'eventPending', challenge: this.isRivalry });
        }
        break;
      case 'EVENT_PENDING': {
        const clearTo = this.d + this.speed * 1.2;
        const clear = !this.obstacles.some((o) => !o.hit && o.s + o.depth > this.d - 0.5 && o.s < clearTo);
        // Rivalry: the "Political Challenge Ahead!" warning gets a readable
        // lead time before the runner trips over a (harmless) pile of
        // campaign paperwork.
        const warned = !this.isRivalry || this.stateTime >= CHALLENGE_WARNING;
        if ((clear && p.grounded && warned) || this.stateTime >= EVENT_PENDING_MAX) {
          if (this.isRivalry) this.stumble(null, 'challenge');
          else this.enterCinematic('meter');
        }
        break;
      }
      case 'CHASE':
        this.chase.elapsed += dt;
        this.chase.remaining -= dt;
        if (this.chase.remaining <= 0) this.chaseSuccess();
        break;
      case 'SUCCESS':
        if (this.stateTime >= SUCCESS_TIME) this.setState('RUNNING');
        break;
    }

    if (this.state === 'RUNNING' || this.state === 'SUCCESS' || this.state === 'EVENT_PENDING') this.checkGoal();
    if (this.state === 'GAME_OVER') return;
    this.ensureAhead();
    this.despawn();
  }

  private checkGoal(): void {
    const lv = this.cfg.level;
    if (lv && this.d >= lv.length) {
      const stars = this.levelStars(true);
      const points = this.score.addLevelComplete(stars);
      this.events.push({ type: 'levelComplete', stars, points });
      this.finish('completed');
      return;
    }
    const race = this.cfg.race;
    if (race && this.d + this.raceBoost >= race.length) {
      const margin = Math.round(this.d + this.raceBoost - this.rivalD);
      this.score.addBonus('raceWin');
      this.events.push({ type: 'raceEnd', won: true, margin });
      this.finish('completed');
    }
  }

  levelStars(completed: boolean): number {
    const lv = this.cfg.level;
    if (!lv || !completed) return 0;
    if (this.stats.devTokens < lv.tokenGoal) return 1;
    return this.stats.collisions === 0 ? 3 : 2;
  }

  private tickTimers(dt: number): void {
    if (this.magnetT > 0) {
      this.magnetT -= dt;
      if (this.magnetT <= 0) {
        this.magnetT = 0;
        this.events.push({ type: 'powerup', kind: 'magnet', phase: 'end' });
      }
    }
    if (this.vikasT > 0) {
      this.vikasT -= dt;
      if (this.vikasT <= 0) {
        this.vikasT = 0;
        this.events.push({ type: 'powerup', kind: 'vikas', phase: 'end' });
      }
    }
    if (this.bulldozerT > 0) {
      this.bulldozerT -= dt;
      if (this.bulldozerT <= 0) {
        this.bulldozerT = 0;
        this.events.push({ type: 'powerup', kind: 'bulldozer', phase: 'end' });
      }
    }
    if (this.speedRunT > 0) {
      this.speedRunT -= dt;
      if (this.speedRunT <= 0) this.speedRunT = 0;
    }
    if (!this.guardReady && this.guardT > 0 && (this.state === 'RUNNING' || this.state === 'EVENT_PENDING')) {
      this.guardT -= dt;
      if (this.guardT <= 0) {
        this.guardT = 0;
        this.guardReady = true;
        this.events.push({ type: 'guard', ready: true });
      }
    }
  }

  private guardRecharge(): number {
    return GUARD_RECHARGE * (this.cfg.perks?.guardBoost ? 0.7 : 1) * (this.hasChases ? 1 : 1.2);
  }

  private powerupTime(base: number): number {
    return base * (this.cfg.perks?.powerupBoost ? 1.25 : 1);
  }

  // ------------------------------------------------------------ transitions

  private onCrash(ob: Obstacle): void {
    this.stats.collisions++;
    this.cleanStart = this.d;
    for (const e of this.encounters) if (e.started && !e.ended && e.kind === 'redCap') e.failed = true;
    if (this.state === 'CHASE') return this.fail('chase', ob);
    const recoverable = this.guardReady && (this.state === 'RUNNING' || this.state === 'EVENT_PENDING');
    if (recoverable) this.stumble(ob, 'stumble');
    else this.fail('stumble', ob);
  }

  /**
   * Recoverable stumble. Endless modes go on to the rival entrance and a
   * chase; campaign levels and races recover after the slow-motion beat.
   * `ob` is null for the scripted Rivalry-mode challenge stumble.
   */
  private stumble(ob: Obstacle | null, trigger: CinematicTrigger): void {
    if (ob) {
      ob.hit = true;
      this.guardReady = false;
      this.guardT = 0;
      this.events.push({ type: 'guard', ready: false });
    }
    this.stumbleRecovers = !this.hasChases;
    if (this.stumbleRecovers) this.guardT = this.guardRecharge();
    this.cinematic.trigger = trigger;
    this.inputs = [];
    this.player.sliding = false;
    this.clearAhead(this.d - 1, this.d + 10, true);
    this.setState('STUMBLE');
    this.events.push({ type: 'stumble', obstacleId: ob?.id ?? -1, scripted: !ob });
  }

  private recover(): void {
    this.inputs = [];
    // Give the runner a clear stretch to get going again.
    this.clearAhead(this.d - 1, this.d + this.speed * 1.6, false);
    this.setState('RUNNING');
    this.events.push({ type: 'recover' });
  }

  private enterCinematic(trigger: CinematicTrigger): void {
    const full = !this.fullEntranceUsed && !this.cfg.shortCinematics;
    this.cinematic = { kind: full ? 'full' : 'short', trigger, duration: full ? CINEMATIC_FULL : CINEMATIC_SHORT };
    if (full) this.fullEntranceUsed = true;
    const p = this.player;
    // Safe scripted transition state: grounded, standing, centred in lane.
    p.y = 0;
    p.vy = 0;
    p.grounded = true;
    p.airTime = 0;
    p.jumpedThisAir = false;
    p.sliding = false;
    p.slideQueued = false;
    p.x = LANE_X[p.lane];
    p.prevLane = p.lane;
    this.inputs = [];
    this.speedRunT = 0;
    this.magnetT = 0;
    for (const e of this.plannedEvents) {
      if (e.started && !e.ended) this.events.push({ type: 'director', kind: e.kind, phase: 'end' });
    }
    this.plannedEvents = [];
    this.nextEventPlanS = this.d + 700;
    this.encounters = this.encounters.filter((e) => e.started && !e.ended ? ((e.ended = true), false) : !e.started && e.s0 > this.d + 400);
    this.clearAhead(this.d - 1, Number.POSITIVE_INFINITY, true);
    this.genCursor = Number.POSITIVE_INFINITY;
    this.setState('CINEMATIC');
    this.events.push({ type: 'cinematicStart', kind: this.cinematic.kind, trigger });
  }

  private enterChase(): void {
    const c = this.chase;
    c.active = true;
    c.total = this.cinematic.kind === 'full' ? CHASE_FULL : CHASE_SHORT;
    c.remaining = c.total;
    c.elapsed = 0;
    c.escapes = 0;
    c.tokens = 0;
    c.tokensSpawned = 0;
    c.chunks = 0;
    c.startS = this.d;
    c.count++;
    this.stats.chasesStarted++;
    this.meter = 0;
    this.inputs = [];
    this.genCursor = this.d + this.vCons(this.d) * CHASE_OPENING_CLEAR;
    this.setState('CHASE');
    this.events.push({ type: 'chaseStart', duration: c.total });
    this.ensureAhead();
  }

  private chaseSuccess(): void {
    const c = this.chase;
    c.active = false;
    c.remaining = 0;
    this.chaseResult = 'survived';
    this.stats.chasesSurvived++;
    const bonus = this.score.addChaseComplete(c.escapes);
    this.meter = 0;
    if (!this.guardReady) this.guardT = this.guardRecharge();
    // Unoccupied road debris ahead is cleared: a new stretch opens up.
    this.clearAhead(this.d + 0.5, Number.POSITIVE_INFINITY, false);
    this.genCursor = this.d + this.speed * (SUCCESS_TIME + 0.8);
    this.setState('SUCCESS');
    this.events.push({ type: 'chaseEnd', success: true, bonus });
    if (this.isRivalry) {
      this.stats.stage++;
      this.events.push({ type: 'stageUp', stage: this.stats.stage });
    }
  }

  private fail(reason: 'chase' | 'stumble', ob: Obstacle | null): void {
    if (this.state === 'CHASE') {
      this.chaseResult = 'failed';
      this.chase.active = false;
      this.events.push({ type: 'chaseEnd', success: false, bonus: 0 });
    }
    this.failureReason = reason;
    this.crashedInto = ob;
    this.inputs = [];
    this.speed = 0;
    this.vikasT = 0;
    this.bulldozerT = 0;
    this.player.sliding = false;
    if (ob && ob.cls !== 'gap' && ob.cls !== 'high') this.d = Math.min(this.d, ob.s - PLAYER_HALF_D - 0.02);
    this.setState('FAILURE');
    this.events.push({ type: 'crash', reason, kind: ob?.kind ?? null, cls: ob?.cls ?? null });
  }

  private finish(reason: EndReason): void {
    if (this.state === 'GAME_OVER') return;
    this.stats.coins = this.coins;
    const lv = this.cfg.level;
    const completed = reason === 'completed';
    const race = this.cfg.race;
    this.summary = {
      mode: this.cfg.mode,
      character: this.cfg.character,
      seed: this.cfg.seed,
      score: this.score.total,
      breakdown: this.score.breakdown(),
      distance: Math.floor(this.d),
      coins: this.coins,
      chaseResult: this.chaseResult,
      completed,
      reason,
      crashedInto: this.crashedInto?.kind ?? null,
      missionsCompleted: [...this.missionsCompleted],
      discoveries: [...this.discoveries],
      stats: { ...this.stats },
      level: lv ? { id: lv.id, completed, tokens: this.stats.devTokens, goal: lv.tokenGoal, stars: this.levelStars(completed) } : null,
      race: race ? { won: completed, margin: Math.round(this.d + this.raceBoost - this.rivalD) } : null,
    };
    this.setState('GAME_OVER');
    this.events.push({ type: 'gameOver', summary: this.summary });
  }

  /** Player quit from the pause menu: produce a summary without a crash. */
  quit(): RunSummary {
    if (!this.summary) this.finish('quit');
    return this.summary as RunSummary;
  }

  // ---------------------------------------------------------- world upkeep

  private updatePickups(dt: number): void {
    const p = this.player;
    const reachS = PLAYER_HALF_D + 0.45;
    const reachX = PLAYER_HALF_W + 0.45;
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      const rel = pk.s - this.d;
      if (rel > 14 || rel < -2) continue;
      if (this.magnetT > 0 && (pk.kind === 'coin' || pk.kind === 'devToken' || pk.kind === 'promise') && rel < 10 && rel > -1) pk.magnetized = true;
      if (pk.magnetized) {
        const k = Math.min(1, dt * 14);
        pk.x += (p.x - pk.x) * k;
        pk.y += (p.y + 0.9 - pk.y) * k;
        pk.s += (this.d + 0.1 - pk.s) * k;
      }
      const inY = pk.y > p.y - 0.35 && pk.y < p.y + p.height + 0.35;
      if (Math.abs(pk.s - this.d) < reachS && Math.abs(pk.x - p.x) < reachX && inY) this.collect(pk);
    }
  }

  private collect(pk: Pickup): void {
    if (pk.collected) return; // each instance is processed exactly once
    pk.collected = true;
    switch (pk.kind) {
      case 'coin': {
        const mult = this.state === 'CHASE' ? 2 : 1;
        this.coins += mult;
        this.stats.coins = this.coins;
        this.score.addCoin(mult);
        this.events.push({ type: 'coin', id: pk.id, value: mult });
        break;
      }
      case 'magnet':
        this.magnetT = this.powerupTime(MAGNET_TIME);
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: null });
        this.events.push({ type: 'powerup', kind: 'magnet', phase: 'start' });
        break;
      case 'vikas':
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: null });
        this.startVikas();
        break;
      case 'bulldozer':
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: null });
        this.startBulldozer();
        break;
      case 'chaseToken': {
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: null });
        if (this.state === 'CHASE') {
          this.chase.remaining += CHASE_TOKEN_TIME;
          this.chase.total += CHASE_TOKEN_TIME;
          this.chase.tokens++;
        }
        this.events.push({ type: 'token', kind: 'chaseToken', points: this.score.addBonus('chaseToken') });
        break;
      }
      case 'devToken': {
        this.stats.devTokens++;
        if (this.cfg.race) this.raceBoost += RACE_TOKEN_BOOST;
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: pk.variant });
        this.events.push({ type: 'token', kind: 'devToken', points: this.score.addBonus('devToken') });
        break;
      }
      case 'reportCard':
        this.stats.reportCards++;
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: null });
        this.events.push({ type: 'token', kind: 'reportCard', points: this.score.addBonus('reportCard') });
        break;
      case 'promise': {
        const enc = this.encounters.find((e) => e.kind === 'promises' && e.started && !e.ended);
        if (enc) enc.got++;
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind, variant: null });
        this.events.push({ type: 'token', kind: 'promise', points: this.score.addBonus('promise') });
        break;
      }
    }
  }

  private startVikas(): void {
    if (this.state !== 'RUNNING' && this.state !== 'SUCCESS') return;
    this.vikasT = this.powerupTime(VIKAS_TIME);
    this.stats.vikasRides++;
    const vEst = this.baseSpeed(this.d) * SPEED_FACTOR.vikas;
    const until = this.d + vEst * (this.vikasT + 1.3);
    this.clearAhead(this.d + 0.5, Number.POSITIVE_INFINITY, true);
    let lane = this.player.lane as number;
    for (let s = this.d + 8, k = 0; s < until - 6; s += 2.6, k++) {
      if (k > 0 && k % 10 === 0) lane = Math.max(0, Math.min(2, lane + (this.rng.chance(0.5) ? 1 : -1)));
      this.spawnPickup({ kind: 'coin', s, lane: lane as 0 | 1 | 2, x: LANE_X[lane], y: 0.9 });
    }
    this.genCursor = until;
    this.events.push({ type: 'powerup', kind: 'vikas', phase: 'start' });
  }

  /**
   * Bulldozer power-up ("Road Clearing Drive"): for a few seconds the runner
   * is untouchable and a bulldozer on the shoulder pushes aside the
   * unoccupied debris, red tape and potholes ahead. It never touches people,
   * vehicles or buildings.
   */
  private startBulldozer(): void {
    if (this.state !== 'RUNNING' && this.state !== 'SUCCESS' && this.state !== 'EVENT_PENDING') return;
    this.bulldozerT = this.bulldozerTotal;
    const vEst = this.baseSpeed(this.d);
    const until = this.d + vEst * (this.bulldozerT + 1.4);
    this.clearAhead(this.d + 0.5, until + 30, false);
    let rowId = -1000 - this.nextId;
    for (let s = this.d + 22; s < until - 12; s += 13) {
      const lane = this.rng.int(0, 2) as 0 | 1 | 2;
      const kind = this.rng.pick(DEBRIS_KINDS);
      this.spawnObstacle(kind, lane, s, rowId--, false, true);
    }
    this.genCursor = Math.max(this.genCursor, until);
    this.events.push({ type: 'powerup', kind: 'bulldozer', phase: 'start' });
  }

  private updateBulldozer(): void {
    if (this.bulldozerT <= 0) return;
    const ids: number[] = [];
    const keep: Obstacle[] = [];
    for (const ob of this.obstacles) {
      if (ob.debris && ob.s - this.d < 13) {
        ids.push(ob.id);
        this.obstaclePool.push(ob);
      } else keep.push(ob);
    }
    if (!ids.length) return;
    this.obstacles = keep;
    this.stats.roadsCleared += ids.length;
    let points = 0;
    for (let i = 0; i < ids.length; i++) points += this.score.addBonus('roadCleared');
    this.events.push({ type: 'bulldozed', ids, points });
  }

  private updateRows(): void {
    for (const row of this.rows) {
      if (row.passed || this.d - PLAYER_HALF_D <= row.end) continue;
      row.passed = true;
      const cells = row.cells;
      if (!cells.some((c) => c.cls)) continue;
      const cell = cells[this.player.lane];
      const hitInLane = this.obstacles.some((o) => o.rowId === row.id && o.lane === this.player.lane && o.hit);
      const over =
        !hitInLane && (cell.cls === 'low' || cell.cls === 'gap') ? 'jump' : !hitInLane && cell.cls === 'high' ? 'slide' : null;
      if (over === 'jump') this.stats.jumpsOver++;
      if (over === 'slide') this.stats.slidesUnder++;
      this.stats.dodges++;
      const points = this.score.addDodge(over !== null);
      this.events.push({ type: 'dodge', over, points });
      if (this.state === 'RUNNING' && this.hasChases) {
        const chaos = cells.some((c) => c.kind && GUNDARAJ_KINDS.has(c.kind));
        const rate = this.isRivalry ? 1.4 : 1;
        this.meter = Math.min(100, this.meter + (METER_PER_ROW + (chaos ? METER_GUNDARAJ_BONUS : 0)) * rate);
      }
      if (this.state === 'CHASE') {
        this.chase.remaining = Math.max(0, this.chase.remaining - CHASE_DODGE_REWARD);
        this.chase.escapes++;
        this.events.push({ type: 'escape', remaining: this.chase.remaining });
      }
    }
  }

  private updateTheme(): void {
    if (!this.rotates) return;
    const idx = themeIndexAt(this.cfg.startTheme, this.d);
    if (idx === this.themeIndex) return;
    this.themeIndex = idx;
    this.theme = THEME_ORDER[idx];
    this.events.push({ type: 'theme', theme: this.theme });
    if (!this.discovered.has(this.theme)) {
      this.discovered.add(this.theme);
      this.discoveries.push(this.theme);
      const points = this.score.addBonus('discovery');
      this.events.push({ type: 'discovery', theme: this.theme, points });
    }
  }

  private updateDirector(): void {
    for (const e of this.plannedEvents) {
      if (e.ended) continue;
      if (!e.started) {
        if (e.kind === 'speedRun' && !e.warned && this.d >= e.s0 - this.vCons(e.s0) * SPEED_RUN_WARNING && this.d < e.s0) {
          e.warned = true;
          this.events.push({ type: 'director', kind: e.kind, phase: 'warn' });
        }
        if (this.d >= e.s0) {
          e.started = true;
          if (e.kind === 'speedRun') {
            if (this.state === 'RUNNING' && this.vikasT <= 0 && this.bulldozerT <= 0) this.speedRunT = SPEED_RUN_TIME;
            else {
              e.ended = true;
              continue;
            }
          }
          this.events.push({ type: 'director', kind: e.kind, phase: 'start' });
        }
      } else {
        const over = e.kind === 'speedRun' ? this.speedRunT <= 0 : this.d >= e.s1;
        if (over) {
          e.ended = true;
          this.events.push({ type: 'director', kind: e.kind, phase: 'end' });
        }
      }
    }
    if (this.plannedEvents.length > 4) this.plannedEvents = this.plannedEvents.filter((e) => !e.ended);
  }

  /** Event active at a track position (used by the renderer for scenery). */
  eventAt(s: number): DirectorEventKind | null {
    for (const e of this.plannedEvents) if (!e.ended && s >= e.s0 && s <= e.s1) return e.kind;
    return null;
  }

  // ------------------------------------------------------------ encounters

  private addEncounter(kind: EncounterKind, s0: number, len: number, quizId?: string): void {
    const e: Encounter = { kind, s0, s1: s0 + len, quizId, announced: false, started: false, ended: false, failed: false, total: 0, got: 0 };
    this.encounters.push(e);
    if (kind === 'quiz') this.reserved.push({ s0: s0 - QUIZ_WINDOW_BEFORE, s1: s0 + QUIZ_WINDOW_AFTER });
    if (kind === 'bulldozer') this.reserved.push({ s0: s0 - 22, s1: s0 + 8 });
  }

  /** Free runs schedule rival encounters and gates procedurally, ahead of time. */
  private planEncounters(s: number): void {
    if (this.cfg.mode !== 'free' || this.state === 'CHASE' || this.state === 'CINEMATIC') return;
    if (s < this.nextEncounterPlanS) return;
    const pool = this.cfg.quizPool ?? [];
    const roll = this.rng.next();
    const at = s + 60;
    if (roll < 0.45 && pool.length) this.addEncounter('quiz', at, 0, this.rng.pick(pool).id);
    else if (roll < 0.75 && this.cfg.character !== 'akhilesh') this.addEncounter('redCap', at, 240);
    else if (this.cfg.character === 'yogi') this.addEncounter('bulldozer', at, 0);
    else this.addEncounter('promises', at, 240);
    this.nextEncounterPlanS = at + this.rng.range(900, 1400);
  }

  private quizAnswer(id: string | undefined): number {
    if (!id) return -1;
    const fromCfg = this.cfg.quizAnswers?.[id];
    if (fromCfg !== undefined) return fromCfg;
    return this.cfg.quizPool?.find((q) => q.id === id)?.answer ?? -1;
  }

  private updateEncounters(): void {
    for (const e of this.encounters) {
      if (e.ended) continue;
      if (e.kind === 'quiz') {
        if (!e.announced && this.d >= e.s0 - this.speed * QUIZ_ANNOUNCE_TIME) {
          e.announced = true;
          e.started = true;
          this.events.push({ type: 'encounter', kind: 'quiz', phase: 'announce', enc: e, points: 0 });
        }
        if (this.d - PLAYER_HALF_D > e.s0) {
          e.ended = true;
          e.chosen = this.player.lane;
          e.correct = e.chosen === this.quizAnswer(e.quizId);
          this.stats.quizAnswered++;
          let points = 0;
          if (e.correct) {
            this.stats.quizCorrect++;
            points = this.score.addBonus('quiz');
          }
          this.events.push({ type: 'encounter', kind: 'quiz', phase: 'end', enc: e, points });
        }
        continue;
      }
      if (e.kind === 'bulldozer') {
        e.ended = this.d > e.s0 + 5;
        continue;
      }
      if (!e.started && this.d >= e.s0) {
        if (this.state !== 'RUNNING' && this.state !== 'EVENT_PENDING' && this.state !== 'SUCCESS') {
          e.ended = true;
          continue;
        }
        e.started = true;
        if (e.kind === 'redCap') this.stats.rivalChallenges++;
        this.events.push({ type: 'encounter', kind: e.kind, phase: 'start', enc: e, points: 0 });
      }
      if (e.started && this.d >= e.s1) {
        e.ended = true;
        let points = 0;
        if (e.kind === 'redCap' && !e.failed) {
          this.stats.rivalWins++;
          points = this.score.addBonus('rivalWin');
        }
        if (e.kind === 'promises') {
          this.stats.promisesDelivered += e.got;
          if (e.total > 0 && e.got / e.total >= 0.6) points = this.score.addBonus('promisesDelivered');
          else e.failed = true;
        }
        this.events.push({ type: 'encounter', kind: e.kind, phase: 'end', enc: e, points });
      }
    }
    if (this.encounters.length > 12) this.encounters = this.encounters.filter((e) => !e.ended || e.s0 > this.d - 50);
  }

  /** Encounter (of a kind) whose span covers track position s. */
  encounterAt(s: number, kind?: EncounterKind): Encounter | null {
    for (const e of this.encounters) {
      if (kind && e.kind !== kind) continue;
      if (e.kind === 'quiz' || e.kind === 'bulldozer') continue;
      if (s >= e.s0 && s <= e.s1 && !(e.ended && e.s1 < this.d)) return e;
    }
    return null;
  }

  private statValue(stat: MissionStat): number {
    switch (stat) {
      case 'distance':
        return Math.floor(this.d);
      case 'coins':
        return this.coins;
      case 'cleanDistance':
        return Math.floor(this.stats.cleanDistance);
      default:
        return this.stats[stat];
    }
  }

  missionProgress(m: ActiveMission): number {
    return missionValue(m, this.statValue(m.def.stat));
  }

  private updateMissions(): void {
    for (const m of this.missions) {
      if (m.completed) continue;
      if (this.missionProgress(m) >= m.def.goal) {
        m.completed = true;
        this.missionsCompleted.push(m.def.id);
        const points = this.score.addBonus('mission');
        this.events.push({ type: 'mission', id: m.def.id, title: m.def.title, reward: m.def.reward, points });
      }
    }
  }

  private updateHints(): void {
    if (!this.cfg.tutorial || this.state !== 'RUNNING') return;
    for (const ob of this.obstacles) {
      if (ob.lane !== this.player.lane || ob.hit || this.hinted.has(ob.cls)) continue;
      const ahead = ob.s - this.d;
      if (ahead > 0 && ahead < this.speed * 1.5) {
        this.hinted.add(ob.cls);
        this.events.push({ type: 'hint', cls: ob.cls });
      }
    }
  }

  // ---------------------------------------------------------------- spawning

  private difficulty(s: number): number {
    const lv = this.cfg.level;
    if (lv) return Math.min(1, lv.diff + 0.25 * (s / lv.length));
    if (this.cfg.race) return Math.min(1, 0.15 + difficultyAt(s));
    return difficultyAt(s);
  }

  private chunkContext(s: number): GenContext {
    const v = this.vCons;
    if (this.state === 'CHASE' || this.state === 'CINEMATIC') {
      const c = this.chase;
      const prog = Math.min(1, (s - c.startS) / (v(s) * (c.total || CHASE_FULL)));
      const diff = Math.min(1, 0.15 + 0.45 * prog + 0.4 * difficultyAt(s));
      const opening = c.chunks === 0;
      return { kind: 'chase', theme: this.theme, distance: s, diff: opening ? 0 : diff, vAt: v, maxRows: opening ? 2 : undefined };
    }
    const theme = this.themeAtS(s);
    const enc = this.encounterAt(s);
    if (enc?.kind === 'redCap') return { kind: 'redCap', theme, distance: s, diff: this.difficulty(s), vAt: v };
    if (enc?.kind === 'promises') return { kind: 'promises', theme, distance: s, diff: this.difficulty(s), vAt: v };
    const ev = this.plannedEventAt(s);
    const kind: ChunkKind = ev === 'developmentRoute' ? 'development' : ev === 'coinRush' ? 'coinRush' : 'normal';
    return { kind, theme, distance: s, diff: this.difficulty(s), vAt: v };
  }

  private plannedEventAt(s: number): DirectorEventKind | null {
    for (const e of this.plannedEvents) if (s >= e.s0 && s <= e.s1) return e.kind;
    return null;
  }

  private planEvents(s: number): void {
    if (!this.rotates || this.state === 'CHASE' || this.state === 'CINEMATIC') return;
    if (s < this.nextEventPlanS) return;
    const kind = this.rng.weighted<DirectorEventKind>({
      posterAlley: 3,
      developmentRoute: 3,
      coinRush: 2,
      speedRun: s > 600 ? 2 : 0,
    });
    const len = kind === 'coinRush' ? 170 : kind === 'speedRun' ? SPEED_RUN_TIME * this.vCons(s) : 260;
    this.plannedEvents.push({ kind, s0: s, s1: s + len, started: false, ended: false });
    this.nextEventPlanS = s + len + this.rng.range(450, 800);
  }

  /** Next reserved window that starts at or after s (or contains it). */
  private reservedAfter(s: number): { s0: number; s1: number } | null {
    let best: { s0: number; s1: number } | null = null;
    for (const r of this.reserved) if (r.s1 > s && (!best || r.s0 < best.s0)) best = r;
    return best;
  }

  private ensureAhead(): void {
    const ahead = Math.max(SPAWN_AHEAD_MIN, this.speed * SPAWN_AHEAD_TIME);
    let guard = 0;
    while (this.genCursor < this.d + ahead && guard++ < 10) {
      let start = this.genCursor;
      // Skip over reserved stretches (quiz gates, power-up drops, finish line).
      const win = this.reservedAfter(start);
      if (win && start >= win.s0) {
        if (!Number.isFinite(win.s1)) {
          this.genCursor = Number.POSITIVE_INFINITY;
          break;
        }
        this.genCursor = win.s1;
        this.spawnEncounterItems(win);
        continue;
      }
      this.planEvents(start);
      this.planEncounters(start);
      const ctx = this.chunkContext(start);
      let rows = buildChunk(this.rng, ctx, start);
      if (win) rows = rows.filter((r) => r.end < win.s0 - 4);
      if (!rows.length) {
        this.genCursor = win ? win.s0 : start + 20;
        continue;
      }
      for (const row of rows) this.spawnRow(row);

      const extras: PickupKind[] = [];
      if (ctx.kind === 'chase') {
        if (this.chase.tokensSpawned < 2 && this.chase.chunks > 0 && this.rng.chance(0.5)) {
          extras.push('chaseToken');
          this.chase.tokensSpawned++;
        }
        if (this.isRivalry) extras.push('reportCard', 'reportCard');
        this.chase.chunks++;
      } else if (start > 350 && this.rotates) {
        if (this.rng.chance(0.06) && this.magnetT <= 0) extras.push('magnet');
        else if (this.rng.chance(0.05) && this.vikasT <= 0) extras.push('vikas');
      } else if (!this.rotates && start > 200 && this.rng.chance(0.07)) extras.push('magnet');
      // Levels and races always carry coins: their chunks are long, and a
      // token goal must never hinge on a run of unlucky rolls.
      const coinChance = !this.rotates || ctx.kind === 'coinRush' || ctx.kind === 'development' || ctx.kind === 'promises' ? 1 : ctx.kind === 'chase' ? 0.8 : 0.72;
      if (this.rng.chance(coinChance) || extras.length) {
        const specs = placeCoins(this.rng, rows, start, this.vCons, extras);
        if (ctx.kind === 'coinRush') {
          for (const spec of placeCoins(this.rng, rows, start, this.vCons)) {
            if (!specs.some((p) => p.lane === spec.lane && Math.abs(p.s - spec.s) < 1)) specs.push(spec);
          }
        }
        this.spawnCoins(specs, ctx.kind, start);
      }
      const last = rows[rows.length - 1];
      this.genCursor = last.end + this.rng.range(0.4, 0.9) * this.vCons(last.end);
    }
  }

  /** Turn coin specs into coins, development tokens or promise tokens. */
  private spawnCoins(specs: PickupSpec[], kind: ChunkKind, s: number): void {
    const enc = kind === 'promises' ? this.encounterAt(s, 'promises') : null;
    const tokenRate = this.isCampaign ? 0.2 : this.isRace ? 0.25 : this.isRivalry ? 0 : 0.08;
    let k = 0;
    for (const spec of specs) {
      if (spec.kind === 'coin') {
        if (enc && k++ % 3 === 0) {
          spec.kind = 'promise';
          enc.total++;
        } else if (tokenRate > 0 && kind !== 'chase' && this.rng.chance(tokenRate)) {
          spec.kind = 'devToken';
          spec.variant = THEME_TOKEN[this.themeAtS(spec.s)];
        }
      }
      this.spawnPickup(spec);
    }
  }

  /** Items placed inside a reserved window (bulldozer power-up drops). */
  private spawnEncounterItems(win: { s0: number; s1: number }): void {
    for (const e of this.encounters) {
      if (e.kind === 'bulldozer' && e.s0 >= win.s0 && e.s0 <= win.s1 && !e.started) {
        e.started = true;
        this.spawnPickup({ kind: 'bulldozer', s: e.s0, lane: 1, x: LANE_X[1], y: 0.9 });
        for (let s = e.s0 - 16; s < e.s0 - 2; s += 2.6) this.spawnPickup({ kind: 'coin', s, lane: 1, x: LANE_X[1], y: 0.9 });
      }
    }
  }

  private spawnRow(row: Row): void {
    this.rows.push(row);
    let gantry = false;
    for (let lane = 0; lane < 3; lane++) {
      const cell = row.cells[lane];
      if (!cell.cls || !cell.kind) continue;
      const isHigh = OBSTACLES[cell.kind].cls === 'high';
      this.spawnObstacle(cell.kind, lane as 0 | 1 | 2, row.s, row.id, isHigh && !gantry, false);
      if (isHigh) gantry = true;
    }
  }

  private spawnObstacle(kind: ObstacleKind, lane: 0 | 1 | 2, s: number, rowId: number, gantry: boolean, debris: boolean): Obstacle {
    const def = OBSTACLES[kind];
    const ob = this.obstaclePool.pop() ?? ({} as Obstacle);
    ob.id = this.nextId++;
    ob.kind = kind;
    ob.cls = def.cls;
    ob.lane = lane;
    ob.s = s;
    ob.depth = def.depth;
    ob.bottom = def.bottom;
    ob.top = def.top;
    ob.halfW = def.halfW;
    ob.rowId = rowId;
    ob.gantry = gantry;
    ob.flags = 0;
    ob.hit = false;
    ob.passed = false;
    ob.debris = debris;
    this.obstacles.push(ob);
    return ob;
  }

  private spawnPickup(spec: PickupSpec): void {
    const pk = this.pickupPool.pop() ?? ({} as Pickup);
    pk.id = this.nextId++;
    pk.kind = spec.kind;
    pk.variant = spec.variant ?? null;
    pk.s = spec.s;
    pk.lane = spec.lane;
    pk.x = spec.x;
    pk.y = spec.y;
    pk.collected = false;
    pk.magnetized = false;
    this.pickups.push(pk);
  }

  /** Remove obstacles (and optionally pickups) in [from, to). */
  private clearAhead(from: number, to: number, pickups: boolean): void {
    const cleared: number[] = [];
    const keep: Obstacle[] = [];
    for (const ob of this.obstacles) {
      // Knocked-away obstacles are inert and finish their tumble animation.
      if (!ob.hit && ob.s + ob.depth > from && ob.s < to) {
        if (ob.s - this.d < 140) cleared.push(ob.id);
        this.obstaclePool.push(ob);
      } else keep.push(ob);
    }
    this.obstacles = keep;
    this.rows = this.rows.filter((r) => !(r.end > from && r.s < to));
    if (pickups) {
      const kp: Pickup[] = [];
      for (const pk of this.pickups) {
        // Power-up drops placed by the level are never removed.
        if (pk.s > from && pk.s < to && pk.kind !== 'bulldozer') this.pickupPool.push(pk);
        else kp.push(pk);
      }
      this.pickups = kp;
    }
    if (cleared.length) this.events.push({ type: 'cleared', ids: cleared });
  }

  private despawn(): void {
    const limit = this.d - DESPAWN_BEHIND;
    if (this.obstacles.some((o) => o.s + o.depth < limit)) {
      const keep: Obstacle[] = [];
      for (const ob of this.obstacles) {
        if (ob.s + ob.depth < limit) this.obstaclePool.push(ob);
        else keep.push(ob);
      }
      this.obstacles = keep;
    }
    if (this.pickups.some((p) => p.s < limit || p.collected)) {
      const keep: Pickup[] = [];
      for (const pk of this.pickups) {
        if (pk.s < limit || pk.collected) this.pickupPool.push(pk);
        else keep.push(pk);
      }
      this.pickups = keep;
    }
    if (this.rows.length && this.rows[0].end < limit) this.rows = this.rows.filter((r) => r.end >= limit);
    if (this.reserved.length > 6) this.reserved = this.reserved.filter((r) => r.s1 > limit);
  }

  // ------------------------------------------------------------------ debug

  /** Remove obstacles for the next `metres` (input tests). */
  debugClearRoad(metres: number): void {
    this.clearAhead(this.d - 1, this.d + metres, false);
    this.genCursor = Math.max(this.genCursor, this.d + metres);
  }

  /** Fill the meter so the rival event starts at the next safe moment. */
  debugFillMeter(): void {
    this.meter = 100;
  }

  /** Simulate a recoverable collision without needing an obstacle. */
  debugStumble(): void {
    if (this.state !== 'RUNNING' && this.state !== 'EVENT_PENDING') return;
    const ob = this.spawnObstacle('barricade', this.player.lane, this.d, -1, false, false);
    this.onCrash(ob);
  }

  /** Grant a pickup immediately (tests / screenshots). */
  debugCollect(kind: PickupKind): void {
    this.spawnPickup({ kind, s: this.d, lane: this.player.lane, x: this.player.x, y: this.player.y + 0.9 });
    this.collect(this.pickups[this.pickups.length - 1]);
  }

  get chaseKind(): 'bulldozer' | 'cycle' {
    return this.cfg.rival === 'akhilesh' ? 'cycle' : 'bulldozer';
  }
}
