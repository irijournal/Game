import { Rng } from '../sim/rng';

export type Sfx =
  | 'coin'
  | 'jump'
  | 'slide'
  | 'lane'
  | 'bump'
  | 'stumble'
  | 'crash'
  | 'horn'
  | 'stinger'
  | 'success'
  | 'mission'
  | 'powerup'
  | 'click'
  | 'poof'
  | 'token'
  | 'bell'
  | 'warn';

export type Track = 'none' | 'menu' | 'lucknow' | 'heritage' | 'modern' | 'festival' | 'chase';

interface TrackDef {
  bpm: number;
  root: number;
  scale: number[];
  drums: string; // 16 steps: D=dha (low), n=na (high), c=clap, .=rest
  bass: number[]; // scale degrees per beat (4 per bar)
  density: number;
  drone: boolean;
}

const SCALES = {
  kafi: [0, 2, 3, 5, 7, 9, 10],
  bhairav: [0, 1, 4, 5, 7, 8, 11],
  pent: [0, 2, 4, 7, 9],
  yaman: [0, 2, 4, 6, 7, 9, 11],
};

const TRACKS: Record<Exclude<Track, 'none'>, TrackDef> = {
  menu: { bpm: 96, root: 57, scale: SCALES.yaman, drums: 'D..n..n.D.n.n...', bass: [0, 4, 3, 4], density: 0.45, drone: true },
  lucknow: { bpm: 116, root: 57, scale: SCALES.kafi, drums: 'D.nnD.n.D.nnD.nc', bass: [0, 0, 3, 4], density: 0.6, drone: true },
  heritage: { bpm: 92, root: 55, scale: SCALES.bhairav, drums: 'D...n.n.D...n.n.', bass: [0, 3, 4, 0], density: 0.4, drone: true },
  modern: { bpm: 124, root: 60, scale: SCALES.pent, drums: 'D.n.c.n.D.n.c.nn', bass: [0, 2, 3, 1], density: 0.65, drone: false },
  festival: { bpm: 132, root: 59, scale: SCALES.kafi, drums: 'DnnDc.nnDnnDc.nc', bass: [0, 3, 4, 3], density: 0.7, drone: true },
  chase: { bpm: 152, root: 52, scale: SCALES.bhairav, drums: 'D.nDD.nnD.nDDcnn', bass: [0, 0, 1, 0], density: 0.75, drone: false },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * Everything here is synthesised with WebAudio: no audio files to load,
 * original cues only. The context is created on the first user gesture
 * (browser autoplay rules) and every call is a safe no-op without it.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private track: Track = 'none';
  private nextStep = 0;
  private step = 0;
  private rng = new Rng(7);
  private droneNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private engineNodes: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  musicOn = true;
  sfxOn = true;

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? 0.34 : 0;
        this.sfxBus.gain.value = this.sfxOn ? 0.75 : 0;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // A track chosen before the first gesture had no context to play on.
        const pending = this.track;
        this.track = 'none';
        if (pending !== 'none') this.setTrack(pending);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.34 : 0, this.ctx.currentTime, 0.1);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.75 : 0, this.ctx.currentTime, 0.05);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------------------------------------------------------------- music

  setTrack(t: Track): void {
    if (t === this.track) return;
    this.track = t;
    this.stopDrone();
    if (!this.ctx) return;
    if (t === 'none') {
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      return;
    }
    this.step = 0;
    this.nextStep = this.ctx.currentTime + 0.06;
    this.rng = new Rng(t.length * 97 + 3);
    if (TRACKS[t].drone) this.startDrone(TRACKS[t].root - 12);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || this.track === 'none' || ctx.state !== 'running') return;
    const def = TRACKS[this.track];
    const stepDur = 60 / def.bpm / 4;
    while (this.nextStep < ctx.currentTime + 0.18) {
      const t = this.nextStep;
      const s = this.step % 16;
      const ch = def.drums[s];
      if (ch === 'D') this.tabla(t, true);
      else if (ch === 'n') this.tabla(t, false);
      else if (ch === 'c') this.clap(t);
      if (s % 4 === 0) {
        const deg = def.bass[(s / 4) % def.bass.length];
        this.bass(t, midi(def.root - 24 + def.scale[deg % def.scale.length]), stepDur * 3.5);
      }
      // Melody: a seeded random walk on the raga/scale, phrase per bar.
      if (s % 2 === 0 && this.rng.chance(def.density)) {
        const deg = Math.floor(this.rng.next() * def.scale.length * 1.6);
        const oct = Math.floor(deg / def.scale.length);
        const note = def.root + def.scale[deg % def.scale.length] + oct * 12;
        this.pluck(t, midi(note), stepDur * (this.rng.chance(0.3) ? 3 : 1.6));
      }
      this.nextStep += stepDur;
      this.step++;
    }
  }

  private env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  private pluck(t: number, f: number, dur: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f1 = ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f1.frequency.setValueAtTime(f * 8, t);
    f1.frequency.exponentialRampToValueAtTime(f * 2, t + dur);
    for (const [type, det] of [
      ['sawtooth', 0],
      ['triangle', 7],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * 1.03, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      o.detune.value = det;
      o.connect(f1);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    f1.connect(g).connect(this.musicBus);
    this.env(g, t, 0.005, 0.12, dur);
  }

  private bass(t: number, f: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    o.connect(g).connect(this.musicBus);
    this.env(g, t, 0.01, 0.22, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private tabla(t: number, low: boolean, bus?: GainNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(low ? 150 : 520, t);
    o.frequency.exponentialRampToValueAtTime(low ? 58 : 380, t + (low ? 0.18 : 0.06));
    const g = ctx.createGain();
    o.connect(g).connect(bus ?? this.musicBus);
    this.env(g, t, 0.003, low ? 0.5 : 0.18, low ? 0.25 : 0.12);
    o.start(t);
    o.stop(t + 0.35);
    this.noiseHit(t, low ? 900 : 3500, low ? 0.06 : 0.09, 0.04, bus);
  }

  private clap(t: number): void {
    this.noiseHit(t, 1600, 0.16, 0.08);
    this.noiseHit(t + 0.012, 1600, 0.12, 0.08);
  }

  private noiseHit(t: number, freq: number, peak: number, dur: number, bus?: GainNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(bus ?? this.musicBus);
    this.env(g, t, 0.002, peak, dur);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private startDrone(note: number): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const osc = [0, 7, 12].map((iv, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(note + iv);
      o.detune.value = i * 4 - 4;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(gain).connect(this.musicBus);
    this.droneNodes = { osc, gain };
  }

  private stopDrone(): void {
    if (!this.droneNodes || !this.ctx) return;
    const { osc, gain } = this.droneNodes;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
    osc.forEach((o) => o.stop(this.ctx!.currentTime + 1));
    this.droneNodes = null;
  }

  // ----------------------------------------------------------------- sfx

  engine(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 48;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.05;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.09, ctx.currentTime, 0.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(lp).connect(gain).connect(this.sfxBus);
      osc.start();
      lfo.start();
      this.engineNodes = { osc, lfo, gain };
    } else if (!on && this.engineNodes) {
      const n = this.engineNodes;
      n.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
      n.osc.stop(ctx.currentTime + 1.2);
      n.lfo.stop(ctx.currentTime + 1.2);
      this.engineNodes = null;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, at = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    o.connect(g).connect(this.sfxBus);
    this.env(g, t, 0.005, peak, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(s: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    switch (s) {
      case 'coin':
        this.tone('square', 1320, 1320, 0.05, 0.06);
        this.tone('square', 1760, 1760, 0.12, 0.06, 0.05);
        break;
      case 'jump':
        this.tone('square', 260, 720, 0.16, 0.08);
        break;
      case 'slide':
        this.noiseHit(now, 900, 0.25, 0.25, this.sfxBus);
        break;
      case 'lane':
        this.tone('sine', 520, 380, 0.05, 0.05);
        break;
      case 'bump':
        this.tone('sine', 140, 60, 0.18, 0.4);
        break;
      case 'stumble':
        this.tone('sine', 1300, 260, 0.55, 0.22);
        this.tone('triangle', 200, 90, 0.2, 0.5, 0.05);
        this.tabla(now, true, this.sfxBus);
        break;
      case 'crash':
        this.tabla(now, true, this.sfxBus);
        [0, 0.28, 0.56].forEach((at, i) => this.tone('sawtooth', 300 - i * 40, 260 - i * 50, 0.26, 0.12, at));
        this.tone('sawtooth', 180, 90, 0.8, 0.12, 0.84);
        break;
      case 'horn':
        this.tone('square', 392, 392, 0.22, 0.12);
        this.tone('square', 494, 494, 0.3, 0.12, 0.24);
        break;
      case 'stinger': {
        // Original dramatic brass-style chord with drum hits.
        [0, 0.18, 0.5].forEach((at, i) => {
          const base = [55, 55, 58][i];
          for (const iv of [0, 7, 12, 15]) this.tone('sawtooth', midi(base + iv), midi(base + iv) * 0.99, i === 2 ? 1.0 : 0.16, 0.05, at);
          this.tabla(now + at, true, this.sfxBus);
        });
        break;
      }
      case 'success':
        [0, 4, 7, 12, 16].forEach((iv, i) => this.tone('triangle', midi(72 + iv), midi(72 + iv), 0.18, 0.12, i * 0.08));
        break;
      case 'mission':
        [0, 7, 12].forEach((iv, i) => this.tone('sine', midi(84 + iv), midi(84 + iv), 0.3, 0.12, i * 0.1));
        break;
      case 'powerup':
        [0, 3, 7, 10, 14].forEach((iv, i) => this.tone('square', midi(67 + iv), midi(67 + iv), 0.08, 0.06, i * 0.05));
        break;
      case 'token':
        this.tone('triangle', midi(88), midi(88), 0.2, 0.12);
        this.tone('triangle', midi(93), midi(93), 0.3, 0.1, 0.08);
        break;
      case 'click':
        this.tone('sine', 900, 700, 0.04, 0.06);
        break;
      case 'poof':
        this.noiseHit(now, 500, 0.3, 0.3, this.sfxBus);
        break;
      case 'bell':
        this.tone('sine', midi(91), midi(91), 0.6, 0.1);
        break;
      case 'warn':
        this.tone('square', 880, 880, 0.08, 0.06);
        this.tone('square', 880, 880, 0.08, 0.06, 0.16);
        break;
    }
  }

  dispose(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.engine(false);
    this.stopDrone();
    void this.ctx?.close();
    this.ctx = null;
  }
}
