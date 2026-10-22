import { drawAvatar, type AvatarConfig } from "../avatar/avatar";
import { NO_LINES, PUSH_FAIL_LINES, SPEC, YES_LINES, makeBuyer, pickColor, pickKind } from "../engine/buyers";
import { OFFICER_SPOTS, drawOfficer, drawWeatherFront, drawWeatherTint } from "../engine/weather";
import { WARN, lightAt, type LightPhase } from "../engine/clock";
import { drawLight, drawVehicle, renderBackdrop, type VehView } from "../engine/draw";
import { rollRoundEvent, type RoundEvent } from "../engine/events";
import { CAPACITY, CORE_ITEMS, ITEMS, ITEM_IDS, countStock, emptyStock, naira } from "../engine/items";
import { JUNCTIONS, JUNCTION_LIST, type JunctionId } from "../engine/junctions";
import { BOTTOM, DISPLAY_FONT, HOME_Y, LANE_Y, PLAYER_SPEED, STOP_X, TOP } from "../engine/layout";
import { Loop } from "../engine/loop";
import { hashString, mulberry32, type Rng } from "../engine/rng";
import { H, W, type Buyer, type ItemId, type Stock } from "../engine/types";
import { RoomClient, type RoomInfo } from "@/lib/room";

export type Phase = LightPhase;
type VState = "arriving" | "stopped" | "leaving";
type PState = "idle" | "running" | "haggle" | "pause" | "walk" | "wait";

type Veh = VehView & {
  lane: number; slotX: number; vx: number; st: VState; buyer: Buyer;
  done: boolean; launchIn: number; leader: Veh | null;
  key: string; taken: boolean; // key is the same for everyone in the room; taken = a seller was already chosen
};
type Peer = { id: string; name: string; avatar: AvatarConfig; x: number; y: number; tx: number; ty: number; s: string };
type Pop = { x: number; y: number; t: number; text: string; color: string };
type Haggle = { v: Veh; t: number; dur: number };
type Stats = { sales: number; rejects: number; hits: number; earned: number; bestStreak: number };

export type Snapshot = {
  playing: boolean; phase: Phase; money: number; stock: Stock; storage: Stock; carrying: number;
  junction: JunctionId; outOfStock: boolean;
};
type Opts = {
  demo: boolean; avatar: AvatarConfig; money?: number; stock?: Stock; storage?: Stock;
  junction?: JunctionId;
  onBank?: (money: number, stock: Stock, storage: Stock) => void;
  onJunction?: (id: JunctionId) => void;
  /** Wall clock in ms. Only tests pass this. */
  clock?: () => number;
  /** Join the shared room: the homepage watches (demo), /play takes a seat when you press Play. */
  multi?: boolean;
};

const HAGGLE_SECS = 2.4;
const CLAIM_TIMEOUT = 1.5; // if the server never answers, carry on alone
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const groundOf = (v: { y: number; h: number }) => v.y + v.h / 2;
const zero = (): Stats => ({ sales: 0, rejects: 0, hits: 0, earned: 0, bestStreak: 0 });

/**
 * One junction. The light is driven by the wall clock (see engine/clock.ts), so it keeps cycling
 * by itself: red, amber, green, red. You press Play when you are ready and join whatever light is on.
 */
export class JunctionScene {
  private ctx: CanvasRenderingContext2D;
  private loop: Loop;
  private bgs: Partial<Record<JunctionId, HTMLCanvasElement>> = {};
  private demo: boolean;
  private avatar: AvatarConfig;
  private clockFn: () => number;

  // state
  private playing: boolean;
  private phase: Phase = "green";
  private cycle = -1; private needSync = true;
  private jid: JunctionId = "ojuelegba";
  private money: number; private stock: Stock; private storage: Stock;
  private vehs: Veh[] = []; private ambient: (VehView & { vx: number })[] = [];
  private pops: Pop[] = [];
  private nextId = 1; private t = 0; private ambT = [0.2, 0.9, 1.5];
  private redLeft = 0; private toRed = 0;
  private ev: RoundEvent | null = null; private bannerT = 0;
  private streak = 0; private jumped = false;
  private cur: Stats = zero(); private last: Stats | null = null; private lastT = 0;
  private stockPulse = 0; private evT = 0; private honkT = 1;

