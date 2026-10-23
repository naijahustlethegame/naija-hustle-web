import { DEFAULT_AVATAR, type AvatarConfig } from "@/game/avatar/avatar";
import { STARTING_MONEY, emptyStock } from "@/game/engine/items";
import type { Stock } from "@/game/engine/types";
import type { JunctionId } from "@/game/engine/junctions";
import { starterUnlocks, type Unlocks } from "@/game/engine/progression";

// Only the avatar look stays in the browser. Money, stock, sellers and the pot live on the server (see lib/api.ts).
const AVATAR_KEY = "naija-hustle:avatar";

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : DEFAULT_AVATAR;
  } catch { return DEFAULT_AVATAR; }
}
export function saveAvatar(a: AvatarConfig) {
  try { localStorage.setItem(AVATAR_KEY, JSON.stringify(a)); } catch {}
}

/** A seller you hired. `since` is when they last handed over their earnings (ms). */
export type HiredSeller = { id: string; since: number };
/** Winnings from market runs that have not been banked yet. `running` is set while a run is in progress. */
export type Pot = { items: Stock; cash: number; level: number; market: string; running: boolean };
/** Server state of the player. `stock` is the tray, `storage` is home. */
export type SaveData = { money: number; stock: Stock; storage: Stock; sellers: HiredSeller[]; junction: JunctionId; pot: Pot | null; unlocks: Unlocks };

export const defaultSave = (): SaveData => ({ money: STARTING_MONEY, stock: emptyStock(), storage: emptyStock(), sellers: [], junction: "ojuelegba", pot: null, unlocks: starterUnlocks() });
