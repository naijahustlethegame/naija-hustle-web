import type { Kind, Tell } from "./types";
import { LIGHT_X, TOP } from "./layout";

export type LightState = "red" | "yellow" | "green";

/** Everything the painter needs to draw a vehicle. */
export type VehView = {
  id: number; kind: Kind; x: number; y: number; w: number; h: number;
  tint: string; tell: Tell; sold: boolean;
};

const SKINS = ["#8a5a3c", "#6b4226", "#a06a44", "#5a3a22"];
const skin = (id: number) => SKINS[id % SKINS.length];
const INK = "#1b1b22";

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string) {
  if (fill) c.fillStyle = fill;
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
}
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function wheel(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  circle(c, x, y, r, INK); circle(c, x, y, r * 0.5, "#b9bcc4"); circle(c, x, y, r * 0.18, INK);
}
/** An arm out of a window, ending in an open hand. This is how a buyer says "come". */
function armOut(c: CanvasRenderingContext2D, x: number, y: number, id: number, up = false) {
  c.fillStyle = skin(id);
  if (up) { c.fillRect(x - 2, y - 14, 4, 16); circle(c, x, y - 16, 4, skin(id)); }
  else { c.fillRect(x, y - 2, 16, 4); circle(c, x + 17, y, 4, skin(id)); }
}

/** A side window in one of three states: closed (glass), cracked (dark gap), down (open, arm out). */
function sideWindow(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tell: Tell, id: number, dark: boolean) {
  const glass = dark ? "#14161b" : "#bfe3f5";
  rr(c, x, y, w, h, 3, glass);
  if (tell === "ignore") {
    c.fillStyle = dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.55)";
    c.beginPath(); c.moveTo(x + 3, y + h - 2); c.lineTo(x + w * 0.45, y + 2); c.lineTo(x + w * 0.6, y + 2); c.lineTo(x + 8, y + h - 2); c.fill();
  } else if (tell === "maybe") {
    rr(c, x, y, w, h * 0.45, 3, "#0b0c10"); // glass lowered a little
  } else {
    rr(c, x, y, w, h, 3, "#0b0c10");
    armOut(c, x + w - 2, y + h * 0.5, id);
  }
}

