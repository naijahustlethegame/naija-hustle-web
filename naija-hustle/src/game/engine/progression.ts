import { JUNCTIONS, type JunctionId } from "./junctions";
import type { Market } from "./markets";
import type { ItemId } from "./types";

/**
 * What a new player owns, and what everything else costs to unlock.
 * The server has its own copy of these numbers (game/data.ts) and is the one that charges for them.
 *
 * Places are what you unlock. Each junction comes with the stock sold there, so buying the junction opens its items too.
 *
 * How the prices were picked (a normal player, selling what they pick up in market runs):
 *   Ojuelegba, everyday stock ..... about N500 a minute  -> Obalende at N15,000 is about 30 minutes in
 *   Obalende, with Tech stock ..... about N900 a minute  -> Lekki at N50,000 is about an hour more
 *   Lekki, with Luxury stock ...... about N2,200 a minute
 * Hired sellers speed all of this up, so the first unlock is never a wall and the last one is still a goal.
 */
export const STARTER_JUNCTIONS: JunctionId[] = ["ojuelegba"];

/** The stock that comes with each junction. Owning the junction means owning these. */
export const JUNCTION_ITEMS: Record<JunctionId, ItemId[]> = {
  ojuelegba: ["water", "drink", "snack", "fruit", "bread"],
  obalende: ["charger", "gadget"],
  lekki: ["shades", "perfume"],
};
export const STARTER_ITEMS: ItemId[] = STARTER_JUNCTIONS.flatMap((j) => JUNCTION_ITEMS[j]);

export type JunctionUnlock = { id: JunctionId; price: number; requires?: JunctionId };
export const JUNCTION_UNLOCKS: JunctionUnlock[] = [
  { id: "obalende", price: 15000 },
  { id: "lekki", price: 50000, requires: "obalende" },
];

/** Everything the player owns, as the server reports it. */
export type Unlocks = { junctions: JunctionId[]; items: ItemId[] };
export const starterUnlocks = (): Unlocks => ({ junctions: [...STARTER_JUNCTIONS], items: [...STARTER_ITEMS] });

export const hasJunction = (u: Unlocks, id: JunctionId) => u.junctions.includes(id);
export const hasItem = (u: Unlocks, id: ItemId) => u.items.includes(id);
export const junctionUnlock = (id: JunctionId) => JUNCTION_UNLOCKS.find((j) => j.id === id);
/** The junction you have to own before this item is yours. */
export const junctionForItem = (item: ItemId): JunctionId =>
  (Object.keys(JUNCTION_ITEMS) as JunctionId[]).find((j) => JUNCTION_ITEMS[j].includes(item)) ?? "ojuelegba";

/** Why a junction cannot be bought yet, or "" if it can. */
export function junctionBlock(u: Unlocks, id: JunctionId): string {
  const j = junctionUnlock(id); if (!j || hasJunction(u, id)) return "";
  if (j.requires && !hasJunction(u, j.requires)) return `Unlock ${JUNCTIONS[j.requires].name} first`;
  return "";
}

/** A market with the things you have not unlocked taken out of its prize list. */
export function marketFor(m: Market, u: Unlocks): Market {
  const items = Object.fromEntries(Object.entries(m.items).filter(([k]) => u.items.includes(k as ItemId))) as Market["items"];
  return { ...m, items };
}
/** The things this market drops that you cannot pick up yet. */
export const lockedAt = (m: Market, u: Unlocks) => (Object.keys(m.items) as ItemId[]).filter((k) => !u.items.includes(k));
