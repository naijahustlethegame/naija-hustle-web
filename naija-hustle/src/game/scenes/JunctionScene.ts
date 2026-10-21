import { drawAvatar, type AvatarConfig } from "../avatar/avatar";
import { NO_LINES, PUSH_FAIL_LINES, SPEC, YES_LINES, makeBuyer, pickColor, pickKind } from "../engine/buyers";
import { drawLight, drawVehicle, renderBackdrop, type LightState, type VehView } from "../engine/draw";
import { rollRoundEvent, type RoundEvent } from "../engine/events";
import { CAPACITY, ITEMS, ITEM_IDS, countStock, emptyStock, naira } from "../engine/items";
import { JUNCTIONS, JUNCTION_LIST, type JunctionId } from "../engine/junctions";
import { BOTTOM, DISPLAY_FONT, HOME_Y, LANE_Y, PLAYER_SPEED, STOP_X, TOP } from "../engine/layout";
import { Loop } from "../engine/loop";
import { H, W, type Buyer, type ItemId, type Stock } from "../engine/types";

export type Phase = "prep" | "red" | "yellow" | "green" | "summary";
type VState = "arriving" | "stopped" | "leaving";
type PState = "idle" | "running" | "haggle" | "pause" | "fleeing";

type Veh = VehView & {
  lane: number; slotX: number; vx: number; st: VState; buyer: Buyer;
  done: boolean; launchIn: number; leader: Veh | null;
};
type Pop = { x: number; y: number; t: number; text: string; color: string };
type Haggle = { v: Veh; t: number; dur: number };

export type RoundSummary = {
  junction: string; event: RoundEvent; sales: number; rejects: number; hits: number;
  earned: number; bestStreak: number; itemsLeft: number;
};
export type Snapshot = {
  phase: Phase; money: number; stock: Stock; carrying: number;
  junction: JunctionId; summary: RoundSummary | null;
};
type Opts = {
  demo: boolean; avatar: AvatarConfig; money?: number; stock?: Stock;
  onBank?: (money: number, stock: Stock) => void;
};

const WARN = 2.2;          // yellow warning, seconds
const HAGGLE_SECS = 2.4;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const groundOf = (v: { y: number; h: number }) => v.y + v.h / 2;

export class JunctionScene {
  private ctx: CanvasRenderingContext2D;
  private loop: Loop;
  private bgs: Partial<Record<JunctionId, HTMLCanvasElement>> = {};
  private demo: boolean;
  private avatar: AvatarConfig;

  // state
  private phase: Phase = "prep";
  private jid: JunctionId = "ojuelegba";
  private money: number; private stock: Stock;
  private vehs: Veh[] = []; private ambient: (VehView & { vx: number })[] = [];
  private pops: Pop[] = [];
  private nextId = 1; private t = 0; private ambT = [0.2, 0.9, 1.5];
  private redLeft = 0; private redNominal = 1;
  private ev: RoundEvent | null = null; private bannerT = 0;
  private streak = 0; private moneyAtStart = 0; private jumped = false;
  private stats = { sales: 0, rejects: 0, hits: 0, bestStreak: 0 };
  private summary: RoundSummary | null = null;

  // player
  private px = 300; private py = HOME_Y; private pstate: PState = "idle";
  private target: Veh | null = null; private haggle: Haggle | null = null;
  private pauseT = 0; private inv = 0;

  // bot (homepage demo)
  private botT = 0.8; private botHT = 0; private botDemoJ = 0;

  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private onTap = (e: PointerEvent) => this.tap(e);

  constructor(private canvas: HTMLCanvasElement, private opts: Opts) {
    this.demo = opts.demo; this.avatar = opts.avatar;
    this.money = opts.money ?? 0; this.stock = { ...emptyStock(), ...(opts.stock ?? {}) };
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR to protect low-end phones
    canvas.width = W * dpr; canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.loop = new Loop((dt) => this.update(dt), () => this.draw());
    if (!this.demo) canvas.addEventListener("pointerdown", this.onTap);
    this.snap = this.makeSnap();
  }