export function drawVehicle(c: CanvasRenderingContext2D, v: VehView) {
  const { w, h } = v;
  c.save(); c.translate(v.x, v.y);
  c.globalAlpha = v.sold ? 0.72 : 1;
  c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(0, h / 2 + 1, w / 2 + 4, 5, 0, 0, Math.PI * 2); c.fill();

  if (v.kind === "car") {
    rr(c, -w / 2, -h / 2 + 11, w, h - 11, 8, v.tint);
    rr(c, -w * 0.31, -h / 2, w * 0.58, 20, 8, v.tint);
    c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(-w / 2 + 4, h / 2 - 12, w - 8, 3);
    sideWindow(c, -w * 0.25, -h / 2 + 3, w * 0.46, 12, v.tell, v.id, false);
    rr(c, w / 2 - 6, -h / 2 + 16, 6, 5, 2, "#fff3a8"); rr(c, -w / 2, -h / 2 + 16, 5, 5, 2, "#e4382f");
    wheel(c, -w * 0.28, h / 2 - 4, 8); wheel(c, w * 0.28, h / 2 - 4, 8);
  } else if (v.kind === "jeep") {
    rr(c, -w / 2, -h / 2 + 4, w, h - 4, 7, v.tint);
    rr(c, -w * 0.42, -h / 2, w * 0.8, 6, 3, "#34363e"); // roof rack
    sideWindow(c, -w * 0.38, -h / 2 + 9, w * 0.36, 13, "ignore", v.id, true);
    sideWindow(c, -w * 0.0, -h / 2 + 9, w * 0.38, 13, v.tell, v.id, true);
    rr(c, w / 2 - 6, -h / 2 + 22, 6, 6, 2, "#fff3a8"); rr(c, -w / 2, -h / 2 + 22, 5, 6, 2, "#e4382f");
    c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(-w / 2 + 5, -h / 2 + 6, w - 10, 2);
    wheel(c, -w * 0.3, h / 2 - 4, 9); wheel(c, w * 0.3, h / 2 - 4, 9);
  } else if (v.kind === "danfo") {
    rr(c, -w / 2, -h / 2, w, h - 4, 8, "#f7b500");
    c.fillStyle = INK; c.fillRect(-w / 2, -1, w, 8);
    c.fillStyle = "#fff"; c.font = "bold 7px sans-serif"; c.textAlign = "center"; c.fillText("GOD DEY", -w * 0.1, 5.5);
    for (let i = 0; i < 3; i++) rr(c, -w / 2 + 8 + i * 22, -h / 2 + 5, 17, 13, 3, "#8fb8d0");
    sideWindow(c, w / 2 - 28, -h / 2 + 5, 22, 13, v.tell, v.id, false);
    rr(c, w / 2 - 5, -h / 2 + 24, 5, 6, 2, "#fff3a8"); rr(c, -w / 2, -h / 2 + 24, 4, 6, 2, "#e4382f");
    wheel(c, -w * 0.3, h / 2 - 6, 9); wheel(c, w * 0.3, h / 2 - 6, 9);
  } else if (v.kind === "keke") {
    rr(c, -w / 2, -h / 2 + 12, w, h - 12, 8, "#f2c200");              // body
    rr(c, -w / 2 + 2, -h / 2, w - 8, 14, 7, "#0e8f4e");               // canopy
    c.fillStyle = "#3b2a1a"; c.fillRect(-w * 0.34, -h / 2 + 14, w * 0.3, 7); // seat
    circle(c, w * 0.12, -h / 2 + 16, 6, skin(v.id));                    // driver
    rr(c, w * 0.12 - 7, -h / 2 + 8, 14, 5, 2, "#e4382f");               // cap
    if (v.tell === "keen") armOut(c, w * 0.12 + 5, -h / 2 + 22, v.id, true);
    else if (v.tell === "ignore") rr(c, w * 0.12 - 4, -h / 2 + 21, 9, 5, 1, "#7fe8ff"); // looking at phone
    else circle(c, w * 0.12 + 8, -h / 2 + 15, 1.6, INK);                // eyes on you
    wheel(c, -w * 0.28, h / 2 - 4, 7); wheel(c, w * 0.34, h / 2 - 4, 7);
  } else {
    // okada
    wheel(c, -w * 0.3, h / 2 - 7, 9); wheel(c, w * 0.32, h / 2 - 7, 9);
    c.strokeStyle = "#c33"; c.lineWidth = 4; c.beginPath(); c.moveTo(-w * 0.3, h / 2 - 7); c.lineTo(0, -2); c.lineTo(w * 0.32, h / 2 - 7); c.stroke();
    rr(c, -w * 0.32, -4, w * 0.4, 6, 3, "#2b2b33");                      // seat
    rr(c, -w * 0.12, -h / 2 + 2, 14, 17, 5, v.tint === "#2b2b33" ? "#0e8f4e" : v.tint); // rider
    circle(c, -w * 0.04, -h / 2, 7, skin(v.id));
    rr(c, -w * 0.04 - 8, -h / 2 - 7, 16, 8, 5, "#e4382f");               // helmet
    if (v.tell === "keen") armOut(c, w * 0.04, -h / 2 + 8, v.id, true);
    else if (v.tell === "ignore") rr(c, w * 0.06, -h / 2 + 11, 8, 5, 1, "#7fe8ff");
    else circle(c, -w * 0.04 + 5, -h / 2 - 1, 1.6, INK);
  }
  c.restore();
}

/** The traffic light on the far right. Flashes in the warning phase. */
export function drawLight(c: CanvasRenderingContext2D, state: LightState, t: number) {
  const x = LIGHT_X, flash = Math.floor(t * 6) % 2 === 0;
  c.fillStyle = "#2a2a30"; c.fillRect(x - 3, 64, 6, TOP + 10 - 64);
  rr(c, x - 19, 18, 38, 100, 9, INK);
  const lamps: [LightState, number, string][] = [["red", 40, "#ff3b30"], ["yellow", 68, "#ffc400"], ["green", 96, "#28d467"]];
  for (const [s, y, col] of lamps) {
    const on = state === s && (s !== "yellow" || flash);
    if (on) { c.fillStyle = col; c.globalAlpha = 0.25; c.beginPath(); c.arc(x, y, 24, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
    circle(c, x, y, 11, on ? col : "#3a3a42");
  }
}

export { renderBackdrop } from "./scenery";
