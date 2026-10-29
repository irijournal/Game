import {
  CHASE_CHALLENGE,
  CHASE_DODGE_REWARD,
  CHASE_FULL,
  CHASE_OPENING_CLEAR,
  CHASE_SHORT,
  CHASE_TOKEN_TIME,
  CINEMATIC_FULL,
  CINEMATIC_SHORT,
  DESPAWN_BEHIND,
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
  ACCEL,
} from './constants';
import { contactFor, isOverhead, supportFrom, type RunnerBox } from './collision';
import { buildChunk, placeCoins, type ChunkKind, type GenContext, type PickupSpec } from './generator';
import { missionValue, type ActiveMission, type MissionStat } from './missions';
import { OBSTACLES } from './obstacles';
import { Player } from './player';
import { Rng } from './rng';
import { ScoreKeeper, type ScoreBreakdown } from './scoring';
import { baseSpeedAt, challengeSpeed, difficultyAt } from './speed';
import { themeAt, themeIndexAt } from './themes';
import {
  THEME_ORDER,
  type Action,
  type CharacterId,
  type DirectorEventKind,
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
} from './types';

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
  heritageTokens: number;
  vikasRides: number;
  cleanDistance: number;
  laneChanges: number;
}

export type ChaseResult = 'none' | 'survived' | 'failed';
export type CinematicTrigger = 'stumble' | 'meter' | 'challenge';
export type EndReason = 'chase' | 'stumble' | 'completed' | 'quit';

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
}

export type SimEvent =
  | { type: 'coin'; id: number; value: number }
  | { type: 'pickup'; id: number; kind: PickupKind }
  | { type: 'jump' }
  | { type: 'slide' }
  | { type: 'land' }
  | { type: 'lane'; dir: -1 | 1 }
  | { type: 'bump'; obstacleId: number }
  | { type: 'dodge'; over: 'jump' | 'slide' | null; points: number }
  | { type: 'escape'; remaining: number }
  | { type: 'stumble'; obstacleId: number }
  | { type: 'state'; from: SimState; to: SimState }
  | { type: 'eventPending' }
  | { type: 'cinematicStart'; kind: 'full' | 'short'; trigger: CinematicTrigger }
  | { type: 'chaseStart'; duration: number }
  | { type: 'chaseEnd'; success: boolean; bonus: number }
  | { type: 'cleared'; ids: number[] }
  | { type: 'crash'; reason: 'chase' | 'stumble'; kind: ObstacleKind | null; cls: ObstacleClass | null }
  | { type: 'gameOver'; summary: RunSummary }
  | { type: 'mission'; id: string; title: string; reward: number; points: number }
  | { type: 'theme'; theme: ThemeId }
  | { type: 'discovery'; theme: ThemeId; points: number }
  | { type: 'director'; kind: DirectorEventKind; phase: 'warn' | 'start' | 'end' }
  | { type: 'powerup'; kind: 'magnet' | 'vikas'; phase: 'start' | 'end' }
  | { type: 'token'; kind: 'chaseToken' | 'heritageToken'; points: number }
  | { type: 'guard'; ready: boolean }
  | { type: 'hint'; cls: ObstacleClass };

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

const GUNDARAJ_KINDS = new Set<ObstacleKind>(['gundarajBoard', 'aframeSign', 'fileMountain', 'mediaVan', 'fileStack']);
const METER_PER_ROW = 3;
const METER_GUNDARAJ_BONUS = 3;
const MAX_OBSTACLE_REACH = 12;

