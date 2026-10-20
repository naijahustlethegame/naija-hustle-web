import type { Entity } from "./types";
import { W } from "./types";

export const SPEC = {
  okada: { w: 44, h: 22, price: 50, weight: 4, color: "#2a2118" },
  keke: { w: 52, h: 34, price: 80, weight: 4, color: "#f5c400" },
  danfo: { w: 96, h: 42, price: 120, weight: 3, color: "#f2b705" },
  car: { w: 70, h: 32, price: 150, weight: 3, color: "#4aa3df" },
  jeep: { w: 84, h: 38, price: 600, weight: 0.6, color: "#1b1b1b" }, // rare, pays most
} as const;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
}

export function drawVehicle(c: CanvasRenderingContext2D, e: Entity) {
  const dir = e.vx >= 0 ? 1 : -1, { w, h } = e;
  c.save(); c.translate(e.x, e.y); c.scale(dir, 1);
  c.globalAlpha = e.sold ? 0.55 : 1;
  c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.ellipse(0, h / 2, w / 2, 5, 0, 0, 7); c.fill();
  c.fillStyle = e.tint; rr(c, -w / 2, -h / 2, w, h, 8);
  if (e.kind === "danfo") { c.fillStyle = "#111"; c.fillRect(-w / 2, -2, w, 5); }
  if (e.kind === "keke") { c.fillStyle = "#0f8f4f"; rr(c, -w / 2, -h / 2, w, 10, 6); }
  if (e.kind !== "okada") { c.fillStyle = "#cfeaff"; rr(c, w * 0.08, -h / 2 + 4, w * 0.3, h * 0.35, 3); rr(c, -w * 0.3, -h / 2 + 4, w * 0.3, h * 0.35, 3); }
  c.fillStyle = "#111"; c.beginPath(); c.arc(-w / 3, h / 2 - 2, 6, 0, 7); c.arc(w / 3, h / 2 - 2, 6, 0, 7); c.fill();
  c.restore();
}

export function drawWalker(c: CanvasRenderingContext2D, e: Entity, t: number) {
  const s = Math.sin(t * 8 + e.id) * 3;
  c.fillStyle = "rgba(0,0,0,.15)"; c.beginPath(); c.ellipse(e.x, e.y + 1, 9, 3, 0, 0, 7); c.fill();
  c.fillStyle = "#2a2118"; c.fillRect(e.x - 5 + s, e.y - 14, 4, 14); c.fillRect(e.x + 1 - s, e.y - 14, 4, 14);
  c.fillStyle = e.tint; c.fillRect(e.x - 7, e.y - 30, 14, 17);
  c.fillStyle = "#6b4226"; c.beginPath(); c.arc(e.x, e.y - 36, 6, 0, 7); c.fill();
}

/** Static backdrop: pre-render once to an offscreen canvas for performance. */
export function renderBackdrop(lanesTop: number, lanesBottom: number, H: number): HTMLCanvasElement {
  const o = document.createElement("canvas"); o.width = W; o.height = H;
  const c = o.getContext("2d")!;
  c.fillStyle = "#bfe6ff"; c.fillRect(0, 0, W, 120);
  // skyline silhouettes
  c.fillStyle = "#9cc9e8";
  for (let i = 0; i < 12; i++) c.fillRect(i * 85, 60 - ((i * 37) % 40), 60, 80);
  // blank billboards (ad space)
  for (const bx of [90, 400, 710]) {
    c.fillStyle = "#6b5a45"; c.fillRect(bx + 40, 70, 8, 60); c.fillRect(bx + 152, 70, 8, 60);
    c.fillStyle = "#fffdf0"; c.fillRect(bx, 10, 200, 70);
    c.strokeStyle = "#2a2118"; c.lineWidth = 4; c.strokeRect(bx, 10, 200, 70);
  }
  c.fillStyle = "#d9c76a"; c.fillRect(0, 120, W, lanesTop - 120);       // top sidewalk
  c.fillStyle = "#4a4a4f"; c.fillRect(0, lanesTop, W, lanesBottom - lanesTop); // road
  c.strokeStyle = "#f5f0c8"; c.lineWidth = 3; c.setLineDash([26, 22]);
  for (const y of [lanesTop + 70, lanesTop + 140]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle = "#e3d27a"; c.fillRect(0, lanesBottom, W, H - lanesBottom); // bottom sidewalk
  // mama put stall
  c.fillStyle = "#0f8f4f"; c.fillRect(30, lanesBottom + 12, 130, 14);
  c.fillStyle = "#fff"; c.font = "bold 12px sans-serif"; c.fillText("MAMA PUT", 52, lanesBottom + 23);
  return o;
}
