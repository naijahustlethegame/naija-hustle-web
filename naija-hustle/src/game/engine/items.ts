import type { ItemId, Stock } from "./types";

/** The first five are the everyday stock every player starts with. Chargers, gadgets, sunglasses and perfume have to be unlocked. */
export const ITEM_IDS: ItemId[] = ["water", "drink", "snack", "gadget", "fruit", "bread", "charger", "shades", "perfume"];
export const CORE_ITEMS: ItemId[] = ["water", "drink", "snack", "fruit", "bread"];

/** cost = what a unit is worth at the market. price = typical street price before the buyer's mood. */
export const ITEMS: Record<ItemId, { name: string; icon: string; cost: number; price: number }> = {
  water: { name: "Pure water", icon: "💧", cost: 20, price: 50 },
  drink: { name: "Cold drink", icon: "🥤", cost: 70, price: 150 },
  snack: { name: "Snacks", icon: "🍿", cost: 55, price: 120 },
  gadget: { name: "Gadgets", icon: "🎧", cost: 450, price: 800 },
  fruit: { name: "Fresh fruit", icon: "🍊", cost: 30, price: 70 },
  bread: { name: "Hot bread", icon: "🍞", cost: 45, price: 100 },
  charger: { name: "Phone chargers", icon: "🔌", cost: 250, price: 500 },
  shades: { name: "Sunglasses", icon: "🕶️", cost: 300, price: 650 },
  perfume: { name: "Perfume", icon: "🧴", cost: 600, price: 1200 },
};

/** How many things fit in your hands and tray. */
export const CAPACITY = 14;
/** How much stock you can keep at home. You fill it at the market, then choose what goes on your tray. */
export const STORAGE_CAP = 60;
export const STARTING_MONEY = 3000;
/** A new player starts with a little stock at home so they can play straight away. */
export const emptyStock = (): Stock => Object.fromEntries(ITEM_IDS.map((k) => [k, 0])) as Stock;
export const STARTER_STOCK: Stock = { ...emptyStock(), water: 8, drink: 3, snack: 3 };
export const countStock = (s: Stock) => ITEM_IDS.reduce((a, k) => a + s[k], 0);
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
