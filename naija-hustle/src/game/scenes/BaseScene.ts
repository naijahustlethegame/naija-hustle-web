import { drawAvatar } from "../avatar/avatar";
import { sfx } from "../audio/sfx";
import { SPEC, makeBuyer, pickColor, pickKind } from "../engine/buyers";
import { drawLight, drawVehicle, renderBackdrop, type LightState, type VehView } from "../engine/draw";
import { JUNCTIONS } from "../engine/junctions";
import { BOTTOM, DISPLAY_FONT, LANE_Y, STOP_X } from "../engine/layout";
import { Loop } from "../engine/loop";
import { H, W } from "../engine/types";
import { sellerById, type SellerDef } from "../sellers";

type Car = VehView & { slotX: number; vx: number; st: "arriving" | "stopped" | "leaving"; taken: boolean; leader: Car | null; lane: number };
type Worker = { def: SellerDef; x: number; y: number; target: Car | null; wait: number; home: number };
type Pop = { x: number; y: number; t: number; text: string };

/**
 * The sellers' own corner. It is a looping red light with hired sellers working it
 * by themselves. Purely visual: what they earn is worked out from the clock in sellers.ts.
 */
export class BaseScene {
  private ctx: CanvasRenderingContext2D; private loop: Loop; private bg: HTMLCanvasElement;
  private cars: Car[] = []; private workers: Worker[] = []; private pops: Pop[] = [];
  private t = 0; private nextId = 1; private light: LightState = "green"; private phaseT = 4;

  constructor(private canvas: HTMLCanvasElement, private sound = false) {
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr; this.ctx.scale(dpr, dpr);
    this.bg = renderBackdrop(JUNCTIONS.obalende);
    this.loop = new Loop((dt) => this.update(dt), () => this.draw());
  }
  start() { this.loop.start(); this.hum(true); }
  pause() { this.loop.stop(); this.hum(false); }
  resume() { this.loop.start(); this.hum(true); }
  destroy() { this.loop.stop(); this.hum(false); }

  /** Street hum under the corner. Only on the sellers page (`sound`), never on the quiet homepage. */
  private hum(on: boolean) {
    if (!this.sound) return;
    if (on) sfx.configure({ defaultOn: true, level: 1 });
    sfx.ambience(on);
  }
  private fx(f: () => void) { if (this.sound) f(); }

  setSellers(ids: string[]) {
    const have = new Map(this.workers.map((w) => [w.def.id, w]));
    this.workers = ids.map((id, i) => {
      const def = sellerById(id)!; const old = have.get(id);
      // wait on the pavement to the right of Mama Put's stall
      const home = 300 + i * 130;
      return old ?? { def, x: home, y: BOTTOM + 70, target: null, wait: Math.random() * 2, home };
    }).filter((w) => w.def);
  }

  private startRed() {
    this.light = "red"; this.phaseT = 15; this.cars = [];
    this.fx(() => sfx.pass("car", 0.6)); // the queue rolls up
    LANE_Y.slice(0, 2).forEach((ly, lane) => {
      let front = STOP_X - 6, leader: Car | null = null;
      const N = 7, first = 4; let late = 0; // the first cars pull up together, the rest keep arriving while the light is red
      for (let k = 0; k < N; k++) {
        const kind = pickKind(JUNCTIONS.obalende.mix), s = SPEC[kind];
        const slotX = front - s.w / 2; if (slotX - s.w / 2 < 30) break; front = slotX - s.w / 2 - 16;
        if (k >= first) late = Math.max(late + 0.4, ((k - first + 0.3 + Math.random() * 0.7) / (N - first)) * 8);
        const b = makeBuyer(kind, "normal");
        const c: Car = { id: this.nextId++, kind, x: -s.w - Math.min(k, first) * 170 - late * 300, y: ly + 18 - s.h / 2, w: s.w, h: s.h, tint: pickColor(kind), tell: b.tell, sold: false,
          slotX, vx: 0, st: "arriving", taken: !b.willBuy, leader, lane };
        this.cars.push(c); leader = c;
      }
    });
  }

