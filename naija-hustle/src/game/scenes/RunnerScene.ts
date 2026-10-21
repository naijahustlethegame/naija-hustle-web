import { drawAvatar, type AvatarConfig } from "../avatar/avatar";
import { CAPACITY, ITEMS, countStock, emptyStock } from "../engine/items";
import type { Market } from "../engine/markets";
import { DISPLAY_FONT } from "../engine/layout";
import { Loop } from "../engine/loop";
import { H, W, type ItemId, type Stock } from "../engine/types";

/**
 * The market run: a temple-run style dash through a Lagos back street.
 * Pseudo-3D: everything is a sprite scaled by distance. Lanes are -1, 0, 1.
 * The scene is pure game logic and drawing; paying the fee and saving the result is the React side's job.
 */

// ---- tuning ----
export const RUN_DIST = 960;      // world units to the finish gate
const BASE_SPEED = 20;            // units per second at the start
const RAMP_SPEED = 10;            // extra units per second by the finish
const ROW_GAP: [number, number] = [32, 23]; // gap between obstacle rows, start and end of the run
const JUMP_V = 9, GRAVITY = 26, CLEAR_H = 0.55; // jump power, gravity, height needed to clear a low obstacle
const SLOW_SECS = 1.2;            // slowdown after a stumble
const CHASE_SECS = 7;             // how long the officer stays on your heels after a stumble
const LANE_SPEED = 9;             // lane lerp, lanes per second
const COUNTDOWN = 0.8;            // seconds per count
const PRE_SPEED = 12;             // scroll speed during the countdown
const CASH_ODDS = [0.6, 0.3, 0.1];

// ---- projection ----
const HZ = 150, GY = 470, VX = 480, K = 10, FAR = 75, LANE_W = 150, ROAD_HALF = 240;
const INK = "#1b1b22";
const sOf = (rel: number) => K / (K + rel);
const yOf = (s: number) => HZ + (GY - HZ) * s;
const xOf = (X: number, s: number) => VX + X * s;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (n: number) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BADGE: Record<ItemId, string> = {
  water: "#4cc3ff", drink: "#ff7a59", snack: "#ffc23d", gadget: "#9b6bff",
  fruit: "#ff9f2e", bread: "#d9a066", charger: "#8bc34a", shades: "#34495e", perfume: "#ff6fae",
};

type OKind = "lastma" | "danfo" | "okada" | "pothole" | "crate" | "item" | "cash";
type Obj = { kind: OKind; lane: number; z: number; used: boolean; item?: ItemId; cash?: number; seed: number };
type Pop = { x: number; y: number; t: number; text: string; color: string; size: number };
export type RunPhase = "idle" | "countdown" | "run" | "caught" | "finished";
export type RunResult = {
  outcome: "finished" | "caught";
  items: Stock;     // what you picked up and had room for
  dropped: number;  // pickups that did not fit on your tray
  cash: number;     // cash bundles collected
  stumbles: number;
};
type Opts = { avatar: AvatarConfig; market: Market; reducedMotion?: boolean; onEnd: (r: RunResult) => void };

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, r)); c.fill();
}
function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fill();
}

export class RunnerScene {
  private ctx: CanvasRenderingContext2D;
  private loop: Loop;
  private bg: HTMLCanvasElement;
  private bgs: Record<string, HTMLCanvasElement> = {};
  private market: Market;
  private reduced: boolean;

  private phase: RunPhase = "idle";
  private t = 0; private cd = 0; private endT = 0; private ended = false;
  private dist = 0; private speed = 0; private slowT = 0; private chase = 0; private shake = 0; private flash = 0;
  private lane = 0; private target = 0;
  private jumpH = 0; private vy = 0;
  private stumbles = 0;
  private objs: Obj[] = []; private pops: Pop[] = [];
  private nextZ = 45; private free = 0; private rng: () => number = Math.random;
  private space = CAPACITY;
  private items: Stock = emptyStock(); private dropped = 0; private cash = 0;
  private startX = 0; private startY = 0; private down = false;

  private onKey = (e: KeyboardEvent) => this.key(e);
  private onDown = (e: PointerEvent) => { this.down = true; this.startX = e.clientX; this.startY = e.clientY; };
  private onUp = (e: PointerEvent) => this.release(e);

  constructor(private canvas: HTMLCanvasElement, private opts: Opts) {
    this.reduced = !!opts.reducedMotion;
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.market = opts.market;
    this.bg = this.bgFor(this.market);
    this.loop = new Loop((dt) => this.update(dt), () => this.draw());
    window.addEventListener("keydown", this.onKey);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
  }

  start() { this.loop.start(); }
  pause() { this.loop.stop(); }
  resume() { this.loop.start(); }
  destroy() {
    this.loop.stop();
    window.removeEventListener("keydown", this.onKey);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
  }

  /** Change where the run goes. Ignored while a run is in progress. */
  setMarket(m: Market) {
    if (this.active) return;
    this.market = m; this.bg = this.bgFor(m);
  }
  private bgFor(m: Market) { return (this.bgs[m.id] ??= this.renderBg(m)); }

