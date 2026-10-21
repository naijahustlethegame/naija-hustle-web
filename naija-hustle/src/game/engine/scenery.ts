import type { Junction } from "./junctions";
import { AD_SLOTS, BOTTOM, DISPLAY_FONT, STOP_X, TOP, type AdSlotId } from "./layout";
import { H, W } from "./types";
import { hashString, mulberry32 } from "./rng";

const INK = "#1b1b22";
type Ctx = CanvasRenderingContext2D;
export type AdImages = Partial<Record<AdSlotId, CanvasImageSource>>;

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string) {
  if (fill) c.fillStyle = fill;
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
}
function disc(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

// ---------------------------------------------------------------- billboards
/** A roadside board: steel legs, lit from above, blank face. Each junction gets three. */
function drawBillboard(c: Ctx, s: (typeof AD_SLOTS)[number], img?: CanvasImageSource) {
  const { x, y, w, h } = s;
  // legs and cross brace
  c.fillStyle = "#4a4d55"; c.fillRect(x + 34, y + h, 9, 22); c.fillRect(x + w - 43, y + h, 9, 22);
  c.fillStyle = "#33353b"; c.fillRect(x + 34, y + h + 4, 9, 3); c.fillRect(x + w - 43, y + h + 4, 9, 3);
  c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.ellipse(x + w / 2, y + h + 22, w * 0.42, 4, 0, 0, Math.PI * 2); c.fill();
  // frame
  rr(c, x - 6, y - 6, w + 12, h + 12, 4, "#2b2d33");
  rr(c, x - 3, y - 3, w + 6, h + 6, 3, "#6d7079");
  // face
  if (img) {
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, 2); c.clip();
    c.drawImage(img, x, y, w, h); c.restore();
  } else {
    const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, "#fbfaf4"); g.addColorStop(1, "#e9e6da");
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(255,255,255,.55)"; // paper sheen
    c.beginPath(); c.moveTo(x + 16, y + h); c.lineTo(x + 70, y); c.lineTo(x + 96, y); c.lineTo(x + 42, y + h); c.fill();
    c.strokeStyle = "rgba(0,0,0,.07)"; c.lineWidth = 1; // seams where the sheets meet
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + (w / 4) * i, y); c.lineTo(x + (w / 4) * i, y + h); c.stroke(); }
    c.fillStyle = "#bdb8a8"; c.font = `11px ${DISPLAY_FONT}`; c.textAlign = "center";
    c.fillText("AD SPACE", x + w / 2, y + h / 2 + 4);
  }
  // catwalk and lamps on top
  c.fillStyle = "#2b2d33"; c.fillRect(x - 6, y - 12, w + 12, 3);
  for (const lx of [x + w * 0.2, x + w * 0.5, x + w * 0.8]) {
    c.fillRect(lx - 1, y - 12, 2, 6);
    rr(c, lx - 6, y - 17, 12, 5, 2, "#2b2d33");
    c.fillStyle = "rgba(255,244,190,.16)";
    c.beginPath(); c.moveTo(lx - 5, y - 12); c.lineTo(lx + 5, y - 12); c.lineTo(lx + 22, y + 30); c.lineTo(lx - 22, y + 30); c.fill();
    disc(c, lx, y - 12, 2.2, "#fff2b0");
  }
}