  private update(dt: number) {
    this.t += dt; this.phaseT -= dt;
    if (this.phaseT <= 0) {
      if (this.light === "green") this.startRed();
      else if (this.light === "red") {
        this.light = "yellow"; this.phaseT = 2;
        this.fx(() => { sfx.tick(); setTimeout(() => sfx.tick(), 700); setTimeout(() => sfx.tick(), 1400); });
        const front = this.cars.filter((c) => c.st === "stopped")[0]; // horns only once the light is nearly green
        if (front) this.fx(() => sfx.horn(front.kind, front.x, 0.6));
      }
      else {
        this.light = "green"; this.phaseT = 7; let n = 0;
        this.fx(() => sfx.go());
        for (const c of this.cars) if (c.st === "stopped") {
          c.st = "leaving"; c.vx = 20 + Math.random() * 40;
          if (n++ < 3) { const k = c.kind, x = c.x; this.fx(() => sfx.rev(k, x, 0.7)); }
        }
      }
    }
    for (const c of this.cars) {
      if (c.st === "arriving") {
        let nx = c.x + Math.min(320, (c.slotX - c.x) * 2.4 + 30) * dt;
        if (c.leader) nx = Math.min(nx, c.leader.x - c.leader.w / 2 - c.w / 2 - 10);
        if (c.slotX - nx < 1.2) { nx = c.slotX; c.st = "stopped"; }
        c.x = nx;
      } else if (c.st === "leaving") { c.vx = Math.min(420, c.vx + 340 * dt); c.x += c.vx * dt; }
    }
    this.cars = this.cars.filter((c) => c.x - c.w / 2 < W + 40);

    for (const w of this.workers) {
      if (w.target) {
        const c = w.target, tx = c.x - c.w * 0.3, ty = c.y + c.h / 2 + 14;
        if (c.st !== "stopped" || c.sold) { w.target = null; continue; }
        const d = Math.hypot(tx - w.x, ty - w.y);
        if (d < 8) {
          c.sold = true; w.target = null; w.wait = 1 + Math.random();
          if (c.taken) { this.pops.push({ x: c.x, y: c.y - 30, t: 0, text: "No thanks" }); this.fx(() => sfx.nope()); }
          else { this.pops.push({ x: c.x, y: c.y - 30, t: 0, text: "Sold!" }); this.fx(() => sfx.cashier(0.7, c.x)); }
        } else { w.x += ((tx - w.x) / d) * 200 * dt; w.y += ((ty - w.y) / d) * 200 * dt; }
      } else if (this.light === "red") {
        w.wait -= dt;
        if (w.wait <= 0) {
          const free = this.cars.filter((c) => c.st === "stopped" && !c.sold && !this.workers.some((o) => o !== w && o.target === c));
          w.target = free.length ? free[Math.floor(Math.random() * free.length)] : null; w.wait = 0.3;
          if (w.target) this.fx(() => sfx.pickup());
        }
      } else {
        // green: everybody back to the pavement
        const hy = BOTTOM + 70, d = Math.hypot(w.home - w.x, hy - w.y);
        if (d > 3) { w.x += ((w.home - w.x) / d) * 200 * dt; w.y += ((hy - w.y) / d) * 200 * dt; }
      }
    }
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1);
  }

  private draw() {
    const c = this.ctx;
    c.drawImage(this.bg, 0, 0, W, H);
    drawLight(c, this.light, this.t);
    const items: { key: number; paint: () => void }[] = [];
    for (const car of this.cars) items.push({ key: car.y + car.h / 2, paint: () => drawVehicle(c, car) });
    for (const w of this.workers) items.push({ key: w.y + 14, paint: () => {
      drawAvatar(c, w.x, w.y, w.def.look, this.t + w.home, 1.05, !!w.target || this.light !== "red");
      c.font = "bold 13px sans-serif"; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "rgba(20,12,4,.85)";
      c.strokeText(w.def.name, w.x, w.y + 18); c.fillStyle = "#fff"; c.fillText(w.def.name, w.x, w.y + 18);
    } });
    items.sort((a, b) => a.key - b.key); for (const d of items) d.paint();
    c.textAlign = "center"; c.font = `20px ${DISPLAY_FONT}`;
    for (const p of this.pops) { c.globalAlpha = 1 - p.t; c.lineWidth = 4; c.strokeStyle = "rgba(20,12,4,.85)"; c.strokeText(p.text, p.x, p.y - p.t * 28); c.fillStyle = p.text === "Sold!" ? "#7dffa8" : "#ffb4ab"; c.fillText(p.text, p.x, p.y - p.t * 28); }
    c.globalAlpha = 1;
    if (this.workers.length === 0) {
      c.fillStyle = "rgba(27,27,34,.8)"; c.beginPath(); c.roundRect(W / 2 - 220, 190, 440, 70, 14); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 20px sans-serif"; c.fillText("Nobody is working this corner yet.", W / 2, 232);
    }
  }
}