/**
 * The whole game, minus rendering. Owns the finite-state machine
 *   RUNNING → EVENT_PENDING → CINEMATIC → CHASE → SUCCESS | FAILURE → RUNNING | GAME_OVER
 * (plus STUMBLE between a recoverable collision and the cinematic). Every
 * state has a timeout or an explicit exit, so no animation can freeze a run.
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
    heritageTokens: 0,
    vikasRides: 0,
    cleanDistance: 0,
    laneChanges: 0,
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
  speedRunT = 0;
  plannedEvents: PlannedEvent[] = [];
  private nextEventPlanS = 400;
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
  summary: RunSummary | null = null;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    this.speed = cfg.mode === 'B' ? challengeSpeed(0) : baseSpeedAt(0);
    this.player.reset(1);
    this.themeIndex = themeIndexAt(cfg.startTheme, 0);
    this.theme = cfg.startTheme;
    this.discovered = new Set([...cfg.discovered, cfg.startTheme]);
    this.missions = cfg.missions.map((m) => ({ ...m }));
    // Mode B starts with the chase; nothing spawns until it begins.
    this.genCursor = cfg.mode === 'B' ? Number.POSITIVE_INFINITY : 42;
    this.ensureAhead();
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
    switch (this.state) {
      case 'STUMBLE':
        this.stepWorld(dt * STUMBLE_TIMESCALE, false);
        if (this.stateTime >= STUMBLE_TIME) this.enterCinematic('stumble');
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
  private stepWorld(dt: number, collide: boolean): void {
    const box = this.runnerBox();
    let ground = 0;
    for (const ob of this.obstacles) if (this.near(ob)) ground = Math.max(ground, supportFrom(box, ob));
    this.player.step(dt, ground, false);
    const dd = this.speed * dt;
    this.d += dd;
    if (!collide) for (const ob of this.obstacles) if (this.near(ob)) ob.flags = 0;
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

  private targetSpeed(): number {
    const base = this.cfg.mode === 'B' ? challengeSpeed(this.chase.elapsed) : baseSpeedAt(this.d);
    let factor = 1;
    if (this.vikasT > 0) factor = SPEED_FACTOR.vikas;
    else if (this.speedRunT > 0) factor = SPEED_FACTOR.speedRun;
    else if (this.state === 'CHASE') factor = SPEED_FACTOR.chase;
    return base * factor;
  }

  /** Upper bound on speed at s, used to space obstacles. */
  vCons = (s: number): number => {
    if (this.cfg.mode === 'B') return challengeSpeed(CHASE_CHALLENGE) * SPEED_FACTOR.chase;
    return baseSpeedAt(s) * GEN_SPEED_MARGIN;
  };

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

    const target = this.targetSpeed();
    const dv = target - this.speed;
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
    const invulnerable = this.vikasT > 0 || this.state === 'SUCCESS';
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

    this.updatePickups(dt);
    this.updateRows();
    this.updateTheme();
    this.updateDirector();
    this.updateMissions();
    this.updateHints();

    switch (this.state) {
      case 'RUNNING':
        if (this.cfg.mode === 'B') {
          if (this.chase.count === 0 && this.stateTime >= 1.2) this.enterCinematic('challenge');
        } else if (this.meter >= 100 && this.vikasT <= 0 && this.d > 150) {
          this.setState('EVENT_PENDING');
          this.events.push({ type: 'eventPending' });
        }
        break;
      case 'EVENT_PENDING': {
        const clearTo = this.d + this.speed * 1.2;
        const clear = !this.obstacles.some((o) => !o.hit && o.s + o.depth > this.d - 0.5 && o.s < clearTo);
        if ((clear && p.grounded) || this.stateTime >= EVENT_PENDING_MAX) this.enterCinematic('meter');
        break;
      }
      case 'CHASE':
        this.chase.elapsed += dt;
        this.chase.remaining -= dt;
        if (this.chase.remaining <= 0) this.chaseSuccess();
        break;
      case 'SUCCESS':
        if (this.stateTime >= SUCCESS_TIME) {
          if (this.cfg.mode === 'B') this.finish('completed');
          else this.setState('RUNNING');
        }
        break;
    }

    this.ensureAhead();
    this.despawn();
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

  // ------------------------------------------------------------ transitions

  private onCrash(ob: Obstacle): void {
    this.stats.collisions++;
    this.cleanStart = this.d;
    if (this.state === 'CHASE') return this.fail('chase', ob);
    const recoverable =
      this.cfg.mode !== 'B' && this.guardReady && (this.state === 'RUNNING' || this.state === 'EVENT_PENDING');
    if (recoverable) this.stumble(ob);
    else this.fail('stumble', ob);
  }

  private stumble(ob: Obstacle): void {
    ob.hit = true;
    this.guardReady = false;
    this.guardT = 0;
    this.events.push({ type: 'guard', ready: false });
    this.inputs = [];
    this.player.sliding = false;
    this.clearAhead(this.d - 1, this.d + 10, true);
    this.setState('STUMBLE');
    this.events.push({ type: 'stumble', obstacleId: ob.id });
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
    this.clearAhead(this.d - 1, Number.POSITIVE_INFINITY, true);
    this.genCursor = Number.POSITIVE_INFINITY;
    this.setState('CINEMATIC');
    this.events.push({ type: 'cinematicStart', kind: this.cinematic.kind, trigger });
  }

  private enterChase(): void {
    const c = this.chase;
    c.active = true;
    c.total = this.cfg.mode === 'B' ? CHASE_CHALLENGE : this.cinematic.kind === 'full' ? CHASE_FULL : CHASE_SHORT;
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
    let bonus = this.score.addChaseComplete(c.escapes);
    if (this.cfg.mode === 'B') bonus += this.score.addBonus('challenge');
    this.meter = 0;
    if (!this.guardReady) this.guardT = GUARD_RECHARGE;
    // The chaser's parting gift: unoccupied road debris ahead is cleared.
    this.clearAhead(this.d + 0.5, Number.POSITIVE_INFINITY, false);
    this.genCursor = this.d + this.speed * (SUCCESS_TIME + 0.8);
    this.setState('SUCCESS');
    this.events.push({ type: 'chaseEnd', success: true, bonus });
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
    this.player.sliding = false;
    if (ob && ob.cls !== 'gap' && ob.cls !== 'high') this.d = Math.min(this.d, ob.s - PLAYER_HALF_D - 0.02);
    this.setState('FAILURE');
    this.events.push({ type: 'crash', reason, kind: ob?.kind ?? null, cls: ob?.cls ?? null });
  }

  private finish(reason: EndReason): void {
    if (this.state === 'GAME_OVER') return;
    this.stats.coins = this.coins;
    this.summary = {
      mode: this.cfg.mode,
      character: this.cfg.character,
      seed: this.cfg.seed,
      score: this.score.total,
      breakdown: this.score.breakdown(),
      distance: Math.floor(this.d),
      coins: this.coins,
      chaseResult: this.chaseResult,
      completed: reason === 'completed',
      reason,
      crashedInto: this.crashedInto?.kind ?? null,
      missionsCompleted: [...this.missionsCompleted],
      discoveries: [...this.discoveries],
      stats: { ...this.stats },
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
      if (this.magnetT > 0 && pk.kind === 'coin' && rel < 10 && rel > -1) pk.magnetized = true;
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
        this.magnetT = MAGNET_TIME;
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind });
        this.events.push({ type: 'powerup', kind: 'magnet', phase: 'start' });
        break;
      case 'vikas':
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind });
        this.startVikas();
        break;
      case 'chaseToken': {
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind });
        if (this.state === 'CHASE') {
          this.chase.remaining += CHASE_TOKEN_TIME;
          this.chase.total += CHASE_TOKEN_TIME;
          this.chase.tokens++;
        }
        const points = this.score.addBonus('chaseToken');
        this.events.push({ type: 'token', kind: 'chaseToken', points });
        break;
      }
      case 'heritageToken': {
        this.stats.heritageTokens++;
        this.events.push({ type: 'pickup', id: pk.id, kind: pk.kind });
        const points = this.score.addBonus('heritageToken');
        this.events.push({ type: 'token', kind: 'heritageToken', points });
        break;
      }
    }
  }

  private startVikas(): void {
    if (this.state !== 'RUNNING' && this.state !== 'SUCCESS') return;
    this.vikasT = VIKAS_TIME;
    this.stats.vikasRides++;
    const vEst = baseSpeedAt(this.d) * SPEED_FACTOR.vikas;
    const until = this.d + vEst * (VIKAS_TIME + 1.3);
    this.clearAhead(this.d + 0.5, Number.POSITIVE_INFINITY, true);
    let lane = this.player.lane as number;
    for (let s = this.d + 8, k = 0; s < until - 6; s += 2.6, k++) {
      if (k > 0 && k % 10 === 0) lane = Math.max(0, Math.min(2, lane + (this.rng.chance(0.5) ? 1 : -1)));
      this.spawnPickup({ kind: 'coin', s, lane: lane as 0 | 1 | 2, x: LANE_X[lane], y: 0.9 });
    }
    this.genCursor = until;
    this.events.push({ type: 'powerup', kind: 'vikas', phase: 'start' });
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
      if (this.state === 'RUNNING' && this.cfg.mode !== 'B') {
        const chaos = cells.some((c) => c.kind && GUNDARAJ_KINDS.has(c.kind));
        this.meter = Math.min(100, this.meter + METER_PER_ROW + (chaos ? METER_GUNDARAJ_BONUS : 0));
      }
      if (this.state === 'CHASE') {
        this.chase.remaining = Math.max(0, this.chase.remaining - CHASE_DODGE_REWARD);
        this.chase.escapes++;
        this.events.push({ type: 'escape', remaining: this.chase.remaining });
      }
    }
  }

  private updateTheme(): void {
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
        if (e.kind === 'speedRun' && this.d >= e.s0 - this.vCons(e.s0) * SPEED_RUN_WARNING && this.d < e.s0) {
          if (!(e as PlannedEvent & { warned?: boolean }).warned) {
            (e as PlannedEvent & { warned?: boolean }).warned = true;
            this.events.push({ type: 'director', kind: e.kind, phase: 'warn' });
          }
        }
        if (this.d >= e.s0) {
          e.started = true;
          if (e.kind === 'speedRun') {
            if (this.state === 'RUNNING' && this.vikasT <= 0) this.speedRunT = SPEED_RUN_TIME;
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

  private statValue(stat: MissionStat): number {
    switch (stat) {
      case 'distance':
        return Math.floor(this.d);
      case 'coins':
        return this.coins;
      case 'chasesSurvived':
        return this.stats.chasesSurvived;
      case 'jumpsOver':
        return this.stats.jumpsOver;
      case 'slidesUnder':
        return this.stats.slidesUnder;
      case 'cleanDistance':
        return Math.floor(this.stats.cleanDistance);
      case 'heritageTokens':
        return this.stats.heritageTokens;
      case 'vikasRides':
        return this.stats.vikasRides;
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

  private chunkContext(s: number): GenContext {
    const v = this.vCons;
    if (this.state === 'CHASE' || this.state === 'CINEMATIC') {
      const c = this.chase;
      let diff: number;
      if (this.cfg.mode === 'B') {
        const stage = (s - c.startS) / (v(s) * 10); // ~10 s per stage
        diff = Math.min(1, Math.max(0, stage / 2.4));
      } else {
        const prog = Math.min(1, (s - c.startS) / (v(s) * (c.total || CHASE_FULL)));
        diff = Math.min(1, 0.15 + 0.45 * prog + 0.4 * difficultyAt(s));
      }
      const opening = c.chunks === 0;
      return {
        kind: 'chase',
        theme: this.theme,
        distance: s,
        diff: opening ? 0 : diff,
        vAt: v,
        maxRows: opening ? 2 : undefined,
      };
    }
    const ev = this.plannedEventAt(s);
    const kind: ChunkKind = ev === 'developmentRoute' ? 'development' : ev === 'coinRush' ? 'coinRush' : 'normal';
    return { kind, theme: themeAt(this.cfg.startTheme, s), distance: s, diff: difficultyAt(s), vAt: v };
  }

  private plannedEventAt(s: number): DirectorEventKind | null {
    for (const e of this.plannedEvents) if (s >= e.s0 && s <= e.s1) return e.kind;
    return null;
  }

  private planEvents(s: number): void {
    if (this.cfg.mode === 'B' || this.state === 'CHASE' || this.state === 'CINEMATIC') return;
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

  private ensureAhead(): void {
    const ahead = Math.max(SPAWN_AHEAD_MIN, this.speed * SPAWN_AHEAD_TIME);
    let guard = 0;
    while (this.genCursor < this.d + ahead && guard++ < 8) {
      const start = this.genCursor;
      this.planEvents(start);
      const ctx = this.chunkContext(start);
      const rows = buildChunk(this.rng, ctx, start);
      for (const row of rows) this.spawnRow(row);

      const extras: PickupKind[] = [];
      if (ctx.kind === 'chase') {
        if (this.chase.tokensSpawned < 2 && this.chase.chunks > 0 && this.rng.chance(0.5)) {
          extras.push('chaseToken');
          this.chase.tokensSpawned++;
        }
        this.chase.chunks++;
      } else if (start > 350) {
        if (this.rng.chance(0.06) && this.magnetT <= 0) extras.push('magnet');
        else if (this.rng.chance(0.05) && this.vikasT <= 0) extras.push('vikas');
      }
      if (ctx.kind !== 'chase' && ctx.theme === 'heritage') {
        extras.push('heritageToken');
        if (this.rng.chance(0.6)) extras.push('heritageToken');
      }
      const coinChance = ctx.kind === 'coinRush' || ctx.kind === 'development' ? 1 : ctx.kind === 'chase' ? 0.8 : 0.65;
      if (this.rng.chance(coinChance) || extras.length) {
        for (const spec of placeCoins(this.rng, rows, start, this.vCons, extras)) this.spawnPickup(spec);
        if (ctx.kind === 'coinRush') {
          for (const spec of placeCoins(this.rng, rows, start, this.vCons)) {
            const dup = this.pickups.some((p) => !p.collected && p.lane === spec.lane && Math.abs(p.s - spec.s) < 1);
            if (!dup) this.spawnPickup(spec);
          }
        }
      }
      const last = rows[rows.length - 1];
      this.genCursor = last.end + this.rng.range(0.4, 0.9) * this.vCons(last.end);
    }
  }

  private spawnRow(row: Row): void {
    this.rows.push(row);
    let gantry = false;
    for (let lane = 0; lane < 3; lane++) {
      const cell = row.cells[lane];
      if (!cell.cls || !cell.kind) continue;
      const def = OBSTACLES[cell.kind];
      const ob = this.obstaclePool.pop() ?? ({} as Obstacle);
      ob.id = this.nextId++;
      ob.kind = cell.kind;
      ob.cls = def.cls;
      ob.lane = lane as 0 | 1 | 2;
      ob.s = row.s;
      ob.depth = def.depth;
      ob.bottom = def.bottom;
      ob.top = def.top;
      ob.halfW = def.halfW;
      ob.rowId = row.id;
      ob.gantry = def.cls === 'high' && !gantry;
      if (def.cls === 'high') gantry = true;
      ob.flags = 0;
      ob.hit = false;
      ob.passed = false;
      this.obstacles.push(ob);
    }
  }

  private spawnPickup(spec: PickupSpec): void {
    const pk = this.pickupPool.pop() ?? ({} as Pickup);
    pk.id = this.nextId++;
    pk.kind = spec.kind;
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
        if (pk.s > from && pk.s < to) this.pickupPool.push(pk);
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
  }

  // ------------------------------------------------------------------ debug

  /** Fill the meter so the rival event starts at the next safe moment. */
  debugFillMeter(): void {
    this.meter = 100;
  }

  /** Remove obstacles for the next `metres` (input tests). */
  debugClearRoad(metres: number): void {
    this.clearAhead(this.d - 1, this.d + metres, false);
    this.genCursor = Math.max(this.genCursor, this.d + metres);
  }

  /** Simulate a recoverable collision without needing an obstacle. */
  debugStumble(): void {
    if (this.state !== 'RUNNING' && this.state !== 'EVENT_PENDING') return;
    const ob = { id: -1, kind: 'barricade', cls: 'low', lane: this.player.lane, s: this.d, depth: 0.5, bottom: 0, top: 1, halfW: 0.95, rowId: -1, gantry: false, flags: 0, hit: false, passed: false } as Obstacle;
    this.onCrash(ob);
  }

  get invulnerable(): boolean {
    return this.vikasT > 0 || this.state === 'SUCCESS';
  }

  get chaseKind(): 'bulldozer' | 'cycle' {
    return this.cfg.rival === 'akhilesh' ? 'cycle' : 'bulldozer';
  }
}
