import type { RoundEventKind } from "./events";
import { BOTTOM, TOP } from "./layout";
import { H, W } from "./types";

type Ctx = CanvasRenderingContext2D;

/**
 * Small looping animations for the dice events. Everything is a pure function of time `t`
 * and a fade `k` (0 to 1) so an event eases in when its light starts. Nothing here touches game state.
 */

const hash = (n: number) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** A wash over the backdrop only, drawn before the cars so they stay readable. */
export function drawWeatherTint(c: Ctx, kind: RoundEventKind, k: number) {
  if (k <= 0) return;
  if (kind === "rain") {
    c.fillStyle = `rgba(38,52,86,${0.34 * k})`; c.fillRect(0, 0, W, H);
    c.fillStyle = `rgba(140,170,215,${0.12 * k})`; c.fillRect(0, TOP, W, BOTTOM - TOP); // wet road sheen
  } else if (kind === "sun") {
    c.fillStyle = `rgba(255,205,90,${0.16 * k})`; c.fillRect(0, 0, W, H);
  }
}

const SUN = { x: 800, y: 30 };

/** Drawn on top of cars and people, under the HUD. */
export function drawWeatherFront(c: Ctx, kind: RoundEventKind, t: number, k: number) {
  if (k <= 0) return;
  if (kind === "rain") rain(c, t, k);
  else if (kind === "sun") sun(c, t, k);
}

function rain(c: Ctx, t: number, k: number) {
  // puddle ripples on the road
  c.lineWidth = 1.5;
  for (let j = 0; j < 26; j++) {
    const ph = (t * 1.7 + hash(j)) % 1;
    const x = hash(j + 100) * W, y = TOP + 22 + hash(j + 200) * (BOTTOM - TOP - 34), r = 3 + ph * 9;
    c.strokeStyle = `rgba(220,235,255,${(1 - ph) * 0.5 * k})`;
    c.beginPath(); c.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2); c.stroke();
  }
  // falling streaks, slanted by the wind
  c.lineWidth = 1.4; c.lineCap = "round";
  for (let i = 0; i < 150; i++) {
    const sp = 520 + hash(i + 300) * 260, len = 14 + hash(i + 400) * 12;
    const y = (hash(i) * (H + 60) + t * sp) % (H + 60) - 30;
    const x = ((hash(i + 500) * (W + 120) - t * sp * 0.22) % (W + 120) + (W + 120)) % (W + 120) - 20;
    c.strokeStyle = `rgba(205,225,255,${(0.28 + hash(i + 600) * 0.3) * k})`;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * 0.22, y + len); c.stroke();
  }
  c.lineCap = "butt";
  // grey haze at the top, like low cloud
  const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, `rgba(70,85,115,${0.45 * k})`); g.addColorStop(1, "rgba(70,85,115,0)");
  c.fillStyle = g; c.fillRect(0, 0, W, 150);
}

function sun(c: Ctx, t: number, k: number) {
  // big warm glare from the top right
  const g = c.createRadialGradient(SUN.x, SUN.y, 10, SUN.x, SUN.y, 560);
  g.addColorStop(0, `rgba(255,248,205,${0.62 * k})`); g.addColorStop(0.35, `rgba(255,226,140,${0.22 * k})`); g.addColorStop(1, "rgba(255,226,140,0)");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // slowly turning rays
  c.save(); c.translate(SUN.x, SUN.y); c.rotate(t * 0.08);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, w = 0.07 + 0.03 * Math.sin(t * 1.3 + i);
    c.fillStyle = `rgba(255,243,175,${0.13 * k})`;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - w) * 900, Math.sin(a - w) * 900); c.lineTo(Math.cos(a + w) * 900, Math.sin(a + w) * 900); c.fill();
  }
  c.restore();
  // the sun itself, pulsing a little
  const pulse = 1 + Math.sin(t * 2.2) * 0.06;
  c.fillStyle = `rgba(255,255,230,${0.35 * k})`; c.beginPath(); c.arc(SUN.x, SUN.y, 46 * pulse, 0, Math.PI * 2); c.fill();
  c.fillStyle = `rgba(255,252,222,${0.95 * k})`; c.beginPath(); c.arc(SUN.x, SUN.y, 24 * pulse, 0, Math.PI * 2); c.fill();
  // heat shimmer rising off the tarmac
  c.lineWidth = 9;
  for (let i = 0; i < 5; i++) {
    const y0 = TOP + 24 + i * 40 - ((t * 14 + i * 17) % 30);
    c.strokeStyle = `rgba(255,255,255,${0.07 * k})`; c.beginPath();
    for (let x = 0; x <= W; x += 24) { const y = y0 + Math.sin(x * 0.03 + t * 2.2 + i) * 4; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
  }
  // glints
  for (let i = 0; i < 7; i++) {
    const ph = (t * 0.6 + hash(i + 50)) % 1, x = 60 + hash(i + 70) * (W - 120), y = TOP + 10 + hash(i + 90) * (BOTTOM - TOP - 20);
    const a = Math.sin(ph * Math.PI) * 0.9 * k, s = 5 + ph * 3;
    c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.6; c.beginPath();
    c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke();
  }
}