  // player
  private px = 300; private py = HOME_Y; private pstate: PState = "idle";
  private dest = { x: 300, y: HOME_Y };
  private target: Veh | null = null; private haggle: Haggle | null = null;
  private pauseT = 0; private lockT = 0; private inv = 0;

  // multiplayer
  private net: RoomClient | null = null; private roomId: string | null = null; private cap = 6;
  private rejoinT = 5; private peers = new Map<string, Peer>(); private claimV: Veh | null = null; private claimT = 0;

  // bot (homepage demo)
  private botT = 0.8; private botHT = 0; private demoCycles = 0; private demoJ = 0;

  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private onTap = (e: PointerEvent) => this.tap(e);

  constructor(private canvas: HTMLCanvasElement, private opts: Opts) {
    this.demo = opts.demo; this.avatar = opts.avatar; this.playing = opts.demo;
    if (opts.junction && !opts.demo) this.jid = opts.junction;
    this.clockFn = opts.clock ?? (() => Date.now());
    this.money = opts.money ?? 0; this.stock = { ...emptyStock(), ...(opts.stock ?? {}) };
    this.storage = { ...emptyStock(), ...(opts.storage ?? {}) };
    if (this.demo) this.stock = { ...emptyStock(), water: 6, drink: 3, snack: 3, gadget: 2 };
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR to protect low-end phones
    canvas.width = W * dpr; canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.loop = new Loop((dt) => this.update(dt), () => this.draw());
    if (!this.demo) canvas.addEventListener("pointerdown", this.onTap);
    this.snap = this.makeSnap();
    if (opts.multi) this.initNet();
  }

  /** The bot only plays when the real road is empty. */
  private botOn() { return this.demo && this.peers.size === 0; }
  private initNet() {
    this.net = new RoomClient({
      onRoster: (r) => this.onRoster(r),
      onSnap: (p) => { for (const [id, x, y, s] of p) { const q = this.peers.get(id); if (q) { q.tx = x; q.ty = y; q.s = s; } } },
      onClaimResult: (key, winner) => this.onClaimResult(key, winner),
      onSettled: (key, by, sold, price) => this.onSettled(key, by, sold, price),
    });
    this.net.join(this.demo ? { play: false } : { junction: this.jid, play: false });
  }
  private onRoster(r: RoomInfo) {
    this.cap = r.cap;
    const me = this.net?.id;
    const next = new Map<string, Peer>();
    for (const q of r.players) {
      if (q.id === me) continue;
      const old = this.peers.get(q.id);
      next.set(q.id, old ?? { id: q.id, name: q.name, avatar: { ...this.avatar, ...(q.avatar ?? {}) }, x: 300, y: HOME_Y, tx: 300, ty: HOME_Y, s: "idle" });
    }
    this.peers = next;
    if (this.demo && next.size > 0 && this.pstate !== "idle") { this.cancelAction(); this.pstate = "idle"; } // real players take over from the bot
    if (r.room !== this.roomId) { // moved room (or the first one): reseed so we see this room's cars
      this.roomId = r.room;
      if (r.junction && r.junction !== this.jid && (JUNCTIONS as Record<string, unknown>)[r.junction]) this.jid = r.junction as JunctionId;
      this.needSync = true; this.claimV = null;
      if (this.pstate === "wait") this.pstate = "idle";
      this.notify();
    }
  }
  private vehByKey(key: string) { return this.vehs.find((v) => v.key === key); }
  private onClaimResult(key: string, winner: string) {
    const v = this.vehByKey(key); if (v) v.taken = true;
    if (!this.claimV || this.claimV.key !== key) return;
    const mine = this.claimV; this.claimV = null;
    if (winner === this.net?.id) this.reallyArrive(mine);
    else { // somebody else was picked. The buyer turns you down.
      this.say(mine, "I don buy am", "#ffb4ab"); this.target = null;
      this.streak = 0; this.pstate = "pause"; this.pauseT = 0.6;
    }
  }
  private onSettled(key: string, by: string, sold: boolean, price: number) {
    if (by === this.net?.id) return;
    const v = this.vehByKey(key); if (!v) return;
    v.done = true; v.tell = "ignore"; v.sold = sold;
    if (sold) this.pops.push({ x: v.x, y: v.y - v.h / 2 - 16, t: 0, text: `+${naira(price)}`, color: "#ffd84a" });
  }

