import { drawAvatar, type AvatarConfig } from "../avatar/avatar";
import { SPEC, drawVehicle, drawWalker, renderBackdrop } from "../engine/draw";
import { Loop } from "../engine/loop";
import { H, W, type Entity, type Kind } from "../engine/types";

const TOP = 150, BOTTOM = 360;
const LANES = [{ y: 185, dir: 1, v: 120 }, { y: 255, dir: 1, v: 170 }, { y: 325, dir: -1, v: 140 }];
const HOME_Y = 450, SPEED = 190;
type State = "idle" | "chasing" | "returning" | "stunned";
type Pop = { x: number; y: number; t: number; text: string; color: string };

export class StreetScene {
  private ctx: CanvasRenderingContext2D;
  private loop: Loop;
  private bg!: HTMLCanvasElement;
  private ents: Entity[] = [];
  private pops: Pop[] = [];
  private nextId = 1; private spawnT = [0.5, 1, 1.5]; private walkT = 0; private botT = 1.5;
  private px = W / 2; private py = HOME_Y;
  private state: State = "idle"; private target: Entity | null = null;
  private stun = 0; private inv = 0; private t = 0;
  money = 0; hits = 0;
  private onTap = (e: PointerEvent) => this.tap(e);

  constructor(private canvas: HTMLCanvasElement, private opts: { demo: boolean; avatar: AvatarConfig }) {
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR to protect low-end phones
    canvas.width = W * dpr; canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.bg = renderBackdrop(TOP, BOTTOM, H);
    this.loop = new Loop((dt) => this.update(dt), () => this.draw());
    if (!opts.demo) canvas.addEventListener("pointerdown", this.onTap);
  }
  start() { this.loop.start(); } pause() { this.loop.stop(); } resume() { this.loop.start(); }
  destroy() { this.loop.stop(); this.canvas.removeEventListener("pointerdown", this.onTap); }

  private tap(ev: PointerEvent) {
    if (this.state === "stunned") return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W, y = ((ev.clientY - r.top) / r.height) * H;
    this.pick(x, y);
  }
  private pick(x: number, y: number) {
    let best: Entity | null = null, bd = 1e9;
    for (const e of this.ents) {
      if (e.sold) continue;
      const d = Math.hypot(e.x - x, (e.y - (e.vehicle ? 0 : 16)) - y);
      if (d < Math.max(e.w, 40) * 0.8 + 14 && d < bd) { best = e; bd = d; }
    }
    if (best) { this.target = best; this.state = "chasing"; }
  }

  private spawn(kind: Kind, x: number, y: number, vx: number, vehicle: boolean) {
    const s = kind === "walker" ? { w: 14, h: 30, price: y < TOP ? 25 : 15, color: ["#e8412c", "#7a3fb0", "#0f8f4f", "#fff"][this.nextId % 4] } : SPEC[kind];
    this.ents.push({ id: this.nextId++, kind, x, y, w: s.w, h: s.h, vx, price: s.price, sold: false, vehicle, tint: s.color });
  }
  private pickKind(): Kind {
    const ks = Object.keys(SPEC) as (keyof typeof SPEC)[];
    let r = Math.random() * ks.reduce((a, k) => a + SPEC[k].weight, 0);
    for (const k of ks) { r -= SPEC[k].weight; if (r <= 0) return k; }
    return "car";
  }