/** Where LASTMA officers stand on the pavement, just below the kerb. */
export const OFFICER_SPOTS = [{ x: 210, y: BOTTOM + 50, id: 1 }, { x: 500, y: BOTTOM + 66, id: 2 }];

/** A LASTMA officer in a hi-vis vest, standing around. Feet at (x, y). */
export function drawOfficer(c: Ctx, x0: number, y: number, t: number, id: number, k: number) {
  if (k <= 0) return;
  const sway = Math.sin(t * 1.4 + id * 2) * 1.2;
  const pace = id === 2 ? Math.sin(t * 0.45) * 34 : 0, walking = id === 2 && Math.abs(Math.cos(t * 0.45)) > 0.35;
  const x = x0 + pace, face = id === 2 ? (Math.cos(t * 0.45) >= 0 ? 1 : -1) : 1;
  const step = walking ? Math.sin(t * 9) * 3.5 : 0;
  const whistle = (t * 0.35 + id * 0.37) % 1 > 0.82; // blows the whistle now and then
  c.save(); c.globalAlpha = k; c.translate(x, y); c.scale(1.12 * face, 1.12);
  c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.ellipse(0, 1, 13, 4, 0, 0, Math.PI * 2); c.fill();
  // legs and boots
  c.fillStyle = "#23304a"; c.fillRect(-7 + step, -19, 6, 17); c.fillRect(1 - step, -19, 6, 17);
  c.fillStyle = "#15151a"; c.fillRect(-8 + step, -3, 8, 4); c.fillRect(0 - step, -3, 8, 4);
  // shirt and hi-vis vest
  c.fillStyle = "#2f6b3a"; c.fillRect(-9, -38 + sway * 0.3, 18, 21);
  c.fillStyle = "#c7f02c"; c.fillRect(-9, -38 + sway * 0.3, 6, 21); c.fillRect(3, -38 + sway * 0.3, 6, 21);
  c.fillStyle = "#e8ffe0"; c.fillRect(-9, -29 + sway * 0.3, 18, 2);
  c.fillStyle = "#15321c"; c.font = "bold 5px sans-serif"; c.textAlign = "center"; c.fillText("LASTMA", 0, -22 + sway * 0.3);
  // head and cap
  const skin = ["#6b4226", "#8a5a3c", "#5a3a22"][id % 3];
  c.fillStyle = skin; c.beginPath(); c.arc(0, -46 + sway * 0.4, 8, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#1f5f2e"; c.fillRect(-8.5, -56 + sway * 0.4, 17, 6); c.fillRect(2, -51 + sway * 0.4, 11, 2.4);
  c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(0, -54 + sway * 0.4, 1.8, 0, Math.PI * 2); c.fill();
  // arms: one holds a ticket book, the other raises a whistle
  c.fillStyle = skin;
  c.fillRect(-12, -36, 4, 14);
  c.fillStyle = "#f4f1e4"; c.fillRect(-16, -28, 8, 10); c.fillStyle = "#9aa"; c.fillRect(-16, -28, 8, 2);
  if (whistle) { c.fillStyle = skin; c.fillRect(8, -44, 4, 10); c.fillStyle = "#e8e8ee"; c.fillRect(4, -41, 6, 3); }
  else { c.fillStyle = skin; c.fillRect(8, -36, 4, 14); }
  c.restore();
  if (whistle) {
    c.save(); c.globalAlpha = k; c.font = "bold 14px sans-serif"; c.textAlign = "center";
    c.lineWidth = 3; c.strokeStyle = "rgba(20,12,4,.85)"; c.strokeText("PEEEP!", x + 4, y - 78 - Math.sin(t * 20) * 1);
    c.fillStyle = "#ffd84a"; c.fillText("PEEEP!", x + 4, y - 78 - Math.sin(t * 20) * 1);
    c.restore();
  }
}