  start() { this.loop.start(); }
  pause() { this.loop.stop(); }
  resume() { this.loop.start(); }
  destroy() { this.loop.stop(); this.canvas.removeEventListener("pointerdown", this.onTap); this.listeners.clear(); }

  // ---------- React bridge ----------
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;
  private makeSnap(): Snapshot {
    return { phase: this.phase, money: this.money, stock: { ...this.stock }, carrying: countStock(this.stock), junction: this.jid, summary: this.summary };
  }
  private notify() {
    this.snap = this.makeSnap();
    if (!this.demo) this.opts.onBank?.(this.money, { ...this.stock });
    this.listeners.forEach((f) => f());
  }

  // ---------- shop (only between rounds) ----------
  buy(id: ItemId) {
    if (this.phase !== "prep" || this.money < ITEMS[id].cost || countStock(this.stock) >= CAPACITY) return;
    this.money -= ITEMS[id].cost; this.stock[id]++; this.notify();
  }
  refund(id: ItemId) {
    if (this.phase !== "prep" || this.stock[id] <= 0) return;
    this.money += ITEMS[id].cost; this.stock[id]--; this.notify();
  }
  selectJunction(id: JunctionId) { if (this.phase === "prep") { this.jid = id; this.notify(); } }
  toPrep() { if (this.phase === "summary") { this.phase = "prep"; this.notify(); } }

  startRound(id?: JunctionId) {
    if (this.phase !== "prep" && this.phase !== "summary") return;
    if (id) this.jid = id;
    const j = JUNCTIONS[this.jid];
    this.ev = rollRoundEvent(); this.bannerT = 4;
    if (this.ev.kind === "lastma") for (let i = 0; i < 2; i++) this.loseRandomItem();
    this.redNominal = j.red + (this.ev.kind === "goslow" ? 6 : 0);
    this.redLeft = this.redNominal * rand(0.9, 1.15);
    this.stats = { sales: 0, rejects: 0, hits: 0, bestStreak: 0 };
    this.streak = 0; this.moneyAtStart = this.money; this.summary = null; this.jumped = false;
    this.pops = []; this.haggle = null; this.target = null; this.inv = 0;
    this.px = 300; this.py = HOME_Y; this.pstate = "idle";
    this.buildQueue();
    this.phase = "red";
    this.notify();
  }

  private loseRandomItem(): ItemId | null {
    const have = ITEM_IDS.filter((k) => this.stock[k] > 0);
    if (!have.length) return null;
    const k = pickOne(have); this.stock[k]--; return k;
  }

  private buildQueue() {
    const j = JUNCTIONS[this.jid];
    this.vehs = []; this.ambient = [];
    LANE_Y.forEach((ly, lane) => {
      const n = randInt(j.perLane[0], j.perLane[1]);
      let front = STOP_X - 6, leader: Veh | null = null;
      for (let k = 0; k < n; k++) {
        const kind = pickKind(j.mix), s = SPEC[kind];
        const slotX = front - s.w / 2;
        if (slotX - s.w / 2 < 40) break;
        front = slotX - s.w / 2 - 16; // next car's bumper sits one gap behind this car
        const buyer = makeBuyer(kind, this.ev?.kind ?? "normal");
        const y = ly + 20 - s.h / 2 - 2;
        const v: Veh = {
          id: this.nextId++, kind, x: -s.w / 2 - 40 - k * 175 - Math.random() * 40, y, w: s.w, h: s.h,
          tint: pickColor(kind), tell: buyer.tell, sold: false,
          lane, slotX, vx: 0, st: "arriving", buyer, done: false, launchIn: 0, leader,
        };
        this.vehs.push(v); leader = v;
      }
    });
  }