  private update(dt: number) {
    this.t += dt;
    // spawning
    LANES.forEach((l, i) => {
      this.spawnT[i] -= dt;
      if (this.spawnT[i] <= 0) {
        const k = this.pickKind();
        this.spawn(k, l.dir > 0 ? -60 : W + 60, l.y, l.dir * l.v * (0.8 + Math.random() * 0.5), true);
        this.spawnT[i] = 1.3 + Math.random() * 1.8;
      }
    });
    this.walkT -= dt;
    if (this.walkT <= 0) {
      const top = Math.random() < 0.3, d = Math.random() < 0.5 ? 1 : -1;
      this.spawn("walker", d > 0 ? -20 : W + 20, top ? 135 : 410, d * 40, false);
      this.walkT = 1.2 + Math.random();
    }
    for (const e of this.ents) e.x += e.vx * dt * (e.sold ? 0.3 : 1);
    this.ents = this.ents.filter((e) => e.x > -150 && e.x < W + 150);
    if (this.target && !this.ents.includes(this.target)) { this.target = null; if (this.state === "chasing") this.state = "returning"; }

    // player
    this.inv -= dt;
    if (this.state === "stunned") { this.stun -= dt; if (this.stun <= 0) this.state = "idle"; }
    else if (this.state === "chasing" && this.target) {
      const tx = this.target.x, ty = this.target.vehicle ? this.target.y : this.target.y;
      const d = Math.hypot(tx - this.px, ty - this.py);
      if (d < 26) this.sale(this.target);
      else { this.px += ((tx - this.px) / d) * SPEED * dt; this.py += ((ty - this.py) / d) * SPEED * dt; }
    } else if (this.state === "returning") {
      const dy = HOME_Y - this.py;
      if (Math.abs(dy) < 4) { this.py = HOME_Y; this.state = "idle"; } else this.py += Math.sign(dy) * SPEED * dt;
    }
    // danger: crossing the road
    if (this.inv <= 0 && this.py > TOP - 20 && this.py < BOTTOM + 25 && this.state !== "stunned") {
      for (const e of this.ents) {
        if (!e.vehicle || e === this.target) continue;
        if (Math.abs(this.px - e.x) < e.w / 2 + 8 && Math.abs(this.py - 10 - e.y) < e.h / 2 + 12) { this.hit(); break; }
      }
    }
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1);

    // demo bot: taps something every so often, so the hero shows real gameplay
    if (this.opts.demo && this.state === "idle") {
      this.botT -= dt;
      if (this.botT <= 0) {
        const c = this.ents.filter((e) => !e.sold && e.x > 60 && e.x < W - 60 && (e.vehicle ? e.y > 240 || Math.random() < 0.3 : e.y > TOP));
        const e = c[Math.floor(Math.random() * c.length)];
        if (e) this.pick(e.x, e.vehicle ? e.y : e.y - 16);
        this.botT = 1.2 + Math.random();
      }
    }
  }
  private sale(e: Entity) {
    e.sold = true; this.money += e.price; this.target = null; this.state = "returning";
    this.pops.push({ x: e.x, y: e.y - 30, t: 0, text: `+₦${e.price}`, color: "#0a6638" });
  }
  private hit() {
    const loss = Math.min(this.money, 40); this.money -= loss; this.hits++;
    this.pops.push({ x: this.px, y: this.py - 60, t: 0, text: loss ? `-₦${loss} Ouch!` : "Ouch!", color: "#c0392b" });
    this.state = "stunned"; this.stun = 0.8; this.inv = 1.6; this.target = null; this.py = HOME_Y;
  }

  private draw() {
    const c = this.ctx;
    c.drawImage(this.bg, 0, 0, W, H);
    const sorted = [...this.ents].sort((a, b) => a.y - b.y);
    for (const e of sorted) e.vehicle ? drawVehicle(c, e) : drawWalker(c, e, this.t);
    if (this.inv > 0 && Math.floor(this.t * 12) % 2) c.globalAlpha = 0.45;
    drawAvatar(c, this.px, this.py, this.opts.avatar, this.t, 1.3, this.state === "chasing" || this.state === "returning");
    c.globalAlpha = 1;
    c.font = "bold 20px sans-serif"; c.textAlign = "center";
    for (const p of this.pops) { c.globalAlpha = 1 - p.t; c.fillStyle = p.color; c.fillText(p.text, p.x, p.y - p.t * 30); }
    c.globalAlpha = 1; c.textAlign = "left";
    c.fillStyle = "#2a2118"; c.beginPath(); c.roundRect(14, H - 50, 190, 36, 12); c.fill();
    c.fillStyle = "#ffe45c"; c.font = "bold 20px sans-serif"; c.fillText(`₦ ${this.money.toLocaleString()}`, 28, H - 25);
  }
}