// ---------------------------------------------------------------- skylines
function ojuelegbaSky(c: Ctx, rnd: () => number) {
  const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, "#ffcf5c"); g.addColorStop(1, "#ff8f4d");
  c.fillStyle = g; c.fillRect(0, 0, W, 150);
  disc(c, 150, 78, 40, "rgba(255,245,200,.55)"); disc(c, 150, 78, 24, "rgba(255,250,225,.8)");
  // far, hazy blocks
  for (let x = -10; x < W; x += 44 + rnd() * 30) { const h = 40 + rnd() * 50; c.fillStyle = "#b8584a"; c.fillRect(x, 150 - h, 40 + rnd() * 20, h); }
  // low rusty shacks with corrugated zinc roofs
  const walls = ["#c9703a", "#b85c2f", "#d9a441", "#8d5a3b", "#a8452f", "#6f9a73", "#e0c07a"];
  for (let x = -6; x < W; ) {
    const bw = 40 + rnd() * 34, bh = 28 + rnd() * 30, top = 150 - bh;
    c.fillStyle = walls[Math.floor(rnd() * walls.length)]; c.fillRect(x, top, bw, bh);
    c.fillStyle = "#9aa0a6"; c.beginPath(); c.moveTo(x - 3, top + 2); c.lineTo(x + bw + 3, top + 2); c.lineTo(x + bw, top - 7); c.lineTo(x, top - 7); c.fill();
    c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 1; for (let k = x + 4; k < x + bw; k += 5) { c.beginPath(); c.moveTo(k, top - 6); c.lineTo(k, top + 1); c.stroke(); }
    c.fillStyle = "rgba(40,24,12,.55)"; for (let wx = x + 6; wx < x + bw - 8; wx += 14) c.fillRect(wx, top + 10, 7, 9);
    if (rnd() > 0.7) { rr(c, x + bw * 0.5 - 7, top - 20, 14, 13, 3, "#2f78c4"); c.fillStyle = "#555"; c.fillRect(x + bw * 0.5 - 1, top - 8, 2, 4); } // water tank
    x += bw + 3;
  }
  // electric poles and sagging wires, the Lagos skyline
  c.strokeStyle = "rgba(30,20,12,.75)"; c.lineWidth = 2;
  const poles = [96, 300, 520, 760];
  for (const px of poles) { c.beginPath(); c.moveTo(px, 40); c.lineTo(px, 150); c.stroke(); c.fillRect(px - 14, 46, 28, 3); }
  c.lineWidth = 1;
  for (let i = 0; i < poles.length - 1; i++) for (const dy of [47, 54]) {
    c.beginPath(); c.moveTo(poles[i] + 12, dy); c.quadraticCurveTo((poles[i] + poles[i + 1]) / 2, dy + 22, poles[i + 1] - 12, dy); c.stroke();
  }
}

function obalendeSky(c: Ctx, rnd: () => number) {
  const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, "#b9cbdb"); g.addColorStop(1, "#eceee6");
  c.fillStyle = g; c.fillRect(0, 0, W, 150);
  c.fillStyle = "rgba(255,255,255,.7)"; for (const [cx, cy, r] of [[210, 34, 22], [250, 30, 28], [290, 36, 20], [700, 24, 24], [742, 28, 20]]) disc(c, cx, cy, r, "rgba(255,255,255,.7)");
  // office blocks: concrete and glass, tight window grids
  const tones = ["#7d8896", "#6a7482", "#8d97a3", "#5f6a78", "#99a2ad"];
  for (let x = -4; x < W; ) {
    const bw = 46 + rnd() * 44, bh = 60 + rnd() * 70, top = 150 - bh;
    c.fillStyle = tones[Math.floor(rnd() * tones.length)]; c.fillRect(x, top, bw, bh);
    c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(x, top, 4, bh);
    for (let wy = top + 6; wy < 140; wy += 9) for (let wx = x + 7; wx < x + bw - 6; wx += 8) { c.fillStyle = rnd() > 0.35 ? "rgba(214,232,247,.75)" : "rgba(40,52,66,.7)"; c.fillRect(wx, wy, 5, 5); }
    c.fillStyle = "#4b5360"; c.fillRect(x + bw / 2 - 1, top - 9, 2, 9);
    x += bw + 2;
  }
  // the flyover: long concrete deck on pillars, with cars on it
  c.fillStyle = "#9b9d9f"; c.fillRect(0, 108, W, 12);
  c.fillStyle = "#6f7174"; c.fillRect(0, 118, W, 4);
  c.fillStyle = "#c9cacb"; c.fillRect(0, 103, W, 5);
  c.fillStyle = "#85878a"; for (let x = 4; x < W; x += 16) c.fillRect(x, 104, 2, 4);
  c.fillStyle = "#808285"; for (const px of [70, 250, 430, 610, 790]) { c.fillRect(px, 122, 16, 24); c.fillStyle = "#707275"; c.fillRect(px - 4, 120, 24, 4); c.fillStyle = "#808285"; }
  for (const [vx, col] of [[120, "#e4382f"], [300, "#f7b500"], [520, "#f2f2f2"], [700, "#4aa3df"], [860, "#f7b500"]] as const) { rr(c, vx, 96, 22, 8, 3, col); disc(c, vx + 5, 104, 2.5, INK); disc(c, vx + 17, 104, 2.5, INK); }
}