  // ---------- input ----------
  private toCanvas(ev: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }
  private tap(ev: PointerEvent) {
    const { x, y } = this.toCanvas(ev);
    if (this.phase !== "red" && this.phase !== "yellow") return;
    if (this.pstate === "haggle" && this.haggle) {
      const r = this.haggleRects(this.haggle.v);
      const inRect = (b: { x: number; y: number; w: number; h: number }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      if (inRect(r.sell)) this.settle(false); else if (inRect(r.push)) this.settle(true);
      return;
    }
    if (this.pstate === "pause" || this.pstate === "fleeing") return;
    const v = this.pickVeh(x, y);
    if (v) this.go(v);
  }
  private pickVeh(x: number, y: number): Veh | null {
    let best: Veh | null = null, bd = 1e9;
    for (const v of this.vehs) {
      if (v.st !== "stopped" || v.done) continue;
      const dx = Math.abs(v.x - x), dy = Math.abs(v.y - y);
      if (dx < v.w / 2 + 18 && dy < v.h / 2 + 26) { const d = dx + dy; if (d < bd) { best = v; bd = d; } }
    }
    return best;
  }
  private go(v: Veh) { this.target = v; this.pstate = "running"; }

  // ---------- buying ----------
  private arrive(v: Veh) {
    if (v.done || v.st !== "stopped") { this.pstate = "idle"; return; }
    const b = v.buyer;
    if (!b.willBuy) { this.reject(v, pickOne(NO_LINES)); return; }
    if (this.stock[b.want] <= 0) {
      v.done = true; v.tell = "ignore";
      this.say(v, `You no get ${ITEMS[b.want].name.toLowerCase()}!`, "#fff");
      this.pstate = "pause"; this.pauseT = 0.35; return;
    }
    this.haggle = { v, t: 0, dur: HAGGLE_SECS }; this.pstate = "haggle";
  }
  private reject(v: Veh, line: string) {
    v.done = true; v.tell = "ignore"; this.streak = 0; this.stats.rejects++;
    this.say(v, line, "#ffb4ab");
    this.pstate = "pause"; this.pauseT = 0.45; this.haggle = null; this.target = null;
  }
  private bonus() { return Math.min(0.5, this.streak * 0.1); }
  private priceFor(v: Veh, push: boolean) {
    return Math.max(10, Math.round((v.buyer.offer * (push ? 1.3 : 1) * (1 + this.bonus())) / 10) * 10);
  }
  /** Sell at the offer, or push for more and risk losing the sale. */
  private settle(push: boolean) {
    const h = this.haggle; if (!h) return;
    const v = h.v, b = v.buyer;
    this.haggle = null; this.target = null;
    if (push && Math.random() > b.pushP) { this.reject(v, pickOne(PUSH_FAIL_LINES)); return; }
    const price = this.priceFor(v, push);
    this.stock[b.want]--; this.money += price;
    v.sold = true; v.done = true;
    this.streak++; this.stats.sales++; this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
    this.pops.push({ x: v.x, y: v.y - v.h / 2 - 16, t: 0, text: `+${naira(price)}`, color: "#7dffa8" });
    this.say(v, pickOne(YES_LINES), "#fff", 22);
    this.pstate = "idle";
  }
  private say(v: Veh, text: string, color: string, dy = 34) {
    this.pops.push({ x: v.x, y: v.y - v.h / 2 - dy, t: 0, text, color });
  }

  private haggleRects(v: Veh) {
    const bx = Math.min(W - 140, Math.max(140, v.x)), by = Math.max(60, v.y - v.h / 2 - 96);
    return {
      box: { x: bx - 138, y: by, w: 276, h: 84 },
      sell: { x: bx - 130, y: by + 40, w: 126, h: 38 },
      push: { x: bx + 4, y: by + 40, w: 126, h: 38 },
    };
  }

  // ---------- simulation ----------
  private light(): LightState { return this.phase === "red" ? "red" : this.phase === "yellow" ? "yellow" : "green"; }
  private inRoad() { return this.py > TOP - 8 && this.py < BOTTOM + 14; }

  private update(dt: number) {
    this.t += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.1);
    this.inv -= dt;
    if (this.demo) this.botUpdate(dt);

    if (this.phase === "prep" || this.phase === "summary") this.updateAmbient(dt);
    if (this.phase === "red" || this.phase === "yellow") this.updateRed(dt);
    if (this.phase === "green") this.updateGreen();
    if (this.vehs.length) this.updateTraffic(dt);
    this.updatePlayer(dt);
  }

