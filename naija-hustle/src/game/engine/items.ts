import type { ItemId, Stock } from "./types";

export const ITEM_IDS: ItemId[] = ["water", "drink", "snack", "gadget"];

/** cost = what you pay at Mama Put. price = typical street price before the buyer's mood. */
export const ITEMS: Record<ItemId, { name: string; icon: string; cost: number; price: number }> = {
  water: { name: "Pure water", icon: "💧", cost: 20, price: 50 },
  drink: { name: "Cold drink", icon: "🥤", cost: 70, price: 150 },
  snack: { name: "Snacks", icon: "🍿", cost: 55, price: 120 },
  gadget: { name: "Gadgets", icon: "🎧", cost: 450, price: 800 },
};

/** How many things fit in your hands and tray. */
export const CAPACITY = 14;
export const STARTING_MONEY = 3000;

export const emptyStock = (): Stock => ({ water: 0, drink: 0, snack: 0, gadget: 0 });
export const countStock = (s: Stock) => ITEM_IDS.reduce((a, k) => a + s[k], 0);
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
