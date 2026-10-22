import { ITEMS, ITEM_IDS } from "./items";
import type { Buyer, ItemId, Kind, Tell } from "./types";
import type { RoundEventKind } from "./events";
import type { Rng } from "./rng";

/** Vehicle look and pay. mult scales every price the buyer will pay. */
export const SPEC: Record<Kind, { w: number; h: number; mult: number; color: string; label: string }> = {
  okada: { w: 48, h: 30, mult: 0.9, color: "#2b2b33", label: "Okada" },
  keke: { w: 56, h: 38, mult: 1, color: "#f2c200", label: "Keke" },
  danfo: { w: 104, h: 46, mult: 1, color: "#f7b500", label: "Danfo" },
  car: { w: 76, h: 34, mult: 1.1, color: "#4aa3df", label: "Car" },
  jeep: { w: 90, h: 42, mult: 1.8, color: "#1c1d22", label: "Jeep" },
};

const CAR_COLORS = ["#4aa3df", "#e4382f", "#f2f2f2", "#8d9aa6", "#2e8b57", "#c9a227"];

type Dist<T extends string> = Record<T, number>;

/** How likely each body language is, per vehicle. */
const TELL_ODDS: Record<Kind, Dist<Tell>> = {
  okada: { ignore: 0.3, maybe: 0.4, keen: 0.3 },
  keke: { ignore: 0.25, maybe: 0.4, keen: 0.35 },
  danfo: { ignore: 0.35, maybe: 0.4, keen: 0.25 },
  car: { ignore: 0.4, maybe: 0.35, keen: 0.25 },
  jeep: { ignore: 0.65, maybe: 0.25, keen: 0.1 },
};

/** Chance that someone with this tell actually buys. Not everybody does. */
const BUY_ODDS: Record<Kind, Dist<Tell>> = {
  okada: { ignore: 0.1, maybe: 0.5, keen: 0.85 },
  keke: { ignore: 0.1, maybe: 0.5, keen: 0.85 },
  danfo: { ignore: 0.08, maybe: 0.45, keen: 0.85 },
  car: { ignore: 0.06, maybe: 0.42, keen: 0.85 },
  jeep: { ignore: 0.03, maybe: 0.35, keen: 0.8 },
};

const none = () => Object.fromEntries(ITEM_IDS.map((k) => [k, 0])) as Dist<ItemId>;
const want = (o: Partial<Dist<ItemId>>): Dist<ItemId> => ({ ...none(), ...o });
/** What each kind of vehicle asks for. Market-only goods (fruit, bread, chargers, shades, perfume) are a smaller share. */
const WANT_ODDS: Record<Kind, Dist<ItemId>> = {
  okada: want({ water: 0.45, drink: 0.15, snack: 0.25, fruit: 0.1, bread: 0.05 }),
  keke: want({ water: 0.35, drink: 0.25, snack: 0.2, fruit: 0.08, bread: 0.1, charger: 0.02 }),
  danfo: want({ water: 0.25, drink: 0.15, snack: 0.33, bread: 0.15, fruit: 0.1, charger: 0.02 }),
  car: want({ water: 0.08, drink: 0.3, snack: 0.18, gadget: 0.12, charger: 0.1, shades: 0.1, perfume: 0.05, fruit: 0.04, bread: 0.03 }),
  jeep: want({ drink: 0.2, snack: 0.05, gadget: 0.3, charger: 0.05, shades: 0.2, perfume: 0.2 }),
};

function weighted<T extends string>(dist: Dist<T>, rng: Rng = Math.random): T {
  const keys = Object.keys(dist) as T[];
  let r = rng() * keys.reduce((a, k) => a + dist[k], 0);
  for (const k of keys) { r -= dist[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

export const pickKind = (mix: Dist<Kind>, rng: Rng = Math.random): Kind => weighted(mix, rng);
export const pickColor = (kind: Kind, rng: Rng = Math.random) => (kind === "car" ? CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)] : SPEC[kind].color);

export function makeBuyer(kind: Kind, weather: RoundEventKind, rng: Rng = Math.random): Buyer {
  const tell = weighted(TELL_ODDS[kind], rng);
  let buyP = BUY_ODDS[kind][tell];
  const wants = { ...WANT_ODDS[kind] };
  if (weather === "rain") buyP *= 0.75;
  if (weather === "sun") { buyP = Math.min(0.95, buyP * 1.1); wants.water *= 2; wants.drink *= 2; }
  const want = weighted(wants, rng);
  const base = ITEMS[want].price * SPEC[kind].mult * (0.85 + rng() * 0.3);
  const offer = Math.max(10, Math.round(base / 10) * 10);
  const pushP = ({ keen: 0.6, maybe: 0.45, ignore: 0.3 } as Dist<Tell>)[tell] + (kind === "jeep" ? 0.1 : 0);
  return { tell, willBuy: rng() < buyP, want, offer, pushP };
}

export { ITEM_IDS };

/** Short lines for a buyer who is not buying. Lagos-style. */
export const NO_LINES = ["Not today!", "No change!", "Abeg, move.", "I dey rush!", "Next time!", "Wetin you sell?"];
export const YES_LINES = ["Na so!", "Thank you!", "Correct!", "Oya, give me."];
export const PUSH_FAIL_LINES = ["Too cost!", "Forget am!", "Abeg no vex."];