  start() { this.loop.start(); }
  pause() { this.loop.stop(); }
  resume() { this.loop.start(); this.needSync = true; } // the light moved on while we were away
  destroy() { this.net?.close(); this.loop.stop(); this.canvas.removeEventListener("pointerdown", this.onTap); this.listeners.clear(); }

  // ---------- React bridge ----------
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;
  private makeSnap(): Snapshot {
    const n = countStock(this.stock);
    return {
      playing: this.playing, phase: this.phase, money: this.money, stock: { ...this.stock }, storage: { ...this.storage }, carrying: n,
      junction: this.jid, outOfStock: this.playing && n === 0,
    };
  }
  private notify() {
    this.snap = this.makeSnap();
    if (!this.demo) this.opts.onBank?.(this.money, { ...this.stock }, { ...this.storage });
    this.listeners.forEach((f) => f());
  }

  // ---------- shop and entering (only while you are not on the road) ----------
  /** Move one item from your stock at home onto your tray. */
  load(id: ItemId) {
    if (this.playing || this.storage[id] <= 0 || countStock(this.stock) >= CAPACITY) return;
    this.storage[id]--; this.stock[id]++; this.notify();
  }
  /** Put one item from your tray back at home. */
  unload(id: ItemId) {
    if (this.playing || this.stock[id] <= 0) return;
    this.stock[id]--; this.storage[id]++; this.notify();
  }
  selectJunction(id: JunctionId) { if (!this.playing && id !== this.jid) { this.jid = id; this.net?.join({ junction: id, play: false }); this.needSync = true; this.opts.onJunction?.(id); this.notify(); } }

  /** Join the junction. You walk on at whatever light is showing. */
  play() {
    if (this.playing || countStock(this.stock) === 0) return;
    this.playing = true; this.streak = 0; this.cur = zero();
    this.cancelAction(); this.px = 300; this.py = HOME_Y; this.pstate = "idle";
    this.net?.join({ junction: this.jid, play: true, avatar: this.avatar }); // takes a seat; the server may move us to a roomier room
    this.notify();
  }
  /** Walk off and go shopping. You cannot leave while the cars are moving and you are in the road. */
  leave() {
    if (!this.playing || this.demo) return;
    if (this.phase === "green" && this.inRoad()) {
      this.pops.push({ x: this.px, y: this.py - 80, t: 0, text: "Get off the road first!", color: "#ffd84a" });
      return;
    }
    this.cancelAction(); this.playing = false; this.pstate = "idle"; this.streak = 0;
    this.net?.join({ junction: this.jid, play: false }); // give the seat back
    this.notify();
  }

  private cancelAction() { this.claimV = null; this.haggle = null; this.target = null; if (this.pstate === "running" || this.pstate === "haggle" || this.pstate === "wait") this.pstate = "idle"; }

  private loseRandomItem(): ItemId | null {
    const have = ITEM_IDS.filter((k) => this.stock[k] > 0);
    if (!have.length) return null;
    const k = pickOne(have); this.stock[k]--; this.stockPulse = 0.8; return k;
  }

  // ---------- the light cycle ----------
  private syncLight() {
    const J = JUNCTIONS[this.jid];
    const L = lightAt(this.clockFn(), J);
    this.redLeft = L.redLeft; this.toRed = L.toRed;
    if (this.needSync || L.cycle !== this.cycle) { this.beginCycle(L.cycle, L.local, L.phase); return; }
    if (L.phase !== this.phase) {
      this.phase = L.phase;
      if (L.phase === "yellow") this.pops.push({ x: W / 2, y: 190, t: 0, text: "LIGHT DEY CHANGE!", color: "#ffd84a" });
      if (L.phase === "green") this.goGreen();
    }
    // okada and keke riders jump the light, just before it turns green
    if (this.phase === "yellow" && !this.jumped && L.redLeft <= 0.7) {
      this.jumped = true;
      for (const v of this.vehs) {
        if (v.st !== "stopped" || (v.kind !== "okada" && v.kind !== "keke")) continue;
        if (this.haggle?.v === v || this.target === v || Math.random() > 0.4) continue;
        v.st = "leaving"; v.vx = 40;
        this.pops.push({ x: v.x, y: v.y - v.h / 2 - 12, t: 0, text: "Oya go!", color: "#ffd84a" });
      }
    }
  }