  private updateAmbient(dt: number) {
    const j = JUNCTIONS[this.jid];
    LANE_Y.forEach((ly, i) => {
      this.ambT[i] -= dt;
      if (this.ambT[i] <= 0) {
        const kind = pickKind(j.mix), s = SPEC[kind];
        this.ambient.push({ id: this.nextId++, kind, x: -s.w, y: ly + 20 - s.h / 2 - 2, w: s.w, h: s.h, tint: pickColor(kind), tell: "ignore", sold: false, vx: rand(170, 250) });
        this.ambT[i] = rand(1.2, 3);
      }
    });
    for (const a of this.ambient) a.x += a.vx * dt;
    this.ambient = this.ambient.filter((a) => a.x < W + 120);
  }

  private updateRed(dt: number) {
    this.redLeft -= dt;
    if (this.phase === "red" && this.redLeft <= WARN) {
      this.phase = "yellow";
      this.pops.push({ x: W / 2, y: 120, t: 0, text: "LIGHT DEY CHANGE!", color: "#ffd84a" });
    }
    // okada and keke riders jump the light, just before it turns green
    if (this.phase === "yellow" && !this.jumped && this.redLeft <= 0.7) {
      this.jumped = true;
      for (const v of this.vehs) {
        if (v.st !== "stopped" || (v.kind !== "okada" && v.kind !== "keke")) continue;
        if (this.haggle?.v === v || this.target === v || Math.random() > 0.4) continue;
        v.st = "leaving"; v.vx = 40;
        this.pops.push({ x: v.x, y: v.y - v.h / 2 - 12, t: 0, text: "Oya go!", color: "#ffd84a" });
      }
    }
    if (this.redLeft <= 0) this.goGreen();
  }

  private goGreen() {
    this.phase = "green";
    if (this.haggle) { this.say(this.haggle.v, "Light don change!", "#fff"); this.haggle = null; }
    this.target = null;
    if (this.inRoad()) {
      // you freeze for a moment before you run. That is what makes standing at the front car risky.
      this.pstate = "pause"; this.pauseT = Math.max(this.pauseT, 0.55);
      this.pops.push({ x: this.px, y: this.py - 70, t: 0, text: "Run!", color: "#7dffa8" });
    } else if (this.pstate !== "pause") this.pstate = "idle";
    // the front car goes first, the rest follow one by one
    for (let lane = 0; lane < LANE_Y.length; lane++) {
      const cars = this.vehs.filter((v) => v.lane === lane && v.st === "stopped").sort((a, b) => b.slotX - a.slotX);
      cars.forEach((v, i) => { v.launchIn = 0.35 + i * 0.45 + Math.random() * 0.3; });
    }
    this.notify();
  }

  private updateGreen() {
    if (this.vehs.length === 0 && this.pstate !== "fleeing") this.finishRound();
  }

  private finishRound() {
    const j = JUNCTIONS[this.jid];
    this.summary = {
      junction: j.name, event: this.ev!, sales: this.stats.sales, rejects: this.stats.rejects, hits: this.stats.hits,
      earned: this.money - this.moneyAtStart, bestStreak: this.stats.bestStreak, itemsLeft: countStock(this.stock),
    };
    this.phase = "summary"; this.botT = 2.6; this.ambT = [0.2, 0.9, 1.5];
    this.notify();
  }

  private updateTraffic(dt: number) {
    const leaving = (v: Veh) => v.st === "leaving";
    for (const v of this.vehs) {
      if (v.st === "arriving") {
        const sp = Math.min(330, (v.slotX - v.x) * 2.4 + 30);
        let nx = v.x + sp * dt;
        if (v.leader) nx = Math.min(nx, v.leader.x - v.leader.w / 2 - v.w / 2 - 10);
        if (v.slotX - nx < 1.2) { nx = v.slotX; v.st = "stopped"; }
        v.x = nx;
      } else if (this.phase === "green" && v.st === "stopped") {
        v.launchIn -= dt;
        if (v.launchIn <= 0) { v.st = "leaving"; v.vx = 30; }
      } else if (leaving(v)) {
        v.vx = Math.min(430, v.vx + 360 * dt);
        v.x += v.vx * dt;
      }
    }
    this.vehs = this.vehs.filter((v) => v.x - v.w / 2 < W + 40);
  }

