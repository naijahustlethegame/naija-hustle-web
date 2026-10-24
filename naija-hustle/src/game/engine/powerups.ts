/** Power-ups: what they are called, and the small canvas animations that show what they do. The server decides every effect. */
export type PowerKind = "shield" | "boost" | "pothole" | "horn";

export const POWERS: Record<PowerKind, { name: string; icon: string; color: string; hint: string; usable: boolean }> = {
  shield: { name: "God's Blessing", icon: "🙏", color: "#ffd84a", hint: "Blocks your next hit", usable: false },
  boost: { name: "Boost", icon: "⚡", color: "#5cff9a", hint: "TAP: run faster", usable: true },
  pothole: { name: "Pothole", icon: "🕳️", color: "#c49a6c", hint: "TAP: drop a trap", usable: true },
  horn: { name: "Blast Horn", icon: "📯", color: "#ff7a59", hint: "TAP: stun rivals", usable: true },
};

export const BOOST_SPEED = 1.8, SLOW_SPEED = 0.45;

export type Pickup = { id: string; kind: PowerKind; x: number; y: number; left: number; max: number; pending?: boolean };
export type Trap = { id: string; x: number; y: number; by: string; t: number };
export type Fx = { kind: "wave" | "pop" | "splat" | "gain"; x: number; y: number; t: number; dur: number; color: string };

type C = CanvasRenderingContext2D;

/** A pickup sitting on the road: bobbing, glowing, with a ring that runs down and blinks near the end. */
export function drawPickup(c: C, p: Pickup, t: number) {
  const m = POWERS[p.kind], bob = Math.sin(t * 5 + p.x) * 3, pulse = 1 + Math.sin(t * 8) * 0.06;
  const blink = p.left < 2.5 && Math.floor(t * 8) % 2 === 0;
  c.save();
  c.globalAlpha = blink ? 0.35 : p.pending ? 0.6 : 1;
  c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(p.x, p.y + 22, 20, 7, 0, 0, Math.PI * 2); c.fill();
  c.translate(p.x, p.y - 8 + bob); c.scale(pulse * (p.pending ? 1.25 : 1), pulse * (p.pending ? 1.25 : 1));
  const g = c.createRadialGradient(0, 0, 8, 0, 0, 40); g.addColorStop(0, m.color + "aa"); g.addColorStop(1, m.color + "00");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 40, 0, Math.PI * 2); c.fill();
  c.fillStyle = m.color; c.strokeStyle = "#1b1b22"; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.fill(); c.stroke();
  c.font = "24px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#000"; c.fillText(m.icon, 0, 2);
  c.strokeStyle = "#fff"; c.lineWidth = 4; c.lineCap = "round";
  c.beginPath(); c.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.left / p.max)); c.stroke();
  c.restore();
}