function lekkiSky(c: Ctx, rnd: () => number) {
  const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, "#3fa9f0"); g.addColorStop(1, "#c8ecff");
  c.fillStyle = g; c.fillRect(0, 0, W, 150);
  disc(c, 840, 36, 22, "rgba(255,255,255,.85)");
  for (const [cx, cy, r] of [[120, 30, 20], [150, 24, 26], [186, 32, 18], [420, 20, 22], [455, 24, 18], [560, 44, 16], [590, 40, 22]]) disc(c, cx, cy, r, "rgba(255,255,255,.9)");
  // glass towers, taller and cleaner
  for (let x = 10; x < W; ) {
    const bw = 36 + rnd() * 30, bh = 70 + rnd() * 70, top = 150 - bh;
    const gg = c.createLinearGradient(x, top, x + bw, top + bh); gg.addColorStop(0, "#5fb8d9"); gg.addColorStop(1, "#1f6f98");
    c.fillStyle = gg; c.beginPath();
    if (rnd() > 0.55) { c.moveTo(x, top + 10); c.lineTo(x + bw, top); c.lineTo(x + bw, 150); c.lineTo(x, 150); } else { c.rect(x, top, bw, bh); }
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1;
    for (let wx = x + 6; wx < x + bw; wx += 7) { c.beginPath(); c.moveTo(wx, top + 4); c.lineTo(wx, 150); c.stroke(); }
    for (let wy = top + 12; wy < 150; wy += 11) { c.beginPath(); c.moveTo(x, wy); c.lineTo(x + bw, wy); c.stroke(); }
    c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x, top, 5, bh);
    x += bw + 14 + rnd() * 22;
  }
}

/** Palm tree for Lekki: curved trunk and a fan of fronds. */
function palm(c: Ctx, x: number, baseY: number, h: number, lean: number) {
  c.strokeStyle = "#7a5a38"; c.lineWidth = 6; c.lineCap = "round";
  c.beginPath(); c.moveTo(x, baseY); c.quadraticCurveTo(x + lean * 0.2, baseY - h * 0.6, x + lean, baseY - h); c.stroke();
  const tx = x + lean, ty = baseY - h;
  c.fillStyle = "#2f9a4a";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.05 + (i / 6) * 0.9);
    c.save(); c.translate(tx, ty); c.rotate(a + Math.PI / 2 - Math.PI / 2);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * 26, Math.sin(a) * 26 - 8, Math.cos(a) * 44, Math.sin(a) * 44 + 8);
    c.quadraticCurveTo(Math.cos(a) * 26, Math.sin(a) * 26 + 2, 0, 3); c.fill(); c.restore();
  }
  disc(c, tx, ty + 3, 3.5, "#6b4a2a");
}

// ---------------------------------------------------------------- ground furniture
function umbrellaStall(c: Ctx, x: number, y: number, col: string, goods: string[]) {
  c.fillStyle = "#6b4a2b"; c.fillRect(x - 1, y - 40, 3, 42);
  c.fillStyle = col; c.beginPath(); c.moveTo(x - 30, y - 36); c.quadraticCurveTo(x, y - 62, x + 30, y - 36); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x - 10, y - 38); c.quadraticCurveTo(x - 2, y - 54, x + 2, y - 38); c.fill();
  rr(c, x - 28, y - 14, 56, 8, 2, "#8a5a33"); c.fillStyle = "#6b4a2b"; c.fillRect(x - 24, y - 6, 3, 18); c.fillRect(x + 21, y - 6, 3, 18);
  goods.forEach((g, i) => disc(c, x - 18 + i * 11, y - 19, 4.2, g));
}
function busStop(c: Ctx, x: number, y: number) {
  c.fillStyle = "#4a4d55"; c.fillRect(x, y - 52, 4, 58); c.fillRect(x + 92, y - 52, 4, 58);
  rr(c, x - 6, y - 60, 108, 9, 3, "#3b6ea8");
  c.fillStyle = "rgba(200,225,245,.5)"; c.fillRect(x + 4, y - 51, 88, 38);
  c.fillStyle = "#6b4a2b"; c.fillRect(x + 8, y - 8, 80, 5);
  rr(c, x + 100, y - 70, 16, 40, 3, "#3b6ea8"); c.fillStyle = "#fff"; c.font = `10px ${DISPLAY_FONT}`; c.textAlign = "center"; c.fillText("BUS", x + 108, y - 52); c.fillText("STOP", x + 108, y - 40);
  c.fillStyle = "#4a4d55"; c.fillRect(x + 107, y - 30, 3, 36);
}
function bukaShack(c: Ctx, x: number, y: number) {
  rr(c, x, y - 46, 90, 52, 3, "#d9c27a");
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#fff8e1" : "#e4382f"; c.fillRect(x - 4 + i * 16, y - 56, 16, 14); }
  rr(c, x + 10, y - 30, 70, 14, 2, "#7a4a28");
  c.fillStyle = "#fff"; c.font = `12px ${DISPLAY_FONT}`; c.textAlign = "center"; c.fillText("BUKA", x + 45, y - 19);
  disc(c, x + 22, y - 8, 5, "#c96a2a"); disc(c, x + 68, y - 8, 5, "#2f7a3f");
}
function tollBooth(c: Ctx, x: number, y: number) {
  rr(c, x, y - 52, 46, 58, 3, "#f4f6f8");
  c.fillStyle = "rgba(120,170,210,.6)"; c.fillRect(x + 6, y - 40, 34, 20);
  rr(c, x - 8, y - 62, 62, 12, 3, "#1b5fa8");
  c.fillStyle = "#fff"; c.font = `10px ${DISPLAY_FONT}`; c.textAlign = "center"; c.fillText("TOLL", x + 23, y - 53);
  c.fillStyle = "#f2c200"; c.fillRect(x, y - 6, 46, 6);
  c.fillStyle = "#e4382f"; c.fillRect(x + 50, y - 22, 28, 4); c.fillStyle = "#f4f6f8"; for (let i = 0; i < 3; i++) c.fillRect(x + 54 + i * 9, y - 22, 4, 4); // lifted barrier
  c.fillStyle = "#4a4d55"; c.fillRect(x + 48, y - 28, 4, 34);
}

