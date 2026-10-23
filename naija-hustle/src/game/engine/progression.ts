import type { JunctionId } from "./junctions";
import type { Market } from "./markets";
import type { ItemId } from "./types";

/**
 * What a new player owns, and what everything else costs to unlock.
 * The server has its own copy of these numbers (game/data.ts) and is the one that charges for them.
 *
 * How the prices were picked (a normal player, selling what they pick up in market runs):
 *   Ojuelegba, basic stock ........ about N500 a minute  -> Obalende at N15,000 is about 30 minutes in
 *   Obalende, with Tech stock ..... about N900 a minute  -> Lekki at N50,000 is about an hour more
 *   Lekki, with Luxury stock ...... about N2,200 a minute
 * Hired sellers speed all of this up, so the first unlock is never a wall and the last one is still a goal.
 */
export const STARTER_JUNCTIONS: JunctionId[] = ["ojuelegba"];
export const STARTER_ITEMS: ItemId[] = ["water", "drink", "snack", "fruit", "bread"];

export type JunctionUnlock = { id: JunctionId; price: number; requires?: JunctionId };
export const JUNCTION_UNLOCKS: JunctionUnlock[] = [
  { id: "obalende", price: 15000 },
  { id: "lekki", price: 50000, requires: "obalende" },
];

export type ItemPackId = "tech" | "luxury";
export type ItemPack = { id: ItemPackId; name: string; blurb: string; items: ItemId[]; price: number; requiresJunction?: JunctionId };
export const ITEM_PACKS: ItemPack[] = [
  { id: "tech", name: "Tech stock", blurb: "Phone chargers and gadgets. They sell for 3 to 5 times more than water.", items: ["charger", "gadget"], price: 6000 },
  { id: "luxury", name: "Luxury stock", blurb: "Sunglasses and perfume. The dearest things you can sell.", items: ["shades", "perfume"], price: 25000, requiresJunction: "lekki" },
];

/** Everything the player owns, as the server reports it. */
export type Unlocks = { junctions: JunctionId[]; items: ItemId[] };
export const starterUnlocks = (): Unlocks => ({ junctions: [...STARTER_JUNCTIONS], items: [...STARTER_ITEMS] });

export const hasJunction = (u: Unlocks, id: JunctionId) => u.junctions.includes(id);
export const packOwned = (u: Unlocks, p: ItemPack) => p.items.every((i) => u.items.includes(i));
export const junctionUnlock = (id: JunctionId) => JUNCTION_UNLOCKS.find((j) => j.id === id);
export const packFor = (item: ItemId) => ITEM_PACKS.find((p) => p.items.includes(item));

/** Why a junction cannot be bought yet, or "" if it can. */
export function junctionBlock(u: Unlocks, id: JunctionId): string {
  const j = junctionUnlock(id); if (!j || hasJunction(u, id)) return "";
  if (j.requires && !hasJunction(u, j.requires)) return `Unlock ${j.requires === "obalende" ? "Obalende" : j.requires} first`;
  return "";
}
export function packBlock(u: Unlocks, p: ItemPack): string {
  if (packOwned(u, p)) return "";
  if (p.requiresJunction && !hasJunction(u, p.requiresJunction)) return "Unlock Lekki toll gate first";
  return "";
}

/** A market with the things you have not unlocked taken out of its prize list. */
export function marketFor(m: Market, u: Unlocks): Market {
  const items = Object.fromEntries(Object.entries(m.items).filter(([k]) => u.items.includes(k as ItemId))) as Market["items"];
  return { ...m, items };
}
/** The things this market drops that you cannot pick up yet. */
export const lockedAt = (m: Market, u: Unlocks) => (Object.keys(m.items) as ItemId[]).filter((k) => !u.items.includes(k));
