import { DEFAULT_AVATAR, type AvatarConfig } from "@/game/avatar/avatar";
import { STARTING_MONEY, emptyStock } from "@/game/engine/items";
import type { Stock } from "@/game/engine/types";

const AVATAR_KEY = "naija-hustle:avatar";
const SAVE_KEY = "naija-hustle:save:v1";

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : DEFAULT_AVATAR;
  } catch { return DEFAULT_AVATAR; }
}
export function saveAvatar(a: AvatarConfig) {
  try { localStorage.setItem(AVATAR_KEY, JSON.stringify(a)); } catch {}
}

/** A seller you hired. `since` is when they last handed over their earnings. */
export type HiredSeller = { id: string; since: number };
export type SaveData = { money: number; stock: Stock; sellers: HiredSeller[] };

export function defaultSave(): SaveData {
  return { money: STARTING_MONEY, stock: emptyStock(), sellers: [] };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw) as Partial<SaveData>;
    return {
      money: typeof s.money === "number" ? s.money : STARTING_MONEY,
      stock: { ...emptyStock(), ...(s.stock ?? {}) },
      sellers: Array.isArray(s.sellers) ? s.sellers : [],
    };
  } catch { return defaultSave(); }
}
export function writeSave(s: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}
/** Update just the player's own money and stock, keeping the sellers the base page manages. */
export function bankPlayer(money: number, stock: Stock) {
  const s = loadSave(); writeSave({ ...s, money, stock });
}