/** A pothole dropped on the road. */
export function drawTrap(c: C, tr: Trap, t: number) {
  const k = Math.min(1, tr.t / 0.25);
  c.save(); c.translate(tr.x, tr.y); c.scale(k, k);
  c.fillStyle = "#1b1b22"; c.strokeStyle = "#8a6a45"; c.lineWidth = 4;
  c.beginPath(); c.ellipse(0, 0, 32, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#2c2c36"; c.beginPath(); c.ellipse(-4, 1, 20, 6, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.25; c.strokeStyle = "#ffd84a"; c.lineWidth = 2; c.setLineDash([6, 6]);
  c.beginPath(); c.ellipse(0, 0, 40, 16, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}

/** God's Blessing: a golden bubble with two sparkles orbiting it. */
export function drawShieldAura(c: C, x: number, y: number, t: number) {
  const cy = y - 34, r = 46 + Math.sin(t * 4) * 2;
  c.save();
  const g = c.createRadialGradient(x, cy, r * 0.4, x, cy, r); g.addColorStop(0, "rgba(255,216,74,0)"); g.addColorStop(1, "rgba(255,216,74,.38)");
  c.fillStyle = g; c.beginPath(); c.arc(x, cy, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(255,240,170,.95)"; c.lineWidth = 3; c.stroke();
  c.fillStyle = "#fff6c2"; c.font = "16px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  for (let i = 0; i < 2; i++) { const a = t * 2.2 + i * Math.PI; c.fillText("✦", x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9); }
  c.restore();
}

/** Boost: green speed streaks behind the runner and a ring at the feet. */
export function drawBoostFx(c: C, x: number, y: number, t: number) {
  c.save(); c.lineCap = "round"; c.strokeStyle = "rgba(92,255,154,.85)";
  for (let i = 0; i < 4; i++) {
    const len = 22 + ((t * 90 + i * 17) % 26), yy = y - 14 - i * 11;
    c.lineWidth = 4 - i * 0.6; c.beginPath(); c.moveTo(x - 24, yy); c.lineTo(x - 24 - len, yy); c.stroke();
  }
  c.globalAlpha = 0.6 + Math.sin(t * 14) * 0.3; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y + 4, 24, 8, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}

/** Stunned: three stars circling the head. */
export function drawStars(c: C, x: number, y: number, t: number) {
  c.save(); c.font = "18px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#ffd84a";
  for (let i = 0; i < 3; i++) { const a = t * 6 + (i * Math.PI * 2) / 3; c.fillText("★", x + Math.cos(a) * 22, y - 76 + Math.sin(a) * 7); }
  c.restore();
}

/** Slowed by a pothole: a muddy puddle at the feet and flying dirt. */
export function drawMud(c: C, x: number, y: number, t: number) {
  c.save(); c.fillStyle = "rgba(110,78,44,.7)";
  c.beginPath(); c.ellipse(x, y + 4, 26, 8, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 4; i++) { const k = (t * 2 + i * 0.25) % 1; c.beginPath(); c.arc(x + (i - 1.5) * 12, y - k * 26, 3 * (1 - k) + 1, 0, Math.PI * 2); c.fill(); }
  c.restore();
}

/** One-off effects: horn waves, shield pops, pothole splats, pickup bursts. */
export function drawFx(c: C, f: Fx) {
  const p = Math.min(1, f.t / f.dur);
  c.save(); c.strokeStyle = f.color; c.fillStyle = f.color; c.lineCap = "round";
  if (f.kind === "wave") {
    for (let i = 0; i < 3; i++) {
      const r = p * 230 - i * 38; if (r <= 0) continue;
      c.globalAlpha = Math.max(0, 1 - p) * (1 - i * 0.25); c.lineWidth = 7 - i * 2;
      c.beginPath(); c.ellipse(f.x, f.y - 30, r, r * 0.55, 0, 0, Math.PI * 2); c.stroke();
    }
  } else if (f.kind === "pop") {
    c.globalAlpha = 1 - p; c.lineWidth = 5; c.beginPath(); c.arc(f.x, f.y - 34, 30 + p * 50, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r1 = 36 + p * 40, r2 = r1 + 12; c.lineWidth = 3; c.beginPath(); c.moveTo(f.x + Math.cos(a) * r1, f.y - 34 + Math.sin(a) * r1); c.lineTo(f.x + Math.cos(a) * r2, f.y - 34 + Math.sin(a) * r2); c.stroke(); }
  } else if (f.kind === "splat") {
    c.globalAlpha = 1 - p; c.lineWidth = 6; c.beginPath(); c.ellipse(f.x, f.y, 20 + p * 46, 8 + p * 18, 0, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.arc(f.x + Math.cos(a) * (14 + p * 44), f.y - p * 24 + Math.sin(a) * (6 + p * 14), 4 * (1 - p) + 1, 0, Math.PI * 2); c.fill(); }
  } else {
    c.globalAlpha = 1 - p; c.lineWidth = 4; c.beginPath(); c.arc(f.x, f.y - 30, 14 + p * 40, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}