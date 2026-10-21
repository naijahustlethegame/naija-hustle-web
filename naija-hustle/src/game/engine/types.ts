export const W = 960;
export const H = 540;

export type Kind = "okada" | "keke" | "danfo" | "car" | "jeep";
export type ItemId = "water" | "drink" | "snack" | "gadget" | "fruit" | "bread" | "charger" | "shades" | "perfume";
export type Stock = Record<ItemId, number>;

/** What a buyer's body language says. It is a hint, not a promise. */
export type Tell = "ignore" | "maybe" | "keen";

export type Buyer = {
  tell: Tell;
  willBuy: boolean; // hidden roll: the tell only makes it more or less likely
  want: ItemId;
  offer: number;    // what they will pay before streak bonus
  pushP: number;    // chance that pushing the price works
};