// ---------------------------------------------------------------- backdrop
/** Static scenery, drawn once per junction. Each junction has its own sky, buildings, road and pavement furniture. */
export function renderBackdrop(j: Junction, ads: AdImages = {}): HTMLCanvasElement {
  const o = document.createElement("canvas"); o.width = W; o.height = H;
  const c = o.getContext("2d")!;
  const rnd = mulberry32(hashString(j.id));

  if (j.id === "ojuelegba") ojuelegbaSky(c, rnd);
  else if (j.id === "obalende") obalendeSky(c, rnd);
  else lekkiSky(c, rnd);

  if (j.id === "lekki") { palm(c, 18, 150, 78, 14); palm(c, 604, 150, 66, -10); palm(c, 902, 150, 84, -16); }

  for (const s of AD_SLOTS) drawBillboard(c, s, ads[s.id]);

  // top pavement and painted kerb
  c.fillStyle = j.pavement; c.fillRect(0, 140, W, TOP - 140);
  c.fillStyle = "rgba(0,0,0,.08)"; c.fillRect(0, 140, W, 3);
  c.fillStyle = "#f2c200"; c.fillRect(0, TOP - 6, W, 6); c.fillStyle = INK; for (let x = 0; x < W; x += 36) c.fillRect(x, TOP - 6, 18, 6);
  // billboard feet sit on this pavement, so draw their shadows again on top of it
  c.fillStyle = "rgba(0,0,0,.14)"; for (const s of AD_SLOTS) { c.beginPath(); c.ellipse(s.x + s.w / 2, 154, s.w * 0.4, 3, 0, 0, Math.PI * 2); c.fill(); }

  // road
  c.fillStyle = j.road; c.fillRect(0, TOP, W, BOTTOM - TOP);
  for (let i = 0; i < 700; i++) { c.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.08)"; c.fillRect(rnd() * W, TOP + rnd() * (BOTTOM - TOP), 2 + rnd() * 3, 2); }
  if (j.id === "ojuelegba") { // patched tar and a puddle
    c.fillStyle = "rgba(0,0,0,.16)"; for (const [px, py, pw, ph] of [[120, 300, 70, 26], [420, 214, 56, 20], [640, 330, 80, 22]]) { c.beginPath(); c.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "rgba(130,170,200,.18)"; c.beginPath(); c.ellipse(300, 246, 40, 9, 0, 0, Math.PI * 2); c.fill();
  }
  if (j.id === "obalende") { // old painted bus lane
    c.fillStyle = "rgba(247,181,0,.16)"; c.fillRect(0, TOP + 142, STOP_X - 6, 62);
  }
  c.strokeStyle = "rgba(245,240,200,.85)"; c.lineWidth = 3; c.setLineDash(j.id === "lekki" ? [40, 26] : [28, 22]);
  for (const y of [TOP + 71, TOP + 141]) { c.beginPath(); c.moveTo(0, y); c.lineTo(STOP_X - 6, y); c.stroke(); }
  c.setLineDash([]);
  if (j.id === "lekki") { c.fillStyle = "rgba(245,240,200,.55)"; c.fillRect(0, TOP + 5, W, 2); c.fillRect(0, BOTTOM - 7, W, 2); }
  c.fillStyle = "#f5f0c8"; c.fillRect(STOP_X + 2, TOP, 6, BOTTOM - TOP);
  for (let y = TOP + 8; y < BOTTOM - 10; y += 22) c.fillRect(STOP_X + 18, y, 46, 11);

  // bottom pavement
  c.fillStyle = "#f2c200"; c.fillRect(0, BOTTOM, W, 6); c.fillStyle = INK; for (let x = 18; x < W; x += 36) c.fillRect(x, BOTTOM, 18, 6);
  c.fillStyle = j.pavement; c.fillRect(0, BOTTOM + 6, W, H - BOTTOM - 6);
  c.strokeStyle = "rgba(0,0,0,.08)"; c.lineWidth = 2;
  if (j.id === "lekki") { // clean pavers in a herringbone-ish grid
    for (let x = 0; x < W; x += 30) { c.beginPath(); c.moveTo(x, BOTTOM + 6); c.lineTo(x, H); c.stroke(); }
    for (let y = BOTTOM + 22; y < H; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  } else if (j.id === "obalende") { // big concrete slabs
    for (let x = 0; x < W; x += 120) { c.beginPath(); c.moveTo(x, BOTTOM + 6); c.lineTo(x, H); c.stroke(); }
    for (let y = BOTTOM + 60; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  } else { // cracked, uneven slabs
    for (let x = 0; x < W; x += 60) { c.beginPath(); c.moveTo(x, BOTTOM + 6); c.lineTo(x, H); c.stroke(); }
    for (let y = BOTTOM + 46; y < H; y += 46) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.strokeStyle = "rgba(0,0,0,.22)"; c.lineWidth = 1.5; for (let i = 0; i < 9; i++) { const x = 20 + rnd() * 900, y = BOTTOM + 20 + rnd() * 130; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14, y + 8); c.lineTo(x + 20, y + 22); c.stroke(); }
  }

  // street furniture: kept to the left and right so the middle stays free for you to stand
  if (j.id === "ojuelegba") {
    umbrellaStall(c, 60, BOTTOM + 78, "#e4382f", ["#4aa3df", "#4aa3df", "#f2f2f2", "#e8a33c"]);
    umbrellaStall(c, 150, BOTTOM + 90, "#f7b500", ["#c33", "#2e8b57", "#c9a227", "#fff"]);
    umbrellaStall(c, 690, BOTTOM + 82, "#2f78c4", ["#f2f2f2", "#f2f2f2", "#e4382f", "#4aa3df"]);
    umbrellaStall(c, 800, BOTTOM + 92, "#0e8f4e", ["#e8a33c", "#c33", "#c9a227", "#fff"]);
    umbrellaStall(c, 900, BOTTOM + 80, "#e4382f", ["#4aa3df", "#fff", "#c9a227", "#2e8b57"]);
  } else if (j.id === "obalende") {
    busStop(c, 34, BOTTOM + 96);
    bukaShack(c, 676, BOTTOM + 96);
    c.fillStyle = "#555a63"; rr(c, 800, BOTTOM + 70, 16, 26, 3, "#555a63"); c.fillStyle = "#3b6ea8"; c.fillRect(802, BOTTOM + 74, 12, 4);
    c.fillStyle = "rgba(247,181,0,.8)"; for (let x = 580; x < 940; x += 40) c.fillRect(x, BOTTOM + 112, 22, 4);
  } else {
    tollBooth(c, 664, BOTTOM + 90); tollBooth(c, 770, BOTTOM + 90);
    c.fillStyle = "#4f9a4a"; rr(c, 0, BOTTOM + 106, 220, 40, 14, "#4f9a4a"); rr(c, 600, BOTTOM + 112, 360, 34, 14, "#4f9a4a");
    palm(c, 30, BOTTOM + 112, 62, 10); palm(c, 888, BOTTOM + 116, 70, -12);
    c.fillStyle = "#3a8a3e"; for (let x = 8; x < 214; x += 18) c.fillRect(x, BOTTOM + 112, 7, 10);
  }
  return o;
}
