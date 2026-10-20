export type AvatarConfig = { hat: string; shirt: string; trouser: string; shoe: string; skin: string };

export const DEFAULT_AVATAR: AvatarConfig = { hat: "cap", shirt: "#e8412c", trouser: "#2b4c9b", shoe: "#ffffff", skin: "#8a5a3c" };

export const OPTIONS = {
  hat: ["none", "cap", "fila", "bucket"],
  shirt: ["#e8412c", "#0f8f4f", "#f5c400", "#ffffff", "#7a3fb0"],
  trouser: ["#2b4c9b", "#2a2118", "#8b6b3e", "#c0392b"],
  shoe: ["#ffffff", "#2a2118", "#f5c400", "#0f8f4f"],
} as const;

/** Draws the avatar with feet at (x, y). One function shared by game and editor. */
export function drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, a: AvatarConfig, t = 0, scale = 1, moving = true) {
  const s = scale, sw = moving ? Math.sin(t * 14) * 4 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 1, 12, 4, 0, 0, 7); ctx.fill();
  // legs + shoes
  ctx.fillStyle = a.trouser; ctx.fillRect(-7 + sw, -18, 6, 16); ctx.fillRect(1 - sw, -18, 6, 16);
  ctx.fillStyle = a.shoe; ctx.fillRect(-8 + sw, -3, 8, 4); ctx.fillRect(0 - sw, -3, 8, 4);
  // shirt
  ctx.fillStyle = a.shirt; ctx.fillRect(-9, -36, 18, 20);
  // head
  ctx.fillStyle = a.skin; ctx.beginPath(); ctx.arc(0, -43, 8, 0, 7); ctx.fill();
  // hat
  if (a.hat === "cap") { ctx.fillStyle = "#c0392b"; ctx.fillRect(-8, -52, 16, 5); ctx.fillRect(2, -48, 10, 2); }
  if (a.hat === "fila") { ctx.fillStyle = "#0f8f4f"; ctx.beginPath(); ctx.moveTo(-8, -48); ctx.lineTo(-6, -56); ctx.lineTo(8, -56); ctx.lineTo(8, -48); ctx.fill(); }
  if (a.hat === "bucket") { ctx.fillStyle = "#f5c400"; ctx.fillRect(-11, -49, 22, 3); ctx.fillRect(-7, -56, 14, 8); }
  ctx.restore();
}