  /** A new light starts, or we have just joined one that is already running. */
  private beginCycle(cycle: number, local: number, phase: Phase) {
    const rolled = !this.needSync && this.cycle >= 0 && cycle === this.cycle + 1;
    this.needSync = false;
    if (this.demo && !this.roomId && rolled && ++this.demoCycles % 3 === 0) { // the homepage shows a different junction every few lights
      this.demoJ = (this.demoJ + 1) % JUNCTION_LIST.length; this.jid = JUNCTION_LIST[this.demoJ].id; this.needSync = true;
    }
    this.cycle = cycle; this.phase = phase; this.evT = 0;
    const rng = mulberry32(hashString(`${this.jid}:${this.roomId ?? ""}:${cycle}`)); // everybody at this junction gets the same cars
    this.ev = rollRoundEvent(rng);
    this.cur = zero(); this.jumped = false; this.vehs = []; this.pops = [];
    this.haggle = null; this.claimV = null; if (this.pstate === "running" || this.pstate === "haggle" || this.pstate === "wait") this.pstate = "idle"; this.target = null;
    if (phase !== "green") {
      this.ambient = [];
      this.buildQueue(rng);
      let el = Math.min(local, 7); // joined late: the cars have already pulled up
      while (el > 0) { const s = Math.min(0.05, el); this.updateTraffic(s); el -= s; }
      if (this.playing || this.demo) this.bannerT = Math.max(0.1, 4 - local);
      if (rolled && this.playing && this.ev.kind === "lastma") for (let i = 0; i < 2; i++) this.loseRandomItem();
      if (rolled && this.playing) this.notify();
    }
  }

  private buildQueue(rng: Rng) {
    const j = JUNCTIONS[this.jid];
    const extra = this.ev?.kind === "goslow" ? 1 : 0;
    LANE_Y.forEach((ly, lane) => {
      const n = j.perLane[0] + Math.floor(rng() * (j.perLane[1] - j.perLane[0] + 1)) + extra;
      let front = STOP_X - 6, leader: Veh | null = null;
      for (let k = 0; k < n; k++) {
        const kind = pickKind(j.mix, rng), s = SPEC[kind];
        const slotX = front - s.w / 2;
        if (slotX - s.w / 2 < 40) break;
        front = slotX - s.w / 2 - 16; // next car's bumper sits one gap behind this car
        const buyer = makeBuyer(kind, this.ev?.kind ?? "normal", rng);
        const y = ly + 20 - s.h / 2 - 2;
        const v: Veh = {
          id: this.nextId++, kind, x: -s.w / 2 - 40 - k * 175 - rng() * 40, y, w: s.w, h: s.h,
          tint: pickColor(kind, rng), tell: buyer.tell, sold: false,
          lane, slotX, vx: 0, st: "arriving", buyer, done: false, launchIn: 0, leader,
          key: `${this.cycle}:${lane}:${k}`, taken: false,
        };
        this.vehs.push(v); leader = v;
      }
    });
  }

  private goGreen() {
    this.phase = "green";
    if (this.haggle) { this.say(this.haggle.v, "Light don change!", "#fff"); this.haggle = null; }
    this.target = null;
    if (this.playing) {
      if (this.pstate === "running" || this.pstate === "haggle") this.pstate = "idle";
      if (this.inRoad() && this.pstate !== "walk") {
        // you freeze for a moment before you run. That is what makes standing at the front car risky.
        this.pstate = "pause"; this.pauseT = Math.max(this.pauseT, 0.55); this.lockT = Math.max(this.lockT, 0.55);
        this.pops.push({ x: this.px, y: this.py - 70, t: 0, text: "Run!", color: "#7dffa8" });
      }
    }
    // the front car goes first, the rest follow one by one
    for (let lane = 0; lane < LANE_Y.length; lane++) {
      const cars = this.vehs.filter((v) => v.lane === lane && v.st === "stopped").sort((a, b) => b.slotX - a.slotX);
      cars.forEach((v, i) => { v.launchIn = 0.35 + i * 0.45 + Math.random() * 0.3; });
    }
    if (this.playing || this.demo) { this.last = { ...this.cur }; this.lastT = 7; }
    this.notify();
  }

