import { loadAvatar, type HiredSeller, type Pot, type SaveData } from "@/lib/storage";
import { emptyStock } from "@/game/engine/items";
import { STARTER_ITEMS, STARTER_JUNCTIONS, type Unlocks } from "@/game/engine/progression";
import type { ItemId } from "@/game/engine/types";
import type { Stock } from "@/game/engine/types";
import type { JunctionId } from "@/game/engine/junctions";
import { token } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export class ApiError extends Error { constructor(public status: number, m: string) { super(m); } }

async function call<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown, keepalive = false): Promise<T> {
  const r = await fetch(API + path, {
    method, keepalive, cache: "no-store",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  if (!r.ok) throw new ApiError(r.status, (await r.json().catch(() => ({})))?.error ?? "fail");
  return r.json();
}

type RawPot = { items: Partial<Stock>; cash: number | string; level: number; market: string; running: boolean };
export const toPot = (p: RawPot): Pot => ({ items: { ...emptyStock(), ...p.items }, cash: Number(p.cash), level: p.level, market: p.market, running: p.running });
const toStock = (s?: Partial<Stock>): Stock => ({ ...emptyStock(), ...(s ?? {}) });

type RawPlayer = { money: number | string; junction: JunctionId; stock: Partial<Stock>; storage: Partial<Stock>; sellers: { seller_id: string; since: string }[]; pot: RawPot | null; unlocked_junctions?: JunctionId[]; unlocked_items?: ItemId[] };
const toSave = (p: RawPlayer): SaveData => ({
  money: Number(p.money), junction: p.junction, stock: toStock(p.stock), storage: toStock(p.storage),
  sellers: p.sellers.map((s): HiredSeller => ({ id: s.seller_id, since: Date.parse(s.since) })),
  pot: p.pot ? toPot(p.pot) : null,
  unlocks: { junctions: p.unlocked_junctions ?? [...STARTER_JUNCTIONS], items: p.unlocked_items ?? [...STARTER_ITEMS] } satisfies Unlocks,
});

/** The player's full state from the server. First call of a browser session creates the row; later ones are a plain GET. Concurrent calls share one request. */
let pending: Promise<SaveData> | null = null;
export function loadPlayer(): Promise<SaveData> {
  return (pending ??= (async () => {
    let inited = false; try { inited = sessionStorage.getItem("nh:init") === "1"; } catch {}
    const raw = inited ? await call<RawPlayer>("/player") : await call<RawPlayer>("/player/init", "POST", { avatar: loadAvatar() });
    try { sessionStorage.setItem("nh:init", "1"); } catch {}
    return toSave(raw);
  })().finally(() => { pending = null; }));
}

export const api = {
  setJunction: (junction: JunctionId) => call<{ junction: string }>("/player/junction", "POST", { junction }),
  tray: (toTray: Stock, ka = false) => call("/player/tray", "POST", { toTray }, ka),
  sales: (sales: { item: string; price: number }[], ka = false) => call("/player/sales", "POST", { sales }, ka),
  hit: (hits: number, items: Stock, ka = false) => call("/player/hit", "POST", { hits, items }, ka),
  start: () => call<{ market: string; fee: number; money: number; room: number }>("/runs/start", "POST"),
  push: () => call<{ level: number }>("/runs/push", "POST"),
  finish: (items: Stock, cash: number) => call<{ pot: RawPot }>("/runs/finish", "POST", { items, cash: Math.floor(cash) }),
  fail: () => call<{ money: number }>("/runs/fail", "POST"),
  bank: async () => { const b = await call<{ money: number; storage: Partial<Stock> }>("/runs/bank", "POST"); return { money: Number(b.money), storage: toStock(b.storage) }; },
  /** Buying a junction also unlocks the items sold there. */
  unlockJunction: (id: JunctionId) => call<{ money: number; junctions: JunctionId[]; items: ItemId[] }>("/unlocks/junction", "POST", { id }),
  hire: (id: string) => call<{ money: number }>("/sellers/hire", "POST", { id }),
  collect: () => call<{ collected: number; money: number }>("/sellers/collect", "POST"),
};

/** Leaderboard: ranked by money in hand. The top list is public; `me` and `setName` need the player's session. */
export type Row = { name: string; money: number };
export type Me = { name: string; money: number; rank: number | null };
export async function getTop(): Promise<Row[]> {
  const r = await fetch(`${API}/leaderboard`, { cache: "no-store" });
  if (!r.ok) throw new Error("fail");
  return ((await r.json()).top as { name: string; money: number | string }[]).map((x) => ({ name: x.name, money: Number(x.money) }));
}
export const getMe = async (): Promise<Me> => { const m = await call<Me>("/leaderboard/me"); return { ...m, money: Number(m.money) }; };
export const setName = async (name: string): Promise<string> => (await call<{ name: string }>("/leaderboard/name", "POST", { name })).name;