  /** Start a run. `space` is how many more things your tray can hold. */
  begin(space: number) {
    this.space = Math.max(0, space);
    this.rng = mulberry((Math.random() * 4294967296) >>> 0);
    this.dist = 0; this.speed = 0; this.slowT = 0; this.chase = 0; this.shake = 0; this.flash = 0;
    this.lane = 0; this.target = 0; this.jumpH = 0; this.vy = 0; this.stumbles = 0;
    this.objs = []; this.pops = []; this.nextZ = COUNTDOWN * 4 * PRE_SPEED + 45; this.free = 0; // first row is 45 units ahead when RUN! appears
    this.items = emptyStock(); this.dropped = 0; this.cash = 0; this.ended = false; this.endT = 0;
    this.phase = "countdown"; this.cd = 0;
  }

  // ---------- input ----------
  get active() { return this.phase === "countdown" || this.phase === "run"; }
  moveLane(d: number) { if (this.active) this.target = clamp(this.target + d, -1, 1); }
  jump() { if (this.phase === "run" && this.jumpH === 0 && this.vy === 0) this.vy = JUMP_V; }

  private key(e: KeyboardEvent) {
    if (!this.active) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") this.moveLane(-1);
    else if (k === "ArrowRight" || k === "d" || k === "D") this.moveLane(1);
    else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") this.jump();
    else return;
    e.preventDefault();
  }
  private release(e: PointerEvent) {
    if (!this.down) return; this.down = false;
    if (!this.active) return;
    const dx = e.clientX - this.startX, dy = e.clientY - this.startY;
    if (Math.abs(dy) > 40 && dy < 0 && Math.abs(dy) > Math.abs(dx)) { this.jump(); return; }
    if (Math.abs(dx) > 40) { this.moveLane(dx < 0 ? -1 : 1); return; }
    const r = this.canvas.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    if (fx < 0.33) this.moveLane(-1); else if (fx > 0.67) this.moveLane(1); else this.jump();
  }

  // ---------- world generation ----------
  private weighted<T extends string>(odds: Record<T, number>): T {
    const keys = Object.keys(odds) as T[]; let r = this.rng() * keys.reduce((a, k) => a + odds[k], 0);
    for (const k of keys) { r -= odds[k]; if (r <= 0) return k; }
    return keys[keys.length - 1];
  }
  private push(kind: OKind, lane: number, z: number, extra: Partial<Obj> = {}) {
    this.objs.push({ kind, lane, z, used: false, seed: Math.floor(this.rng() * 1e6), ...extra });
  }
  private solid(): OKind { const r = this.rng(); return r < 0.5 ? "lastma" : r < 0.8 ? "danfo" : "okada"; }
  private low(): OKind { return this.rng() < 0.55 ? "pothole" : "crate"; }

  /** One row of obstacles, then maybe a trail of pickups. At least one lane is always clear of solid things. */
  private spawnRow() {
    const z = this.nextZ, p = Math.min(1, z / RUN_DIST);
    const r = this.rng();
    let f = this.free;
    if (r < 0.28) f = Math.max(-1, f - 1); else if (r < 0.56) f = Math.min(1, f + 1);
    this.free = f; // drifts by at most one lane, so the next row is always reachable
    if (this.rng() < 0.33) {
      let n = 0;
      for (const lane of [-1, 0, 1]) if (this.rng() < (lane === f ? 0.45 : 0.75)) { this.push(this.low(), lane, z); n++; }
      if (n === 0) this.push(this.low(), Math.floor(this.rng() * 3) - 1, z);
    } else {
      for (const lane of [-1, 0, 1]) {
        if (lane === f) continue;
        const q = this.rng();
        if (q < 0.7) this.push(this.solid(), lane, z); else if (q < 0.85) this.push(this.low(), lane, z);
      }
    }
    if (this.rng() < 0.45) {
      const lane = this.rng() < 0.7 ? f : [-1, 0, 1][Math.floor(this.rng() * 3)];
      const n = 2 + Math.floor(this.rng() * 2);
      for (let i = 0; i < n; i++) {
        const zz = z + 6 + i * 4.5;
        if (this.rng() < this.market.cashChance) {
          const c = this.weighted(Object.fromEntries(this.market.cash.map((v, i2) => [String(v), CASH_ODDS[i2]])) as Record<string, number>);
          this.push("cash", lane, zz, { cash: Number(c) });
        } else this.push("item", lane, zz, { item: this.weighted(this.market.items as Record<ItemId, number>) });
      }
    }
    this.nextZ += lerp(ROW_GAP[0], ROW_GAP[1], p) + this.rng() * 4;
  }

