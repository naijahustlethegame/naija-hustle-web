import type { AvatarConfig } from "@/game/avatar/avatar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const WS_URL = API.replace(/^http/, "ws") + "/ws";

export type Peer = { id: string; name: string; avatar: AvatarConfig | null };
export type RoomInfo = { room: string | null; junction: string | null; cap: number; players: Peer[] };
export type Handlers = {
  onRoster?: (r: RoomInfo) => void;
  onSnap?: (p: [string, number, number, string][]) => void;
  onClaimResult?: (key: string, winner: string, losers?: string[]) => void;
  onSettled?: (key: string, by: string, sold: boolean, price: number) => void;
};

/** Thin WebSocket client for a game room. Reconnects by itself; the game still works offline. */
export class RoomClient {
  id = ""; connected = false;
  private ws: WebSocket | null = null; private dead = false; private retry = 0;
  private lastJoin: object | null = null; private lastPos = 0;
  constructor(private h: Handlers) { this.open(); }

  private open() {
    if (this.dead) return;
    try { this.ws = new WebSocket(WS_URL); } catch { return this.later(); }
    const ws = this.ws;
    ws.onopen = () => { this.connected = true; this.retry = 0; if (this.lastJoin) this.raw(this.lastJoin); };
    ws.onmessage = (e) => {
      let m: any; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === "welcome") this.id = m.id;
      else if (m.type === "roster") this.h.onRoster?.({ room: m.room, junction: m.junction, cap: m.cap, players: m.players });
      else if (m.type === "snap") this.h.onSnap?.(m.p);
      else if (m.type === "claimResult") this.h.onClaimResult?.(m.key, m.winner, m.losers);
      else if (m.type === "settled") this.h.onSettled?.(m.key, m.by, m.sold, m.price);
    };
    ws.onclose = () => { this.connected = false; this.id = ""; this.later(); };
    ws.onerror = () => ws.close();
  }
  private later() { if (!this.dead) setTimeout(() => this.open(), Math.min(10000, 800 * 2 ** this.retry++)); }
  private raw(m: object) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }

  /** junction omitted = watch the busiest room anywhere. play=false = spectate (no seat). */
  join(o: { junction?: string; play: boolean; avatar?: AvatarConfig }) { this.lastJoin = { type: "join", ...o }; this.raw(this.lastJoin); }
  pos(x: number, y: number, s: string) { const n = performance.now(); if (n - this.lastPos < 100) return; this.lastPos = n; this.raw({ type: "pos", x: Math.round(x), y: Math.round(y), s }); }
  claim(key: string) { this.raw({ type: "claim", key }); }
  settle(key: string, sold: boolean, price = 0) { this.raw({ type: "settle", key, sold, price }); }
  close() { this.dead = true; this.ws?.close(); }
}