  // ---------- input ----------
  private toCanvas(ev: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }
  private tap(ev: PointerEvent) {
    if (!this.playing) return;
    const { x, y } = this.toCanvas(ev);
    const selling = this.phase === "red" || this.phase === "yellow";
    if (selling && this.pstate === "haggle" && this.haggle) {
      const r = this.haggleRects(this.haggle.v);
      const inRect = (b: { x: number; y: number; w: number; h: number }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      if (inRect(r.sell)) { this.settle(false); return; }
      if (inRect(r.push)) { this.settle(true); return; }
    }
    if (this.lockT > 0) return; // frozen by the green light, or knocked down
    // tapping the pavement sends you back there, out of the traffic
    if (y > BOTTOM + 8) { this.retreat(x, y); return; }
    if (!selling || this.pstate === "pause") return;
    const v = this.pickVeh(x, y);
    if (v) this.go(v);
  }
  private pickVeh(x: number, y: number): Veh | null {
    let best: Veh | null = null, bd = 1e9;
    for (const v of this.vehs) {
      if (v.st !== "stopped" || v.done || v.taken) continue;
      const dx = Math.abs(v.x - x), dy = Math.abs(v.y - y);
      if (dx < v.w / 2 + 18 && dy < v.h / 2 + 26) { const d = dx + dy; if (d < bd) { best = v; bd = d; } }
    }
    return best;
  }
  private go(v: Veh) { this.target = v; this.pstate = "running"; }

  /** Run back to the pavement, dropping whatever you were doing. */
  private retreat(x: number, y = HOME_Y) {
    this.cancelAction();
    this.dest = { x: Math.min(W - 30, Math.max(30, x)), y: Math.min(H - 70, Math.max(BOTTOM + 40, y)) };
    this.pstate = "walk"; this.pauseT = 0;
  }

  // ---------- buying ----------
  private arrive(v: Veh) {
    if (v.done || v.st !== "stopped") { this.pstate = "idle"; return; }
    if (this.net?.connected && this.net.id && this.roomId && !this.demo) { // shared road: ask the server who gets this buyer
      this.claimV = v; this.claimT = CLAIM_TIMEOUT; this.pstate = "wait"; this.net.claim(v.key); return;
    }
    this.reallyArrive(v);
  }
  private reallyArrive(v: Veh) {
    if (v.done || v.st !== "stopped") { this.pstate = "idle"; return; }
    const b = v.buyer;
    if (!b.willBuy) { this.reject(v, pickOne(NO_LINES)); return; }
    if (this.stock[b.want] <= 0) {
      v.done = true; v.tell = "ignore"; this.net?.settle(v.key, false);
      this.say(v, `You no get ${ITEMS[b.want].name.toLowerCase()}!`, "#fff");
      this.pstate = "pause"; this.pauseT = 0.35; return;
    }
    this.haggle = { v, t: 0, dur: HAGGLE_SECS }; this.pstate = "haggle";
  }
  private reject(v: Veh, line: string) {
    v.done = true; v.tell = "ignore"; this.streak = 0; this.cur.rejects++; this.net?.settle(v.key, false);
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
    this.stock[b.want]--; this.money += price; this.stockPulse = 0.8;
    v.sold = true; v.done = true; this.net?.settle(v.key, true, price);
    this.streak++; this.cur.sales++; this.cur.earned += price; this.cur.bestStreak = Math.max(this.cur.bestStreak, this.streak);
    this.pops.push({ x: v.x, y: v.y - v.h / 2 - 16, t: 0, text: `+${naira(price)}`, color: "#7dffa8" });
    this.say(v, pickOne(YES_LINES), "#fff", 22);
    this.pstate = "idle";
    if (countStock(this.stock) === 0) this.pops.push({ x: this.px, y: this.py - 90, t: 0, text: "Tray empty!", color: "#ffd84a" });
    this.notify();
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
  private inRoad() { return this.py > TOP - 8 && this.py < BOTTOM + 14; }

  private update(dt: number) {
    this.t += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.lastT > 0) this.lastT -= dt;
    if (this.stockPulse > 0) this.stockPulse -= dt;
    this.evT += dt;
    if (this.ev?.kind === "goslow" && this.phase !== "green" && (this.honkT -= dt) <= 0) {
      this.honkT = 0.7 + Math.random() * 1.1; // a go-slow means horns
      const stopped = this.vehs.filter((v) => v.st === "stopped");
      if (stopped.length) { const v = pickOne(stopped); this.pops.push({ x: v.x, y: v.y - v.h / 2 - 12, t: 0, text: pickOne(["Pam pam!", "Peeen!", "Oya move!"]), color: "#ffd84a" }); }
    }
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.1);
    this.inv -= dt; this.lockT -= dt;
    this.syncLight();
    if (this.botOn()) this.botUpdate(dt);
    this.updateAmbient(dt);
    if (this.vehs.length) this.updateTraffic(dt);
    if (this.playing) this.updatePlayer(dt);
    if (this.demo && this.net && this.peers.size === 0 && (this.rejoinT -= dt) <= 0) { this.rejoinT = 5; this.net.join({ play: false }); } // look for a busier road
    for (const q of this.peers.values()) { const k = Math.min(1, dt * 10); q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; }
    if (this.net && this.playing && !this.demo) this.net.pos(this.px, this.py, this.pstate);
  }

