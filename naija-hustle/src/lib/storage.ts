import { DEFAULT_AVATAR, type AvatarConfig } from "@/game/avatar/avatar";
import { STARTER_STOCK, STARTING_MONEY, emptyStock } from "@/game/engine/items";
import type { Stock } from "@/game/engine/types";
import { JUNCTIONS, type JunctionId } from "@/game/engine/junctions";

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
/** `stock` is what is on your tray. `storage` is what you have at home from the market. */
/** `junction` is where you work, and decides which markets a run can send you to. */
export type SaveData = { money: number; stock: Stock; storage: Stock; sellers: HiredSeller[]; junction: JunctionId };

export function defaultSave(): SaveData {
  return { money: STARTING_MONEY, stock: emptyStock(), storage: { ...STARTER_STOCK }, sellers: [], junction: "ojuelegba" };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw) as Partial<SaveData>;
    return {
      money: typeof s.money === "number" ? s.money : STARTING_MONEY,
      stock: { ...emptyStock(), ...(s.stock ?? {}) },
      storage: { ...emptyStock(), ...(s.storage ?? {}) },
      sellers: Array.isArray(s.sellers) ? s.sellers : [],
      junction: s.junction && s.junction in JUNCTIONS ? s.junction : "ojuelegba",
    };
  } catch { return defaultSave(); }
}
export function writeSave(s: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}
/** Update just the player's own money, tray and home stock, keeping the sellers the base page manages. */
export function bankPlayer(money: number, stock: Stock, storage: Stock) {
  const s = loadSave(); writeSave({ ...s, money, stock, storage });
}
/** Remember which junction the player picked, so the market run knows where they work. */
export function bankJunction(junction: JunctionId) {
  const s = loadSave(); writeSave({ ...s, junction });
}
