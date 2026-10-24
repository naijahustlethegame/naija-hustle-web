import { sfx } from "./sfx";

/**
 * A car at the light, now and then, has its radio on. Real Nigerian stations, played straight from the broadcaster.
 *
 * The scene decides WHICH car and keeps telling us how close it is (setLoudness). This file decides WHETHER a light gets
 * a radio at all, so it is rare and unpredictable instead of every red: a low chance per light, a rest of a couple of
 * lights after one plays, and never while the game is muted, hidden, or before the person has tapped anything.
 *
 * It uses a plain <audio> element, not Web Audio: broadcaster streams do not send CORS headers, and Web Audio would
 * silently output nothing for them.
 */

export type RadioStation = { id: string; name: string; streamUrl: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CFG = {
  chance: 0.2,        // chance that a given red light has a radio car
  restLights: 2,      // after one plays, this many lights go by with none
  maxPlaySec: 75,     // safety stop, in case a car somehow never leaves
  maxVolume: 0.5,     // the loudest it gets, before the game's own level is applied
  fadeInSec: 1.4,
  fadeOutSec: 1.0,
  retryLoadMs: 60_000,
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

class CarRadio {
  private stations: RadioStation[] | null = null;
  private loading = false; private retryAt = 0;
  private bad = new Set<string>();       // stations that failed to play this session
  private unlocked = false;              // browsers refuse audio until the person has tapped something
  private rest = 1;                      // lights still to skip (starts at 1 so the first light is always quiet)
  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private vol = 0; private loud = 0; private stopping = false; private startedAt = 0;
  private canSetVolume: boolean | null = null;

  /** Is a radio playing (or fading out) right now? */
  get active() { return !!this.audio?.src && this.timer !== null; }
  get playing() { return this.active && !this.stopping; }

  constructor() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.unlocked = true;
      for (const e of ["pointerdown", "keydown", "touchend"]) window.removeEventListener(e, unlock);
    };
    for (const e of ["pointerdown", "keydown", "touchend"]) window.addEventListener(e, unlock, { passive: true });
  }

  /**
   * Call once per red light. Returns a station if this light gets a radio car, otherwise null.
   * It does not start playing: the scene calls play() when the car is close enough to be heard.
   */
  tryStart(): RadioStation | null {
    if (typeof window === "undefined") return null;
    if (this.rest > 0) { this.rest--; return null; }
    if (!this.unlocked || !sfx.isOn() || document.hidden || this.audio) return null;
    if (Math.random() > CFG.chance) return null;
    if (!this.stations) { void this.load(); return null; }   // first time: fetch now, a later light will use it
    // https pages are not allowed to play http streams, so skip those
    const secure = location.protocol === "https:";
    const pool = this.stations.filter((s) => !this.bad.has(s.id) && (!secure || s.streamUrl.startsWith("https://")));
    if (!pool.length) return null;
    this.rest = CFG.restLights;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  play(st: RadioStation) {
    if (this.audio) return;
    const a = (this.audio = new Audio());
    a.preload = "none";
    this.vol = 0; this.loud = 0; this.stopping = false; this.startedAt = performance.now();
    this.apply(a, 0);
    a.addEventListener("error", () => { if (this.audio !== a) return; this.bad.add(st.id); this.rest = 0; this.stop(true); });
    a.src = st.streamUrl;
    a.play().catch(() => { this.bad.add(st.id); this.stop(true); });
    this.timer = setInterval(() => this.tick(), 60);
  }

  /** 0 to 1: how loud this car should be right now (far away is quiet, pulled up beside you is full). */
  setLoudness(k: number) { this.loud = clamp(k, 0, 1); }

  /** Fade out and stop. `immediate` cuts it at once (leaving the page, pausing the game). */
  stop(immediate = false) {
    if (!this.audio) return;
    if (immediate) { this.teardown(); return; }
    this.stopping = true;
  }

  private tick() {
    const a = this.audio; if (!a) return;
    if (!sfx.isOn() || document.hidden) { this.teardown(); return; }
    if (performance.now() - this.startedAt > CFG.maxPlaySec * 1000) this.stopping = true;
    const want = this.stopping ? 0 : CFG.maxVolume * this.loud * sfx.gain();
    const step = (CFG.maxVolume * 0.06) / (want > this.vol ? CFG.fadeInSec : CFG.fadeOutSec);
    this.vol = clamp(this.vol + clamp(want - this.vol, -step, step), 0, 1);
    this.apply(a, this.vol);
    if (this.stopping && this.vol <= 0.004) this.teardown();
  }

  /** Some phones (iOS) ignore volume changes. There the best we can do is mute until the car is close. */
  private apply(a: HTMLAudioElement, v: number) {
    if (this.canSetVolume === null) { a.volume = 0.5; this.canSetVolume = a.volume === 0.5; }
    if (this.canSetVolume) a.volume = v; else a.muted = v < CFG.maxVolume * 0.3;
  }

  private teardown() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const a = this.audio; this.audio = null; this.vol = 0; this.loud = 0; this.stopping = false;
    if (!a) return;
    a.pause(); a.removeAttribute("src"); a.load(); // closes the connection to the broadcaster
  }

  private async load() {
    if (this.loading || Date.now() < this.retryAt) return;
    this.loading = true;
    try {
      const r = await fetch(`${API}/radio/stations`);
      if (!r.ok) throw new Error("radio");
      const { data } = (await r.json()) as { data?: RadioStation[] };
      this.stations = Array.isArray(data) ? data.filter((s) => s?.id && s.name && s.streamUrl) : [];
      if (!this.stations.length) { this.stations = null; this.retryAt = Date.now() + CFG.retryLoadMs; }
    } catch {
      this.retryAt = Date.now() + CFG.retryLoadMs; // no radio for now, the game carries on
    } finally { this.loading = false; }
  }
}

export const carRadio = new CarRadio();