  private updatePlayer(dt: number) {
    if (this.pstate === "pause") {
      this.pauseT -= dt;
      // if the light changed while you were being turned down, get off the road
      if (this.pauseT <= 0) this.pstate = this.phase === "green" && this.inRoad() ? "fleeing" : "idle";
    }
    else if (this.pstate === "running" && this.target) {
      const v = this.target;
      if (v.st !== "stopped" || v.done) { this.target = null; this.pstate = "idle"; }
      else {
        const tx = v.x - v.w * 0.3, ty = groundOf(v) + 14;
        const d = Math.hypot(tx - this.px, ty - this.py);
        if (d < 8) this.arrive(v);
        else { this.px += ((tx - this.px) / d) * PLAYER_SPEED * dt; this.py += ((ty - this.py) / d) * PLAYER_SPEED * dt; }
      }
    } else if (this.pstate === "haggle" && this.haggle) {
      this.haggle.t += dt;
      if (this.haggle.t >= this.haggle.dur && !this.demo) this.settle(false); // be nice: no answer means you take the offer
    } else if (this.pstate === "fleeing") {
      this.py += PLAYER_SPEED * 1.15 * dt;
      if (this.py >= HOME_Y) { this.py = HOME_Y; this.pstate = "idle"; }
    }
    // green light danger: a moving car hits you
    if (this.inv <= 0 && this.inRoad()) {
      for (const v of this.vehs) {
        if (v.st !== "leaving" || v.vx < 25) continue;
        if (Math.abs(this.px - v.x) < v.w / 2 + 8 && Math.abs(this.py - groundOf(v)) < 22) { this.hit(); break; }
      }
    }
  }

  private hit() {
    const loss = Math.min(this.money, 50); this.money -= loss;
    const lost = this.loseRandomItem();
    this.stats.hits++; this.streak = 0;
    this.pops.push({ x: this.px, y: this.py - 80, t: 0, text: `Ouch! -${naira(loss)}${lost ? ` and ${ITEMS[lost].name.toLowerCase()}` : ""}`, color: "#ff8a80" });
    this.pstate = "pause"; this.pauseT = 1; this.inv = 1.6; this.haggle = null; this.target = null; this.py = HOME_Y;
  }

  // ---------- homepage demo bot ----------
  private startDemoRound() {
    this.stock = { water: 6, drink: 3, snack: 3, gadget: 2 }; this.money = 0;
    this.botDemoJ = (this.botDemoJ + 1) % JUNCTION_LIST.length;
    this.jid = JUNCTION_LIST[this.botDemoJ].id;
    this.phase = "prep"; this.startRound();
  }
  private botUpdate(dt: number) {
    if (this.phase === "prep" || this.phase === "summary") {
      this.botT -= dt; if (this.botT <= 0) this.startDemoRound();
      return;
    }
    if (this.phase === "green") return;
    if (this.pstate === "haggle" && this.haggle) {
      this.botHT -= dt;
      if (this.botHT <= 0) this.settle(this.haggle.v.buyer.tell === "keen" && Math.random() < 0.4);
      return;
    }
    if (this.pstate !== "idle") return;
    this.botT -= dt; if (this.botT > 0) return;
    this.botT = 0.25;
    const careful = this.phase === "yellow" && Math.random() < 0.85;
    let best: Veh | null = null, bs = 0.2;
    for (const v of this.vehs) {
      if (v.st !== "stopped" || v.done) continue;
      const dist = Math.hypot(v.x - this.px, groundOf(v) - this.py);
      if (careful && dist > 130) continue;
      const s = ({ keen: 3, maybe: 1.8, ignore: 0.3 })[v.buyer.tell] + (this.stock[v.buyer.want] > 0 ? 1.2 : -3) - dist / 350 + Math.random() * 0.6;
      if (s > bs) { best = v; bs = s; }
    }
    if (best) { this.go(best); this.botHT = 0.5 + Math.random() * 0.5; }
  }

