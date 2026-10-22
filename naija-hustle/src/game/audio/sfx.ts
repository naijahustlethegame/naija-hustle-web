import type { Kind } from "../engine/types";

/**
 * All the sound in the game, made in the browser with the Web Audio API: no audio files to download or license.
 * Horns differ by vehicle (a danfo's "pam pam" is nothing like a keke's squeak), okadas buzz like two-strokes,
 * sales ring a cashier bell, and a quiet street hum sits under everything.
 *
 * Browsers will not make a sound until the person has tapped something, so nothing plays before that. The choice to
 * mute is remembered. On the homepage the sound starts off (nobody wants a page that shouts); in the game it is on.
 */

const KEY = "naija-hustle:sound";
type Pref = "on" | "off" | null;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const jitter = (pct: number) => 1 + (Math.random() * 2 - 1) * pct;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private pref: Pref = null;
  private defaultOn = true;
  private level = 1;                      // scenes turn this down for the homepage
  private last = new Map<string, number>();
  private live = 0;
  private listeners = new Set<() => void>();
  private bedWanted = false; private rainWanted = false;
  private bed: { stop: () => void } | null = null; private rainBed: { stop: () => void } | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try { const v = localStorage.getItem(KEY); this.pref = v === "on" || v === "off" ? v : null; } catch { /* private mode */ }
    const unlock = () => this.unlock();
    for (const e of ["pointerdown", "keydown", "touchend"]) window.addEventListener(e, unlock, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend(); else if (this.isOn()) void this.ctx.resume().then(() => this.applyBeds());
    });
  }

  // ---------------------------------------------------------------- state the page can show
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.listeners.forEach((f) => f()); }
  isOn() { return (this.pref ?? (this.defaultOn ? "on" : "off")) === "on"; }

  /** What a scene wants when the person has not chosen yet, and how loud it should be. */
  configure(o: { defaultOn: boolean; level: number }) {
    this.defaultOn = o.defaultOn; this.level = o.level; this.applyGain(); this.emit();
  }
  /** Called from a button press, so the browser lets us start. */
  toggle() {
    this.pref = this.isOn() ? "off" : "on";
    try { localStorage.setItem(KEY, this.pref); } catch { /* private mode */ }
    this.unlock(); this.applyGain(); this.applyBeds(); this.emit();
    if (this.isOn()) this.horn("car", 480, 0.7);
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      const comp = this.ctx.createDynamicsCompressor(); // keeps a busy junction from clipping
      comp.threshold.value = -14; comp.ratio.value = 5;
      this.master = this.ctx.createGain(); this.master.connect(comp); comp.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf; this.applyGain();
    }
    if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume().then(() => this.applyBeds());
  }

  private applyGain() { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.isOn() ? 0.7 * this.level : 0, this.ctx.currentTime, 0.05); }

  /** Can we make a sound right now? Also stops one sound from firing over and over. */
  private ok(key: string, gapMs: number, cost = 1) {
    const c = this.ctx; if (!c || !this.master || c.state !== "running" || !this.isOn()) return false;
    const now = performance.now();
    if (now - (this.last.get(key) ?? -1e9) < gapMs || this.live + cost > 18) return false;
    this.last.set(key, now); return true;
  }
  private busy(sec: number, cost = 1) { this.live += cost; setTimeout(() => { this.live -= cost; }, sec * 1000 + 80); }
  private pan(x: number) { const p = this.ctx!.createStereoPanner?.(); if (p) p.pan.value = clamp((x - 480) / 480, -1, 1) * 0.8; return p; }
  /** Put a node chain's end onto the master, panned to where it is on the road. */
  private out(node: AudioNode, x: number, vol: number) {
    const c = this.ctx!, g = c.createGain(); g.gain.value = vol; node.connect(g);
    const p = this.pan(x); if (p) { g.connect(p); p.connect(this.master!); } else g.connect(this.master!);
    return g;
  }
  private osc(type: OscillatorType, freq: number, t0: number, t1: number) {
    const o = this.ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); o.start(t0); o.stop(t1); return o;
  }
  private env(g: GainNode, t0: number, peak: number, attack: number, hold: number, release: number) {
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }
  private noiseSrc(t0: number, t1: number, loop = false) {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noise; s.loop = loop; s.start(t0); if (!loop) s.stop(t1); return s;
  }

  // ---------------------------------------------------------------- horns
  /**
   * A car horn. Every vehicle sounds its own: cars blast two tones, a jeep is deeper, a danfo goes "pam pam",
   * a keke squeaks, an okada beeps. `delay` lets a queue of cars honk one after another.
   */
  horn(kind: Kind, x = 480, vol = 1, delay = 0) {
    if (!this.ok(`horn-${kind}`, 110)) return;
    const c = this.ctx!, t = c.currentTime + delay, p = jitter(0.05);
    const spec: Record<Kind, { f: [number, number]; type: OscillatorType; lp: number; len: number; blasts: number; gain: number }> = {
      car:   { f: [392, 494],  type: "sawtooth", lp: 2600, len: 0.32, blasts: 1, gain: 0.2 },
      jeep:  { f: [311, 392],  type: "sawtooth", lp: 1900, len: 0.42, blasts: 1, gain: 0.24 },
      danfo: { f: [247, 311],  type: "sawtooth", lp: 1500, len: 0.2,  blasts: 2, gain: 0.26 },
      keke:  { f: [784, 932],  type: "square",   lp: 3400, len: 0.1,  blasts: 2, gain: 0.1 },
      okada: { f: [659, 698],  type: "square",   lp: 3000, len: 0.13, blasts: 1, gain: 0.1 },
    };
    const s = spec[kind], total = s.blasts * (s.len + 0.13);
    this.busy(total + delay, 2);
    for (let b = 0; b < s.blasts; b++) {
      const t0 = t + b * (s.len + 0.13), mix = c.createGain(), lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = s.lp; mix.connect(lp);
      for (const f of s.f) { const o = this.osc(s.type, f * p, t0, t0 + s.len + 0.12); o.detune.value = (Math.random() - 0.5) * 14; o.connect(mix); }
      this.env(mix, t0, 1, 0.012, s.len - 0.04, 0.06);
      this.out(lp, x, vol * s.gain);
    }
  }

  // ---------------------------------------------------------------- engines
  /** A vehicle pulling away. Okadas and kekes buzz like two-strokes, a danfo growls like a diesel. */
  rev(kind: Kind, x = 480, vol = 1) {
    if (!this.ok(`rev-${kind}`, kind === "danfo" ? 260 : 140)) return;
    const c = this.ctx!, t = c.currentTime;
    const s = ({
      okada: { type: "sawtooth", a: 105, b: 230, am: 34, bp: 1100, len: 0.9, gain: 0.16 },
      keke:  { type: "sawtooth", a: 72,  b: 135, am: 24, bp: 700,  len: 1.0, gain: 0.15 },
      danfo: { type: "sawtooth", a: 44,  b: 84,  am: 0,  bp: 360,  len: 1.3, gain: 0.24 },
      car:   { type: "sawtooth", a: 62,  b: 150, am: 0,  bp: 520,  len: 0.9, gain: 0.12 },
      jeep:  { type: "sawtooth", a: 48,  b: 118, am: 0,  bp: 420,  len: 1.0, gain: 0.15 },
    } as const)[kind];
    this.busy(s.len);
    const o = this.osc(s.type, s.a * jitter(0.06), t, t + s.len);
    o.frequency.exponentialRampToValueAtTime(s.b * jitter(0.06), t + s.len * 0.85);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = s.bp; bp.Q.value = 0.9;
    const g = c.createGain(); this.env(g, t, 1, 0.06, s.len * 0.45, s.len * 0.5);
    o.connect(bp); bp.connect(g);
    if (s.am) { // the pulsing exhaust note of a small two-stroke engine
      const lfo = this.osc("square", s.am, t, t + s.len), depth = c.createGain(); depth.gain.value = 0.4;
      const am = c.createGain(); am.gain.value = 0.6; lfo.connect(depth); depth.connect(am.gain); g.connect(am);
      this.out(am, x, vol * s.gain * 1.6);
    } else this.out(g, x, vol * s.gain * 1.6);
    // a rumble underneath
    const n = this.noiseSrc(t, t + s.len), lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240;
    const ng = c.createGain(); this.env(ng, t, 1, 0.1, s.len * 0.3, s.len * 0.6); n.connect(lp); lp.connect(ng); this.out(ng, x, vol * 0.1);
  }

  /** Something driving past on the far side of the road, left to right, with the pitch dropping as it goes by. */
  pass(kind: Kind, vol = 1) {
    if (!this.ok(`pass-${kind}`, kind === "okada" ? 700 : 1500, 2)) return;
    const c = this.ctx!, t = c.currentTime, len = kind === "okada" ? 1.5 : 2.1;
    this.busy(len, 2);
    const base = ({ okada: 150, keke: 90, danfo: 55, car: 80, jeep: 62 } as const)[kind] * jitter(0.08);
    const o = this.osc("sawtooth", base * 1.07, t, t + len);
    o.frequency.linearRampToValueAtTime(base * 0.93, t + len);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = kind === "okada" ? 1000 : 520; bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + len * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(bp); bp.connect(g);
    let node: AudioNode = g;
    if (kind === "okada" || kind === "keke") {
      const lfo = this.osc("square", kind === "okada" ? 32 : 22, t, t + len), d = c.createGain(); d.gain.value = 0.4;
      const am = c.createGain(); am.gain.value = 0.6; lfo.connect(d); d.connect(am.gain); g.connect(am); node = am;
    }
    const gain = c.createGain(); gain.gain.value = vol * (kind === "okada" ? 0.2 : 0.16); node.connect(gain);
    const p = c.createStereoPanner?.();
    if (p) { p.pan.setValueAtTime(-0.85, t); p.pan.linearRampToValueAtTime(0.85, t + len); gain.connect(p); p.connect(this.master!); } else gain.connect(this.master!);
    const n = this.noiseSrc(t, t + len), hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200; // tyre hiss
    const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.03 * vol, t + len * 0.5); ng.gain.linearRampToValueAtTime(0.0001, t + len);
    n.connect(hp); hp.connect(ng); ng.connect(this.master!);
  }

  // ---------------------------------------------------------------- money
  /** The cashier's drawer: a thunk, a click, and a bell. `vol` is lower for sales other hustlers make. */
  cashier(vol = 1, x = 480) {
    if (!this.ok(vol < 0.5 ? "cash-far" : "cash", vol < 0.5 ? 350 : 80, 2)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(1.1, 2);
    const thunk = this.osc("sine", 230, t, t + 0.09); thunk.frequency.exponentialRampToValueAtTime(95, t + 0.08);
    const tg = c.createGain(); this.env(tg, t, 1, 0.003, 0.02, 0.07); thunk.connect(tg); this.out(tg, x, vol * 0.3);
    const n = this.noiseSrc(t, t + 0.06), hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const ng = c.createGain(); this.env(ng, t + 0.01, 1, 0.002, 0.01, 0.04); n.connect(hp); hp.connect(ng); this.out(ng, x, vol * 0.18);
    ([[1318.5, 0.12, 0.9], [1760, 0.19, 1.0], [2637, 0.19, 0.5], [3520, 0.19, 0.25]] as const).forEach(([f, at, decay]) => {
      const o = this.osc("sine", f, t + at, t + at + decay + 0.1), g = c.createGain();
      this.env(g, t + at, 1, 0.002, 0.01, decay); o.connect(g); this.out(g, x, vol * (f > 2000 ? 0.07 : 0.14));
    });
  }
  coin() {
    if (!this.ok("coin", 60)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.2);
    const o = this.osc("square", 1175, t, t + 0.2), g = c.createGain(); o.frequency.setValueAtTime(1760, t + 0.07);
    this.env(g, t, 1, 0.003, 0.1, 0.1); o.connect(g); this.out(g, 480, 0.07);
  }
  pickup() {
    if (!this.ok("pickup", 50)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.15);
    const o = this.osc("triangle", 520, t, t + 0.12), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(820, t + 0.08);
    this.env(g, t, 1, 0.003, 0.05, 0.07); o.connect(g); this.out(g, 480, 0.16);
  }
  /** A buyer turning you down. Quiet and low. */
  nope() {
    if (!this.ok("nope", 200)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.3);
    const o = this.osc("square", 190, t, t + 0.22), lp = c.createBiquadFilter(), g = c.createGain();
    o.frequency.exponentialRampToValueAtTime(120, t + 0.18); lp.type = "lowpass"; lp.frequency.value = 520;
    this.env(g, t, 1, 0.01, 0.1, 0.1); o.connect(lp); lp.connect(g); this.out(g, 480, 0.12);
  }

  // ---------------------------------------------------------------- the road bites back
  /** Knocked down by a car: a thump and a horn blast. */
  hit(x = 480) {
    if (!this.ok("hit", 300, 3)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.5, 3);
    const o = this.osc("sine", 150, t, t + 0.35); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    const g = c.createGain(); this.env(g, t, 1, 0.004, 0.06, 0.26); o.connect(g); this.out(g, x, 0.5);
    const n = this.noiseSrc(t, t + 0.25), lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    const ng = c.createGain(); this.env(ng, t, 1, 0.003, 0.03, 0.2); n.connect(lp); lp.connect(ng); this.out(ng, x, 0.3);
    this.last.delete("horn-car"); this.horn("car", x, 1.1);
  }
  /** A LASTMA officer's whistle: two sharp trills. */
  whistle(x = 480, vol = 1) {
    if (!this.ok("whistle", 800, 2)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.9, 2);
    [0, 0.34].forEach((at) => {
      const o = this.osc("sine", 2650, t + at, t + at + 0.27), lfo = this.osc("sine", 36, t + at, t + at + 0.27), d = c.createGain();
      d.gain.value = 140; lfo.connect(d); d.connect(o.frequency);
      const g = c.createGain(); this.env(g, t + at, 1, 0.01, 0.2, 0.05); o.connect(g); this.out(g, x, vol * 0.13);
    });
  }
  tick() {
    if (!this.ok("tick", 80)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.1);
    const o = this.osc("sine", 1040, t, t + 0.08), g = c.createGain(); this.env(g, t, 1, 0.002, 0.03, 0.04); o.connect(g); this.out(g, 480, 0.1);
  }
  go() {
    if (!this.ok("go", 200)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.3);
    const o = this.osc("square", 660, t, t + 0.3), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(1320, t + 0.15);
    this.env(g, t, 1, 0.004, 0.14, 0.12); o.connect(g); this.out(g, 480, 0.1);
  }
  thud() {
    if (!this.ok("thud", 150)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.3);
    const o = this.osc("sine", 130, t, t + 0.25), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(48, t + 0.2);
    this.env(g, t, 1, 0.004, 0.04, 0.18); o.connect(g); this.out(g, 480, 0.4);
  }
  jump() {
    if (!this.ok("jump", 120)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.2);
    const n = this.noiseSrc(t, t + 0.16), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.14);
    this.env(g, t, 1, 0.01, 0.05, 0.09); n.connect(bp); bp.connect(g); this.out(g, 480, 0.12);
  }
  fanfare() {
    if (!this.ok("fanfare", 500, 3)) return;
    const c = this.ctx!, t = c.currentTime; this.busy(0.9, 3);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = this.osc("triangle", f, t + i * 0.1, t + i * 0.1 + 0.4), g = c.createGain();
      this.env(g, t + i * 0.1, 1, 0.01, i === 3 ? 0.25 : 0.05, 0.12); o.connect(g); this.out(g, 480, 0.18);
    });
  }
  caught() {
    this.whistle(480, 1.2);
    if (!this.ok("caught", 600, 2)) return;
    const c = this.ctx!, t = c.currentTime + 0.5; this.busy(1.2, 2);
    const o = this.osc("sawtooth", 290, t, t + 0.7), lp = c.createBiquadFilter(), g = c.createGain();
    o.frequency.exponentialRampToValueAtTime(105, t + 0.6); lp.type = "lowpass"; lp.frequency.value = 800;
    this.env(g, t, 1, 0.02, 0.3, 0.3); o.connect(lp); lp.connect(g); this.out(g, 480, 0.16);
  }

  // ---------------------------------------------------------------- beds that run under the game
  /** The hum of a busy Lagos road. On while a street or a run is on screen. */
  ambience(on: boolean) { this.bedWanted = on; this.applyBeds(); }
  /** Rain hiss, for the rainy light. */
  rain(on: boolean) { this.rainWanted = on; this.applyBeds(); }

  private applyBeds() {
    const live = !!this.ctx && this.ctx.state === "running" && this.isOn();
    if (this.bedWanted && live && !this.bed) this.bed = this.startBed("hum");
    if ((!this.bedWanted || !live) && this.bed) { this.bed.stop(); this.bed = null; }
    if (this.rainWanted && live && !this.rainBed) this.rainBed = this.startBed("rain");
    if ((!this.rainWanted || !live) && this.rainBed) { this.rainBed.stop(); this.rainBed = null; }
  }
  private startBed(kind: "hum" | "rain") {
    const c = this.ctx!, t = c.currentTime, src = this.noiseSrc(t, 0, true), g = c.createGain();
    const lp = c.createBiquadFilter();
    if (kind === "hum") { lp.type = "lowpass"; lp.frequency.value = 260; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.09, t + 1.5); }
    else { lp.type = "highpass"; lp.frequency.value = 1800; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.05, t + 1.5); }
    src.connect(lp); lp.connect(g); g.connect(this.master!);
    // the hum rises and falls slowly, like traffic does
    let lfo: OscillatorNode | null = null;
    if (kind === "hum") {
      lfo = c.createOscillator(); lfo.frequency.value = 0.13; const d = c.createGain(); d.gain.value = 0.03; lfo.connect(d); d.connect(g.gain); lfo.start();
    }
    return { stop: () => { const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0.0001, n, 0.2); setTimeout(() => { try { src.stop(); lfo?.stop(); } catch { /* already stopped */ } }, 900); } };
  }
}

export const sfx = new Sfx();