  /** Cars passing while nobody is stopped, so the road is never empty. They are never in your way. */
  private updateAmbient(dt: number) {
    const j = JUNCTIONS[this.jid];
    if (this.vehs.length === 0 && this.toRed > 4.5) {
      LANE_Y.forEach((ly, i) => {
        this.ambT[i] -= dt;
        if (this.ambT[i] <= 0) {
          const kind = pickKind(j.mix), s = SPEC[kind];
          this.ambient.push({ id: this.nextId++, kind, x: -s.w, y: ly + 20 - s.h / 2 - 2, w: s.w, h: s.h, tint: pickColor(kind), tell: "ignore", sold: false, vx: rand(230, 300) });
          this.ambT[i] = rand(1, 2.4);
        }
      });
    }
    for (const a of this.ambient) a.x += a.vx * dt;
    this.ambient = this.ambient.filter((a) => a.x < W + 120);
  }

  private updateTraffic(dt: number) {
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
      } else if (v.st === "leaving") {
        v.vx = Math.min(430, v.vx + 360 * dt);
        v.x += v.vx * dt;
      }
    }
    this.vehs = this.vehs.filter((v) => v.x - v.w / 2 < W + 40);
  }

  private updatePlayer(dt: number) {
    if (this.pstate === "wait") { // waiting for the server to pick the seller
      if ((this.claimT -= dt) <= 0 && this.claimV) { const v = this.claimV; this.claimV = null; this.reallyArrive(v); }
    } else if (this.pstate === "pause") {
      this.pauseT -= dt;
      // if the light changed while you were being turned down, get off the road
      if (this.pauseT <= 0) {
        if (this.phase === "green" && this.inRoad()) { this.dest = { x: this.px, y: HOME_Y }; this.pstate = "walk"; }
        else this.pstate = "idle";
      }
    } else if (this.pstate === "running" && this.target) {
      const v = this.target;
      if (v.st !== "stopped" || v.done || v.taken) { if (v.taken && !v.done) this.say(v, "Too late!", "#cfcfd6"); this.target = null; this.pstate = "idle"; }
      else {
        const tx = v.x - v.w * 0.3, ty = groundOf(v) + 14;
        const d = Math.hypot(tx - this.px, ty - this.py);
        if (d < 8) this.arrive(v);
        else { this.px += ((tx - this.px) / d) * PLAYER_SPEED * dt; this.py += ((ty - this.py) / d) * PLAYER_SPEED * dt; }
      }
    } else if (this.pstate === "haggle" && this.haggle) {
      this.haggle.t += dt;
      if (this.haggle.t >= this.haggle.dur && !this.demo) this.settle(false); // be nice: no answer means you take the offer
    } else if (this.pstate === "walk") {
      const d = Math.hypot(this.dest.x - this.px, this.dest.y - this.py);
      if (d < 5) this.pstate = "idle";
      else { const s = Math.min(d, PLAYER_SPEED * 1.15 * dt); this.px += ((this.dest.x - this.px) / d) * s; this.py += ((this.dest.y - this.py) / d) * s; }
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
    this.cur.hits++; this.cur.earned -= loss; this.streak = 0;
    this.pops.push({ x: this.px, y: this.py - 80, t: 0, text: `Ouch! -${naira(loss)}${lost ? ` and ${ITEMS[lost].name.toLowerCase()}` : ""}`, color: "#ff8a80" });
    this.pstate = "pause"; this.pauseT = 1; this.lockT = 1; this.inv = 1.6; this.haggle = null; this.target = null; this.py = HOME_Y;
    this.notify();
  }

  // ---------- homepage demo bot ----------
  private botUpdate(dt: number) {
    if (countStock(this.stock) === 0) this.stock = { ...emptyStock(), water: 6, drink: 3, snack: 3, gadget: 2 };
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
    else if (this.phase === "yellow" && this.inRoad()) this.retreat(this.px, HOME_Y); // nobody worth it: back to the pavement
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
    const wk = this.ev ? Math.min(1, this.evT / 1.2) : 0, wkind = this.ev?.kind ?? "normal";
    drawWeatherTint(c, wkind, wk);
    drawLight(c, this.phase, this.t);

    type D = { key: number; paint: () => void };
    const items: D[] = [];
    for (const a of this.ambient) items.push({ key: groundOf(a), paint: () => drawVehicle(c, a) });
    for (const v of this.vehs) items.push({ key: groundOf(v), paint: () => drawVehicle(c, v) });
    for (const q of this.peers.values()) items.push({ key: q.y + 14, paint: () => this.drawPeer(q) });
    if (this.playing && (!this.demo || this.botOn())) items.push({ key: this.py + 14, paint: () => this.drawPlayer() });
    if (wkind === "lastma") for (const o of OFFICER_SPOTS) items.push({ key: o.y, paint: () => drawOfficer(c, o.x, o.y, this.t, o.id, wk) });
    items.sort((a, b) => a.key - b.key);
    for (const d of items) d.paint();

    drawWeatherFront(c, wkind, this.t, wk);
    this.drawTells();
    this.drawPops();
    if (this.haggle) this.drawHaggle(this.haggle);
    this.drawHud();
  }

  private drawPeer(q: Peer) {
    const c = this.ctx, moving = q.s === "running" || q.s === "walk";
    drawAvatar(c, q.x, q.y, q.avatar, this.t, 1.05, moving);
    if (q.name) this.text(q.name, q.x, q.y - 66, 14, "#ffffff", "center");
  }

  private drawPlayer() {
    const c = this.ctx;
    if (this.inv > 0 && Math.floor(this.t * 12) % 2) c.globalAlpha = 0.45;
    drawAvatar(c, this.px, this.py, this.avatar, this.t, 1.05, this.pstate === "running" || this.pstate === "walk");
    c.globalAlpha = 1;
  }

  /** Floating hint above stopped cars: keen buyers show what they want, "maybe" buyers show a question mark. */
  private drawTells() {
    const c = this.ctx;
    for (const v of this.vehs) {
      if (v.st !== "stopped" || v.done || v.taken || v.tell === "ignore") continue;
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
    // money (hidden while the homepage is just watching other players)
    if (this.botOn() || !this.demo) { this.panel(14, 12, 208, 44); this.text(naira(this.money), 28, 46, 30, "#ffd84a"); }
    // who is on this road
    if (this.net && this.roomId) {
      const n = this.peers.size + (this.playing && !this.demo ? 1 : 0);
      this.panel(W - 214, 12, 200, 44);
      this.text(`${n} / ${this.cap} HUSTLERS`, W - 114, 42, 22, n >= this.cap ? "#ff9f43" : "#7dffa8", "center");
    }
    // light timer
    const tx = W / 2 - 160;
    this.panel(tx, 12, 320, 44);
    if (this.phase === "red" || this.phase === "yellow") {
      const frac = Math.max(0, Math.min(1, this.redLeft / JUNCTIONS[this.jid].red));
      c.fillStyle = "rgba(255,255,255,.14)"; c.beginPath(); c.roundRect(tx + 14, 38, 292, 10, 5); c.fill();
      c.fillStyle = this.phase === "yellow" ? "#ffc400" : "#ff453a"; c.beginPath(); c.roundRect(tx + 14, 38, 292 * frac, 10, 5); c.fill();
      this.text(this.phase === "yellow" ? "GET READY TO RUN!" : "RED LIGHT: SELL!", W / 2, 32, 20, this.phase === "yellow" ? "#ffd84a" : "#ffffff", "center");
    } else if (this.vehs.length > 0) {
      this.text(this.playing || this.demo ? "GREEN! GET OFF THE ROAD" : "GREEN LIGHT", W / 2, 42, 22, "#5cff9a", "center");
    } else {
      this.text(`NEXT RED IN ${Math.max(1, Math.ceil(this.toRed))}`, W / 2, 42, 22, "#ffffff", "center");
    }
    // event banner at the start of a red, or how the last red went. Sits under the billboards.
    if (this.ev && this.bannerT > 0 && (this.phase === "red" || this.phase === "yellow")) {
      const e = this.ev, w = 440;
      c.globalAlpha = Math.min(1, this.bannerT);
      this.panel(W / 2 - w / 2, 156, w, 28, e.good ? "rgba(14,143,78,.95)" : e.kind === "normal" ? "rgba(27,27,34,.9)" : "rgba(200,40,30,.95)");
      c.font = "bold 14px sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff";
      c.fillText(`🎲 ${e.die}  ${e.title}: ${e.text}`, W / 2, 175);
      c.globalAlpha = 1;
    } else if (this.last && this.lastT > 0 && this.phase === "green") {
      const l = this.last, w = 440;
      c.globalAlpha = Math.min(1, this.lastT);
      this.panel(W / 2 - w / 2, 156, w, 28, "rgba(27,27,34,.92)");
      c.font = "bold 14px sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff";
      c.fillText(`LAST RED: ${l.sales} sold, ${naira(l.earned)}${l.hits ? `, knocked down ${l.hits}` : ""}`, W / 2, 175);
      c.globalAlpha = 1;
    }
    if (!this.playing) return;

    // tray: the total first, then what is left of each item
    const total = countStock(this.stock), y0 = H - 56, pulse = this.stockPulse > 0 && Math.floor(this.t * 14) % 2 === 0;
    // the everyday four always show; market-only goods show while you are carrying them. Slides left to leave room for the streak badge.
    const shown = ITEM_IDS.filter((id) => CORE_ITEMS.includes(id) || this.stock[id] > 0);
    const pw = shown.length * 66 + 112, left = Math.max(14, Math.min(208, 750 - pw)), x0 = left + 92;
    this.panel(left, y0 - 4, pw, 50, total === 0 ? "rgba(160,30,24,.92)" : "rgba(27,27,34,.88)");
    c.font = "bold 10px sans-serif"; c.textAlign = "left"; c.fillStyle = "rgba(255,255,255,.7)"; c.fillText("ON TRAY", x0 - 80, y0 + 12);
    this.text(total === 0 ? "EMPTY" : `${total}`, x0 - 80, y0 + 38, total === 0 ? 20 : 28, pulse ? "#ff9f43" : "#ffd84a");
    shown.forEach((id, i) => {
      const x = x0 + i * 66;
      c.font = "20px sans-serif"; c.textAlign = "left"; c.fillStyle = "#fff"; c.fillText(ITEMS[id].icon, x, y0 + 28);
      this.text(`x${this.stock[id]}`, x + 28, y0 + 30, 20, this.stock[id] > 0 ? "#ffffff" : "#8c8c96");
    });
    if (total === 0) { this.text("TRAY EMPTY. LEAVE TO RESTOCK", W / 2, 206, 24, "#ffd84a", "center"); }
    // streak
    if (this.streak >= 2 && (this.phase === "red" || this.phase === "yellow")) {
      this.panel(W - 196, H - 58, 180, 44, "rgba(232,89,12,.95)");
      this.text(`${this.streak} IN A ROW  +${Math.round(this.bonus() * 100)}%`, W - 106, H - 28, 20, "#fff", "center");
    }
    // the way out, shown while you are in the road
    if (this.inRoad() && (this.phase === "yellow" || (this.phase === "red" && this.redLeft < 6)) && Math.floor(this.t * 3) % 2 === 0) {
      this.text("TAP THE PAVEMENT TO RUN BACK", W / 2, BOTTOM + 34, 22, "#ffd84a", "center");
    }
  }
}

export { WARN };