  // ---------- simulation ----------
  private update(dt: number) {
    this.t += dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.flash > 0) this.flash -= dt;
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.2);
    this.lane += clamp(this.target - this.lane, -LANE_SPEED * dt, LANE_SPEED * dt);

    if (this.phase === "idle") { this.dist += 9 * dt; return; }
    if (this.phase === "countdown") {
      this.dist += PRE_SPEED * dt; this.cd += dt;
      while (this.nextZ < this.dist + FAR) this.spawnRow();
      if (this.cd >= COUNTDOWN * 4) { this.phase = "run"; this.pops.push({ x: W / 2, y: 190, t: 0, text: "RUN!", color: "#7dffa8", size: 54 }); }
      return;
    }
    if (this.phase === "run") this.updateRun(dt);
    else {
      // caught or finished: roll to a stop, then report once
      this.speed = Math.max(0, this.speed - 60 * dt); this.dist += this.speed * dt;
      this.endT += dt;
      if (this.endT > (this.phase === "caught" ? 1.6 : 1.3) && !this.ended) { this.ended = true; this.opts.onEnd(this.result()); }
    }
    this.chase = Math.max(0, this.chase - dt / CHASE_SECS);
    if (this.vy !== 0 || this.jumpH > 0) this.airborne(dt);
  }

  private airborne(dt: number) {
    this.vy -= GRAVITY * dt; this.jumpH += this.vy * dt;
    if (this.jumpH <= 0) { this.jumpH = 0; this.vy = 0; }
  }

  private updateRun(dt: number) {
    const progress = this.dist / RUN_DIST;
    if (this.slowT > 0) this.slowT -= dt;
    const mul = this.slowT > 0 ? 0.5 + 0.5 * (1 - this.slowT / SLOW_SECS) : 1;
    this.speed = (BASE_SPEED + RAMP_SPEED * progress) * mul;
    this.dist += this.speed * dt;
    while (this.nextZ < this.dist + FAR && this.nextZ < RUN_DIST - 20) this.spawnRow();

    for (const o of this.objs) {
      if (o.used) continue;
      const rel = o.z - this.dist;
      if (rel > 1.2 || rel < -0.9 || Math.abs(o.lane - this.lane) > 0.55) continue;
      if (o.kind === "item" || o.kind === "cash") this.collect(o);
      else if (o.kind === "pothole" || o.kind === "crate") {
        o.used = true;
        if (this.jumpH > CLEAR_H) { this.pop(o.lane, "Clean!", "#bfffd6", 26); continue; }
        this.stumbles++; this.slowT = SLOW_SECS; this.chase = 1; this.shake = 0.35; this.flash = 0.18;
        this.pop(o.lane, "Stumble!", "#ffb4ab", 30);
        if (this.stumbles >= 2) { this.caught(); return; }
      } else { o.used = true; this.caught(); return; }
    }
    this.objs = this.objs.filter((o) => o.z - this.dist > -4);
    if (this.dist >= RUN_DIST) {
      this.phase = "finished"; this.endT = 0;
      this.pops.push({ x: W / 2, y: 190, t: 0, text: this.market.name.toUpperCase() + "!", color: "#ffd84a", size: 44 });
    }
  }

  private pop(lane: number, text: string, color: string, size = 24) {
    this.pops.push({ x: xOf(lane * LANE_W, 1), y: GY - 130, t: 0, text, color, size });
  }

  private collect(o: Obj) {
    o.used = true;
    if (o.kind === "cash") {
      this.cash += o.cash ?? 0; this.pop(o.lane, `+₦${o.cash}`, "#7dffa8", 28);
    } else if (o.item) {
      if (countStock(this.items) >= this.space) { this.dropped++; this.pop(o.lane, "Tray full!", "#ffd0a0", 24); }
      else { this.items[o.item]++; this.pop(o.lane, `+${ITEMS[o.item].icon}`, "#ffffff", 32); }
    }
  }

  private caught() {
    this.phase = "caught"; this.endT = 0; this.shake = 0.6; this.flash = 0.35;
    this.pops.push({ x: W / 2, y: 190, t: 0, text: "LASTMA CAUGHT YOU!", color: "#ff8a80", size: 48 });
  }

  private result(): RunResult {
    return { outcome: this.phase === "finished" ? "finished" : "caught", items: { ...this.items }, dropped: this.dropped, cash: this.cash, stumbles: this.stumbles };
  }

  // ---------- drawing ----------
  private text(s: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = "left", maxW?: number) {
    const c = this.ctx;
    c.font = `${size}px ${DISPLAY_FONT}`; c.textAlign = align;
    c.lineWidth = Math.max(3, size / 6); c.strokeStyle = "rgba(20,12,4,.85)"; c.lineJoin = "round";
    c.strokeText(s, x, y, maxW); c.fillStyle = fill; c.fillText(s, x, y, maxW);
  }
  private panel(x: number, y: number, w: number, h: number, fill = "rgba(27,27,34,.88)") { rr(this.ctx, x, y, w, h, 12, fill); }

  /** Sky, sun, far skyline and the ground, drawn once per market. */
  private renderBg(m: Market): HTMLCanvasElement {
    const o = document.createElement("canvas"); o.width = W; o.height = H;
    const c = o.getContext("2d")!, L = m.look;
    const g = c.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, L.skyTop); g.addColorStop(1, L.skyBottom);
    c.fillStyle = g; c.fillRect(0, 0, W, HZ + 2);
    c.fillStyle = L.sun; c.beginPath(); c.arc(L.sunX, 96, 40, 0, Math.PI * 2); c.fill();
    const cols = L.skylineColors;
    for (let i = 0, x = -10; x < W; i++) {
      if (L.skyline === "shacks") {
        const bw = 44 + hash(i * 3 + 1) * 40, bh = 16 + hash(i * 3 + 2) * 30, top = HZ - bh;
        c.fillStyle = cols[i % cols.length]; c.fillRect(x, top, bw, bh + 2);
        c.fillStyle = "#9aa0a6"; c.beginPath(); c.moveTo(x - 3, top + 2); c.lineTo(x + bw + 3, top + 2); c.lineTo(x + bw, top - 6); c.lineTo(x, top - 6); c.fill();
        c.fillStyle = "rgba(40,24,12,.5)"; for (let wx = x + 7; wx < x + bw - 9; wx += 14) c.fillRect(wx, top + 8, 7, 8);
        x += bw + 3;
      } else if (L.skyline === "glass") {
        const bw = 30 + hash(i * 3 + 1) * 30, bh = 50 + hash(i * 3 + 2) * 80, top = HZ - bh;
        const gg = c.createLinearGradient(x, top, x + bw, HZ); gg.addColorStop(0, cols[0]); gg.addColorStop(1, cols[1]);
        c.fillStyle = gg; c.fillRect(x, top, bw, bh + 2);
        c.strokeStyle = L.lit; c.lineWidth = 1;
        for (let wx = x + 6; wx < x + bw; wx += 7) { c.beginPath(); c.moveTo(wx, top + 3); c.lineTo(wx, HZ); c.stroke(); }
        for (let wy = top + 11; wy < HZ; wy += 11) { c.beginPath(); c.moveTo(x, wy); c.lineTo(x + bw, wy); c.stroke(); }
        x += bw + 6 + hash(i + 11) * 14;
      } else {
        const bw = 34 + hash(i * 3 + 1) * 46, bh = 26 + hash(i * 3 + 2) * 58;
        c.fillStyle = cols[i % cols.length]; c.fillRect(x, HZ - bh, bw, bh + 2);
        c.fillStyle = L.lit;
        for (let wy = HZ - bh + 6; wy < HZ - 6; wy += 11) for (let wx = x + 5; wx < x + bw - 7; wx += 10) if (hash(i * 97 + wx + wy) > 0.5) c.fillRect(wx, wy, 4, 5);
        x += bw + 2;
      }
    }
    const gr = c.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, L.ground[0]); gr.addColorStop(1, L.ground[1]);
    c.fillStyle = gr; c.fillRect(0, HZ, W, H - HZ);
    return o;
  }

  private strip(z0: number, z1: number, xa: number, xb: number, fill: string) {
    const c = this.ctx, s0 = sOf(z0), s1 = sOf(z1), y0 = yOf(s0), y1 = yOf(s1);
    c.fillStyle = fill; c.beginPath();
    c.moveTo(xOf(xa, s0), y0); c.lineTo(xOf(xb, s0), y0); c.lineTo(xOf(xb, s1), y1); c.lineTo(xOf(xa, s1), y1); c.closePath(); c.fill();
  }

  private drawRoad() {
    const c = this.ctx, sb = (H - HZ) / (GY - HZ);
    c.fillStyle = this.market.look.road; c.beginPath(); c.moveTo(VX, HZ); c.lineTo(VX + ROAD_HALF * sb, H); c.lineTo(VX - ROAD_HALF * sb, H); c.closePath(); c.fill();
    // painted kerbs and lane dashes scroll with distance
    const kp = 8, ko = this.dist % (kp * 2), dp = 8, dof = this.dist % dp;
    for (let k = -1; k * kp - ko < FAR; k++) {
      const z0 = k * kp - ko, z1 = z0 + kp, col = (Math.floor((this.dist + k * kp - ko) / kp) % 2 === 0) ? "#f2c200" : INK;
      if (z1 < -4) continue;
      for (const side of [-1, 1]) this.strip(Math.max(-4, z0), Math.min(FAR, z1), side * ROAD_HALF, side * (ROAD_HALF + 16), col);
    }
    for (let k = -1; k * dp - dof < FAR; k++) {
      const z0 = k * dp - dof, z1 = z0 + 3.5;
      if (z1 < -4) continue;
      for (const bx of [-LANE_W / 2, LANE_W / 2]) this.strip(Math.max(-4, z0), Math.min(FAR, z1), bx - 3.5, bx + 3.5, "rgba(245,240,200,.85)");
    }
  }

  private draw() {
    const c = this.ctx;
    c.save();
    if (this.shake > 0 && !this.reduced) c.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    c.drawImage(this.bg, 0, 0, W, H);
    this.drawRoad();

    // sprites: roadside scenery, obstacles and pickups, far to near
    type Sp = { rel: number; paint: () => void };
    const sprites: Sp[] = [];
    const i0 = Math.floor((this.dist - 6) / 14), i1 = Math.ceil((this.dist + FAR) / 14);
    for (let i = i0; i <= i1; i++) {
      for (const side of [-1, 1]) {
        const rel = i * 14 - this.dist, h = hash(i * 2 + (side > 0 ? 1 : 0) + 7);
        if (rel < -6 || rel > FAR) continue;
        sprites.push({ rel, paint: () => this.scenery(rel, side, h, i) });
      }
      if (i % 2 === 0) { const rel = i * 14 - this.dist; if (rel >= -6 && rel <= FAR) for (const side of [-1, 1]) sprites.push({ rel, paint: () => this.pole(rel, side) }); }
    }
    for (const o of this.objs) {
      const rel = o.z - this.dist;
      if (rel > FAR || rel < -2 || (o.used && (o.kind === "item" || o.kind === "cash"))) continue;
      sprites.push({ rel, paint: () => this.object(o, rel) });
    }
    if (this.dist > RUN_DIST - FAR - 5) sprites.push({ rel: RUN_DIST - this.dist, paint: () => this.gate(RUN_DIST - this.dist) });
    sprites.sort((a, b) => b.rel - a.rel);
    for (const s of sprites) if (s.rel >= 0) s.paint();
    this.drawPlayer();
    for (const s of sprites) if (s.rel < 0) s.paint();

    this.speedLines();
    this.drawChaser();
    c.restore();
    if (this.flash > 0) { c.fillStyle = `rgba(228,56,47,${Math.min(0.35, this.flash * 1.4)})`; c.fillRect(0, 0, W, H); }
    this.drawPops();
    this.drawHud();
    this.drawOverlay();
  }

  private fade(rel: number) { return clamp((FAR - rel) / 12, 0, 1); }

  private object(o: Obj, rel: number) {
    const c = this.ctx, s = sOf(rel), x = xOf(o.lane * LANE_W, s), gy = yOf(s);
    c.save(); c.globalAlpha = this.fade(rel);
    switch (o.kind) {
      case "lastma": this.officer(x, gy, s * 1.9, o.seed % 7); break;
      case "danfo": this.danfo(x, gy, s); break;
      case "okada": this.okada(x, gy, s, o.seed); break;
      case "pothole": {
        c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(x, gy - 4 * s, 66 * s, 15 * s, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#0f0f13"; c.beginPath(); c.ellipse(x, gy - 6 * s, 56 * s, 11 * s, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#6c6c76"; c.lineWidth = Math.max(1, 3 * s); c.beginPath(); c.ellipse(x, gy - 6 * s, 58 * s, 12 * s, 0, 0, Math.PI * 2); c.stroke();
        break;
      }
      case "crate": {
        c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(x, gy - 2 * s, 46 * s, 9 * s, 0, 0, Math.PI * 2); c.fill();
        rr(c, x - 35 * s, gy - 50 * s, 70 * s, 48 * s, 3 * s, "#b87b3d");
        c.strokeStyle = "#6e4519"; c.lineWidth = Math.max(1, 3 * s);
        c.strokeRect(x - 35 * s, gy - 50 * s, 70 * s, 48 * s);
        c.beginPath(); c.moveTo(x - 35 * s, gy - 34 * s); c.lineTo(x + 35 * s, gy - 34 * s); c.moveTo(x - 35 * s, gy - 18 * s); c.lineTo(x + 35 * s, gy - 18 * s);
        c.moveTo(x - 35 * s, gy - 2 * s); c.lineTo(x + 35 * s, gy - 50 * s); c.stroke();
        break;
      }
      case "item": case "cash": {
        const bob = Math.sin(this.t * 5 + o.seed) * 6 * s, by = gy - 52 * s + bob, r = 24 * s;
        c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(x, gy - 2 * s, 20 * s, 5 * s, 0, 0, Math.PI * 2); c.fill();
        if (o.kind === "cash") {
          rr(c, x - 30 * s, by - 17 * s, 60 * s, 34 * s, 6 * s, "#2fbf71");
          c.strokeStyle = "#fff"; c.lineWidth = Math.max(1, 3 * s); c.beginPath(); c.roundRect(x - 30 * s, by - 17 * s, 60 * s, 34 * s, 6 * s); c.stroke();
          c.fillStyle = "#fff"; c.font = `${Math.max(6, 18 * s)}px ${DISPLAY_FONT}`; c.textAlign = "center"; c.fillText(`₦${o.cash}`, x, by + 6 * s);
        } else if (o.item) {
          dot(c, x, by, r, BADGE[o.item]);
          c.strokeStyle = "#fff"; c.lineWidth = Math.max(1, 3 * s); c.beginPath(); c.arc(x, by, r, 0, Math.PI * 2); c.stroke();
          c.font = `${Math.max(6, 28 * s)}px sans-serif`; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(ITEMS[o.item].icon, x, by + 10 * s);
        }
        break;
      }
    }
    c.restore();
  }

  /** LASTMA officer, front on, arms out to block the lane. Same figure chases you when you stumble. */
  private officer(x: number, gy: number, s: number, variant: number, wave = true) {
    const c = this.ctx, w = wave ? Math.sin(this.t * 6 + variant) * 3 * s : 0;
    c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(x, gy, 20 * s, 5 * s, 0, 0, Math.PI * 2); c.fill();
    rr(c, x - 13 * s, gy - 44 * s, 10 * s, 44 * s, 2 * s, "#2a2d36"); rr(c, x + 3 * s, gy - 44 * s, 10 * s, 44 * s, 2 * s, "#2a2d36");
    rr(c, x - 14 * s, gy - 4 * s, 12 * s, 4 * s, 1, INK); rr(c, x + 2 * s, gy - 4 * s, 12 * s, 4 * s, 1, INK);
    rr(c, x - 36 * s, gy - 84 * s + w, 20 * s, 8 * s, 4 * s, "#c9b56d"); rr(c, x + 16 * s, gy - 84 * s - w, 20 * s, 8 * s, 4 * s, "#c9b56d"); // arms
    dot(c, x - 38 * s, gy - 80 * s + w, 5 * s, "#8a5a3c"); dot(c, x + 38 * s, gy - 80 * s - w, 5 * s, "#8a5a3c");
    rr(c, x - 18 * s, gy - 88 * s, 36 * s, 46 * s, 5 * s, "#b8d90a");          // hi-vis vest
    c.fillStyle = "#fff"; c.fillRect(x - 18 * s, gy - 70 * s, 36 * s, 4 * s); c.fillRect(x - 18 * s, gy - 56 * s, 36 * s, 4 * s);
    if (s > 0.35) { c.fillStyle = INK; c.font = `bold ${Math.max(5, 7 * s)}px sans-serif`; c.textAlign = "center"; c.fillText("LASTMA", x, gy - 76 * s); }
    dot(c, x, gy - 98 * s, 10 * s, "#8a5a3c");
    rr(c, x - 11 * s, gy - 112 * s, 22 * s, 9 * s, 3 * s, "#1f3a6e"); rr(c, x - 11 * s, gy - 105 * s, 28 * s, 3 * s, 1, "#1f3a6e"); // cap with brim
  }

  private danfo(x: number, gy: number, s: number) {
    const c = this.ctx, w = 130 * s, top = gy - 92 * s;
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(x, gy - 2 * s, w / 2 + 6 * s, 8 * s, 0, 0, Math.PI * 2); c.fill();
    rr(c, x - w / 2, top, w, 70 * s, 8 * s, this.market.look.bus.body);
    rr(c, x - w / 2 + 14 * s, top + 8 * s, w - 28 * s, 22 * s, 4 * s, "#26323b");
    c.fillStyle = INK; c.fillRect(x - w / 2, top + 36 * s, w, 12 * s);
    c.fillStyle = "#fff"; c.font = `bold ${Math.max(5, 9 * s)}px sans-serif`; c.textAlign = "center"; c.fillText(this.market.look.bus.label, x, top + 45 * s);
    rr(c, x - w / 2 + 4 * s, top + 52 * s, 14 * s, 9 * s, 2 * s, "#e4382f"); rr(c, x + w / 2 - 18 * s, top + 52 * s, 14 * s, 9 * s, 2 * s, "#e4382f");
    rr(c, x - 15 * s, top + 52 * s, 30 * s, 11 * s, 2 * s, "#fff");
    rr(c, x - w / 2, top + 70 * s, w, 8 * s, 3 * s, "#555");
    rr(c, x - w / 2 + 10 * s, gy - 22 * s, 22 * s, 22 * s, 4 * s, INK); rr(c, x + w / 2 - 32 * s, gy - 22 * s, 22 * s, 22 * s, 4 * s, INK);
  }

  private okada(x: number, gy: number, s: number, seed: number) {
    const c = this.ctx, shirt = ["#0e8f4e", "#7a3fb0", "#2b4c9b"][seed % 3];
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(x, gy - 2 * s, 30 * s, 6 * s, 0, 0, Math.PI * 2); c.fill();
    rr(c, x - 6 * s, gy - 52 * s, 12 * s, 52 * s, 5 * s, INK);                  // rear tyre
    rr(c, x - 20 * s, gy - 60 * s, 40 * s, 10 * s, 5 * s, "#2b2b33");           // seat
    rr(c, x - 17 * s, gy - 108 * s, 34 * s, 50 * s, 8 * s, shirt);              // rider
    rr(c, x - 22 * s, gy - 100 * s, 8 * s, 26 * s, 4 * s, shirt); rr(c, x + 14 * s, gy - 100 * s, 8 * s, 26 * s, 4 * s, shirt);
    dot(c, x, gy - 118 * s, 11 * s, "#6b4226"); rr(c, x - 12 * s, gy - 132 * s, 24 * s, 12 * s, 6 * s, "#e4382f");
    rr(c, x - 9 * s, gy - 38 * s, 18 * s, 9 * s, 2 * s, "#fff");                 // plate
  }

  private scenery(rel: number, side: number, h: number, i: number) {
    const c = this.ctx, s = sOf(rel), gy = yOf(s), L = this.market.look;
    const [mShop, mStall] = L.mix, shop = h < mShop, stall = !shop && h < mShop + mStall, tall = shop && h < mShop / 3;
    const cx = xOf(side * (ROAD_HALF + 28 + 78), s);
    c.save(); c.globalAlpha = this.fade(rel);
    if (shop) {
      const bh = tall ? 230 : 130 + hash(i + 3) * 40, bw = 150 * s, col = L.shopWalls[Math.floor(hash(i * 5 + 2) * L.shopWalls.length)];
      rr(c, cx - bw / 2, gy - bh * s, bw, bh * s, 4 * s, col);
      c.fillStyle = L.skyline === "glass" ? "rgba(150,210,235,.7)" : "rgba(255,236,170,.75)";
      for (let wy = gy - bh * s + 14 * s; wy < gy - 60 * s; wy += 26 * s) for (let wx = cx - bw / 2 + 12 * s; wx < cx + bw / 2 - 20 * s; wx += 28 * s) c.fillRect(wx, wy, 14 * s, 14 * s);
      for (let a = 0; a < 6; a++) rr(c, cx - bw / 2 + a * (bw / 6), gy - 58 * s, bw / 6, 22 * s, 0, L.awnings[a % 2 ? 1 : 0]); // awning
      rr(c, cx - bw / 2 + 10 * s, gy - 36 * s, bw - 20 * s, 36 * s, 2 * s, L.door);
    } else if (stall) {
      const col = L.umbrellas[Math.floor(hash(i * 3 + 1) * L.umbrellas.length)];
      rr(c, cx - 3 * s, gy - 90 * s, 6 * s, 90 * s, 1, "#6b4a2b");
      c.fillStyle = col; c.beginPath(); c.moveTo(cx - 62 * s, gy - 88 * s); c.quadraticCurveTo(cx, gy - 140 * s, cx + 62 * s, gy - 88 * s); c.closePath(); c.fill();
      rr(c, cx - 48 * s, gy - 40 * s, 96 * s, 12 * s, 2 * s, "#8a5a33"); rr(c, cx - 44 * s, gy - 28 * s, 8 * s, 28 * s, 1, "#6b4a2b"); rr(c, cx + 36 * s, gy - 28 * s, 8 * s, 28 * s, 1, "#6b4a2b");
      for (let a = 0; a < 5; a++) dot(c, cx - 36 * s + a * 18 * s, gy - 46 * s, 7 * s, L.goods[a % L.goods.length]);
    } else if (L.tree === "palm") {
      const lean = (h * 7 % 1 - 0.5) * 40 * s;
      c.strokeStyle = "#7a5a38"; c.lineCap = "round"; c.lineWidth = Math.max(2, 12 * s);
      c.beginPath(); c.moveTo(cx, gy); c.quadraticCurveTo(cx + lean * 0.3, gy - 90 * s, cx + lean, gy - 170 * s); c.stroke();
      const tx = cx + lean, ty = gy - 170 * s;
      c.fillStyle = "#2f9a4a";
      for (let f = 0; f < 7; f++) {
        const a = -Math.PI * (0.05 + (f / 6) * 0.9);
        c.beginPath(); c.moveTo(tx, ty);
        c.quadraticCurveTo(tx + Math.cos(a) * 50 * s, ty + Math.sin(a) * 50 * s - 16 * s, tx + Math.cos(a) * 88 * s, ty + Math.sin(a) * 88 * s + 18 * s);
        c.quadraticCurveTo(tx + Math.cos(a) * 50 * s, ty + Math.sin(a) * 50 * s + 4 * s, tx, ty + 6 * s); c.fill();
      }
      dot(c, tx, ty + 6 * s, 7 * s, "#6b4a2a");
    } else {
      // tree
      rr(c, cx - 5 * s, gy - 70 * s, 10 * s, 70 * s, 2 * s, "#5a3a22");
      dot(c, cx, gy - 100 * s, 38 * s, "#2f7d3a"); dot(c, cx - 24 * s, gy - 82 * s, 26 * s, "#3a9147"); dot(c, cx + 24 * s, gy - 84 * s, 28 * s, "#3a9147");
    }
    c.restore();
  }

  private pole(rel: number, side: number) {
    const c = this.ctx, s = sOf(rel), gy = yOf(s), x = xOf(side * (ROAD_HALF + 22), s);
    c.save(); c.globalAlpha = this.fade(rel);
    rr(c, x - 3 * s, gy - 210 * s, 6 * s, 210 * s, 1, "#3a3a42"); rr(c, x - 26 * s, gy - 206 * s, 52 * s, 5 * s, 1, "#3a3a42");
    c.restore();
  }

  /** The finish: a market arch across the road. */
  private gate(rel: number) {
    const c = this.ctx, s = sOf(Math.max(rel, -2)), gy = yOf(s), xl = xOf(-ROAD_HALF - 20, s), xr = xOf(ROAD_HALF + 20, s), G = this.market.look.gate;
    c.save(); c.globalAlpha = this.fade(rel);
    rr(c, xl - 7 * s, gy - 230 * s, 14 * s, 230 * s, 2 * s, G.post); rr(c, xr - 7 * s, gy - 230 * s, 14 * s, 230 * s, 2 * s, G.post);
    rr(c, xl - 10 * s, gy - 250 * s, xr - xl + 20 * s, 64 * s, 8 * s, G.board);
    c.strokeStyle = INK; c.lineWidth = Math.max(1, 4 * s); c.beginPath(); c.roundRect(xl - 10 * s, gy - 250 * s, xr - xl + 20 * s, 64 * s, 8 * s); c.stroke();
    c.fillStyle = G.trim; c.fillRect(xl, gy - 244 * s, xr - xl, 8 * s);
    c.fillStyle = INK; c.font = `${Math.max(8, 38 * s)}px ${DISPLAY_FONT}`; c.textAlign = "center"; c.fillText(G.text, (xl + xr) / 2, gy - 200 * s, xr - xl - 20 * s);
    c.restore();
  }

  private drawPlayer() {
    const c = this.ctx, x = xOf(this.lane * LANE_W, 1), air = this.jumpH * 44;
    const stumble = this.slowT > 0 ? Math.sin(this.t * 30) * 2 : 0;
    c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(x, GY + 2, 24 - air * 0.15, 7, 0, 0, Math.PI * 2); c.fill();
    c.save();
    if (this.phase === "caught") { c.translate(x, GY - 10); c.rotate(-0.5); c.translate(-x, -(GY - 10)); }
    drawAvatar(c, x + stumble, GY - air, this.opts.avatar, this.t * (this.speed / 22 + 0.4), 1.9, this.phase === "run" || this.phase === "countdown");
    c.restore();
  }

  private drawChaser() {
    const c = this.ctx, px = xOf(this.lane * LANE_W, 1);
    if (this.phase === "caught") {
      this.officer(px - 62, GY + 6, 2.0, 3, false);
      return;
    }
    if (this.chase <= 0) return;
    c.save(); c.globalAlpha = Math.min(1, this.chase * 1.6);
    this.officer(px + Math.sin(this.t * 3) * 10, GY + 30 + (1 - this.chase) * 70, 1.7, 5, false);
    c.restore();
  }

  private speedLines() {
    if (this.phase !== "run" || this.speed < BASE_SPEED * 0.8) return;
    const c = this.ctx, k = clamp((this.speed - 18) / 14, 0, 1);
    c.strokeStyle = `rgba(255,255,255,${0.1 + k * 0.14})`; c.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = hash(i + 40) * Math.PI * 2, r = ((this.t * (0.9 + k) + hash(i + 9)) % 1);
      if (Math.sin(a) < 0.05) continue;
      const r0 = 120 + r * r * 620, r1 = r0 + 30 + r * 70;
      c.beginPath(); c.moveTo(VX + Math.cos(a) * r0, HZ + 60 + Math.sin(a) * r0 * 0.7); c.lineTo(VX + Math.cos(a) * r1, HZ + 60 + Math.sin(a) * r1 * 0.7); c.stroke();
    }
  }

  private drawPops() {
    for (const p of this.pops) {
      this.ctx.globalAlpha = Math.min(1, 1.5 - p.t * 1.2);
      this.text(p.text, p.x, p.y - p.t * 40, p.size, p.color, "center");
    }
    this.ctx.globalAlpha = 1;
  }

  private drawHud() {
    const c = this.ctx;
    if (this.phase === "idle") return;
    // cash earned so far (kept only if you make it)
    this.panel(14, 12, 190, 44);
    this.text(`₦${this.cash}`, 28, 46, 30, "#7dffa8");
    // distance to the market
    const bx = W / 2 - 170, frac = clamp(this.dist / RUN_DIST, 0, 1);
    this.panel(bx, 12, 340, 44);
    c.fillStyle = "rgba(255,255,255,.16)"; c.beginPath(); c.roundRect(bx + 16, 32, 296, 10, 5); c.fill();
    c.fillStyle = "#ffd84a"; c.beginPath(); c.roundRect(bx + 16, 32, 296 * frac, 10, 5); c.fill();
    dot(c, bx + 16 + 296 * frac, 37, 8, "#e4382f");
    c.font = "18px sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText("🏁", bx + 322, 42);
    this.text(`TO ${this.market.name.toUpperCase()}`, W / 2, 28, 14, "#ffffff", "center");
    // stumbles: two and you are caught
    this.panel(W - 190, 12, 176, 44);
    this.text("STUMBLES", W - 176, 42, 16, "#ffffff");
    for (let i = 0; i < 2; i++) dot(c, W - 56 + i * 26, 34, 9, i < this.stumbles ? "#ff453a" : "rgba(255,255,255,.25)");
    // what you are carrying out of the market
    const x0 = 22, y0 = H - 54, left = Math.max(0, this.space - countStock(this.items));
    const ids = Object.keys(this.market.items) as ItemId[];
    this.panel(x0 - 10, y0 - 4, ids.length * 66 + 130, 46);
    ids.forEach((id, i) => {
      const x = x0 + i * 66;
      c.font = "20px sans-serif"; c.textAlign = "left"; c.fillStyle = "#fff"; c.fillText(ITEMS[id].icon, x, y0 + 26);
      this.text(`x${this.items[id]}`, x + 28, y0 + 28, 20, this.items[id] > 0 ? "#ffffff" : "#8c8c96");
    });
    this.text(`Room ${left}`, x0 + ids.length * 66 + 4, y0 + 28, 18, left > 0 ? "#ffd84a" : "#ff8a80");
  }

  private drawOverlay() {
    const c = this.ctx;
    if (this.phase === "idle") {
      c.fillStyle = "rgba(20,12,4,.5)"; c.fillRect(0, 0, W, H);
      this.text(this.market.name.toUpperCase(), W / 2, 210, 54, "#ffd84a", "center", W - 80);
      this.text("Dodge LASTMA. Jump potholes. Grab stock on the way.", W / 2, 262, 24, "#ffffff", "center", W - 80);
      this.text("Pay the entry fee below to start", W / 2, 306, 22, "#7dffa8", "center");
    } else if (this.phase === "countdown") {
      const n = 3 - Math.floor(this.cd / COUNTDOWN);
      const label = n > 0 ? String(n) : "GO!", k = (this.cd % COUNTDOWN) / COUNTDOWN;
      c.globalAlpha = 1 - k * 0.6;
      this.text(label, W / 2, 250, 120 - k * 30, "#ffffff", "center");
      c.globalAlpha = 1;
      this.text("Left and right to change lane. Up or space to jump.", W / 2, 320, 20, "#ffffff", "center");
    }
  }
}
