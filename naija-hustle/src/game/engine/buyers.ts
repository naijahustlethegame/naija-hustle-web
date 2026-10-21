import { ITEMS, ITEM_IDS } from "./items";
import type { Buyer, ItemId, Kind, Tell } from "./types";
import type { RoundEventKind } from "./events";

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

const WANT_ODDS: Record<Kind, Dist<ItemId>> = {
  okada: { water: 0.5, drink: 0.2, snack: 0.3, gadget: 0 },
  keke: { water: 0.4, drink: 0.3, snack: 0.3, gadget: 0 },
  danfo: { water: 0.3, drink: 0.2, snack: 0.5, gadget: 0 },
  car: { water: 0.1, drink: 0.4, snack: 0.3, gadget: 0.2 },
  jeep: { water: 0, drink: 0.3, snack: 0.1, gadget: 0.6 },
};

function weighted<T extends string>(dist: Dist<T>): T {
  const keys = Object.keys(dist) as T[];
  let r = Math.random() * keys.reduce((a, k) => a + dist[k], 0);
  for (const k of keys) { r -= dist[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

export const pickKind = (mix: Dist<Kind>): Kind => weighted(mix);
export const pickColor = (kind: Kind) => (kind === "car" ? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] : SPEC[kind].color);

export function makeBuyer(kind: Kind, weather: RoundEventKind): Buyer {
  const tell = weighted(TELL_ODDS[kind]);
  let buyP = BUY_ODDS[kind][tell];
  const wants = { ...WANT_ODDS[kind] };
  if (weather === "rain") buyP *= 0.75;
  if (weather === "sun") { buyP = Math.min(0.95, buyP * 1.1); wants.water *= 2; wants.drink *= 2; }
  const want = weighted(wants);
  const base = ITEMS[want].price * SPEC[kind].mult * (0.85 + Math.random() * 0.3);
  const offer = Math.max(10, Math.round(base / 10) * 10);
  const pushP = ({ keen: 0.6, maybe: 0.45, ignore: 0.3 } as Dist<Tell>)[tell] + (kind === "jeep" ? 0.1 : 0);
  return { tell, willBuy: Math.random() < buyP, want, offer, pushP };
}

export { ITEM_IDS };

/** Short lines for a buyer who is not buying. Lagos-style. */
export const NO_LINES = ["Not today!", "No change!", "Abeg, move.", "I dey rush!", "Next time!", "Wetin you sell?"];
export const YES_LINES = ["Na so!", "Thank you!", "Correct!", "Oya, give me."];
export const PUSH_FAIL_LINES = ["Too cost!", "Forget am!", "Abeg no vex."];