  // ---------- drawing ----------
  private bg(): HTMLCanvasElement {
    return (this.bgs[this.jid] ??= renderBackdrop(JUNCTIONS[this.jid]));
  }

  private text(s: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = "left", stroke = "rgba(20,12,4,.85)") {
    const c = this.ctx;
    c.font = `${size}px ${DISPLAY_FONT}`; c.textAlign = align;
    c.lineWidth = Math.max(3, size / 6); c.strokeStyle = stroke; c.lineJoin = "round";
    c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y);
  }
  private panel(x: number, y: number, w: number, h: number, fill = "rgba(27,27,34,.88)") {
    const c = this.ctx; c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, 12); c.fill();
  }

  private draw() {
    const c = this.ctx;
    c.drawImage(this.bg(), 0, 0, W, H);
    drawLight(c, this.light(), this.t);

    type D = { key: number; paint: () => void };
    const items: D[] = [];
    for (const a of this.ambient) items.push({ key: groundOf(a), paint: () => drawVehicle(c, a) });
    for (const v of this.vehs) items.push({ key: groundOf(v), paint: () => drawVehicle(c, v) });
    items.push({ key: this.py + 14, paint: () => this.drawPlayer() });
    items.sort((a, b) => a.key - b.key);
    for (const d of items) d.paint();

    this.drawTells();
    this.drawPops();
    if (this.haggle) this.drawHaggle(this.haggle);
    this.drawHud();
  }

  private drawPlayer() {
    const c = this.ctx;
    if (this.inv > 0 && Math.floor(this.t * 12) % 2) c.globalAlpha = 0.45;
    drawAvatar(c, this.px, this.py, this.avatar, this.t, 1.05, this.pstate === "running" || this.pstate === "fleeing");
    c.globalAlpha = 1;
  }

  /** Floating hint above stopped cars: keen buyers show what they want, "maybe" buyers show a question mark. */
  private drawTells() {
    const c = this.ctx;
    for (const v of this.vehs) {
      if (v.st !== "stopped" || v.done || v.tell === "ignore") continue;
      const bob = Math.sin(this.t * 4 + v.id) * 2, x = v.x, y = v.y - v.h / 2 - 14 + bob;
      c.fillStyle = "rgba(255,255,255,.95)"; c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(x - 4, y + 10); c.lineTo(x, y + 16); c.lineTo(x + 4, y + 10); c.fill();
      c.textAlign = "center"; c.fillStyle = "#1b1b22";
      if (v.tell === "keen") { c.font = "15px sans-serif"; c.fillText(ITEMS[v.buyer.want].icon, x, y + 5.5); }
      else { c.font = "bold 16px sans-serif"; c.fillText("?", x, y + 5.5); }
    }
  }

  private drawPops() {
    for (const p of this.pops) {
      this.ctx.globalAlpha = Math.min(1, 1.6 - p.t * 1.4);
      this.text(p.text, p.x, p.y - p.t * 34, 20, p.color, "center");
    }
    this.ctx.globalAlpha = 1;
  }

  private drawHaggle(h: Haggle) {
    const c = this.ctx, v = h.v, r = this.haggleRects(v), b = v.buyer;
    this.panel(r.box.x, r.box.y, r.box.w, r.box.h, "rgba(255,248,225,.97)");
    c.strokeStyle = "#1b1b22"; c.lineWidth = 3; c.beginPath(); c.roundRect(r.box.x, r.box.y, r.box.w, r.box.h, 12); c.stroke();
    c.font = "bold 15px sans-serif"; c.textAlign = "center"; c.fillStyle = "#1b1b22";
    c.fillText(`${ITEMS[b.want].icon} ${ITEMS[b.want].name}?  They offer ${naira(this.priceFor(v, false))}`, r.box.x + r.box.w / 2, r.box.y + 26);
    const btn = (rect: { x: number; y: number; w: number; h: number }, fill: string, shadow: string, label: string) => {
      c.fillStyle = shadow; c.beginPath(); c.roundRect(rect.x, rect.y + 3, rect.w, rect.h, 10); c.fill();
      c.fillStyle = fill; c.beginPath(); c.roundRect(rect.x, rect.y, rect.w, rect.h, 10); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 15px sans-serif"; c.textAlign = "center";
      c.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 5);
    };
    btn(r.sell, "#0e8f4e", "#08532d", `Sell ${naira(this.priceFor(v, false))}`);
    btn(r.push, "#e8590c", "#8f3406", `Push ${naira(this.priceFor(v, true))}`);
    const left = Math.max(0, 1 - h.t / h.dur);
    c.fillStyle = "#1b1b22"; c.fillRect(r.box.x + 12, r.box.y + r.box.h - 4, (r.box.w - 24) * left, 3);
    // little tail pointing at the buyer
    const ax = Math.min(W - 160, Math.max(160, v.x)), ay = r.box.y + r.box.h;
    c.fillStyle = "rgba(255,248,225,.97)";
    c.beginPath(); c.moveTo(ax - 7, ay); c.lineTo(ax + 7, ay); c.lineTo(ax, ay + 9); c.fill();
  }

  private drawHud() {
    const c = this.ctx;
    // money
    this.panel(14, 12, 208, 44);
    this.text(naira(this.money), 28, 46, 30, "#ffd84a");
    // light timer
    const tx = W / 2 - 160;
    this.panel(tx, 12, 320, 44);
    if (this.phase === "red" || this.phase === "yellow") {
      const frac = Math.max(0, Math.min(1, this.redLeft / this.redNominal));
      c.fillStyle = "rgba(255,255,255,.14)"; c.beginPath(); c.roundRect(tx + 14, 38, 292, 10, 5); c.fill();
      c.fillStyle = this.phase === "yellow" ? "#ffc400" : "#ff453a"; c.beginPath(); c.roundRect(tx + 14, 38, 292 * frac, 10, 5); c.fill();
      this.text(this.phase === "yellow" ? "GET READY TO RUN!" : "RED LIGHT: SELL!", W / 2, 32, 20, this.phase === "yellow" ? "#ffd84a" : "#ffffff", "center");
    } else if (this.phase === "green") {
      this.text("GREEN! GET OFF THE ROAD", W / 2, 42, 22, "#5cff9a", "center");
    } else {
      this.text(this.demo ? "WAITING FOR RED" : "NEXT LIGHT: GET READY", W / 2, 42, 20, "#ffffff", "center");
    }
    // event banner
    if (this.ev && this.bannerT > 0 && (this.phase === "red" || this.phase === "yellow")) {
      const e = this.ev, w = 420;
      this.ctx.globalAlpha = Math.min(1, this.bannerT);
      this.panel(W / 2 - w / 2, 62, w, 30, e.good ? "rgba(14,143,78,.95)" : e.kind === "normal" ? "rgba(27,27,34,.9)" : "rgba(200,40,30,.95)");
      c.font = "bold 14px sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff";
      c.fillText(`🎲 ${e.die}  ${e.title}: ${e.text}`, W / 2, 82);
      this.ctx.globalAlpha = 1;
    }
    // stock tray
    const x0 = 250, y0 = H - 54;
    this.panel(x0 - 12, y0 - 4, 4 * 74 + 20, 46);
    ITEM_IDS.forEach((id, i) => {
      const x = x0 + i * 74;
      c.font = "20px sans-serif"; c.textAlign = "left"; c.fillStyle = "#fff"; c.fillText(ITEMS[id].icon, x, y0 + 26);
      this.text(`x${this.stock[id]}`, x + 28, y0 + 28, 20, this.stock[id] > 0 ? "#ffffff" : "#8c8c96");
    });
    // streak
    if (this.streak >= 2 && (this.phase === "red" || this.phase === "yellow")) {
      this.panel(W - 196, H - 58, 180, 44, "rgba(232,89,12,.95)");
      this.text(`${this.streak} IN A ROW  +${Math.round(this.bonus() * 100)}%`, W - 106, H - 28, 20, "#fff", "center");
    }
  }
}
