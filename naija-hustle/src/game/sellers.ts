import type { AvatarConfig } from "./avatar/avatar";
import type { HiredSeller } from "@/lib/storage";

export type SellerDef = {
  id: string; name: string; skill: string; blurb: string;
  price: number;      // one-time hiring fee
  perMin: number;     // average naira earned per minute while working
  look: AvatarConfig;
};

/** Hired sellers work their own corner on auto. They never join you at the junction. */
export const SELLERS: SellerDef[] = [
  { id: "tunde", name: "Tunde", skill: "Rookie", blurb: "A good first hire.",
    price: 1500, perMin: 60, look: { hat: "cap", shirt: "#0f8f4f", trouser: "#2a2118", shoe: "#ffffff", skin: "#6b4226" } },
  { id: "amaka", name: "Amaka", skill: "Sharp", blurb: "Very active.",
    price: 4000, perMin: 180, look: { hat: "none", shirt: "#7a3fb0", trouser: "#2b4c9b", shoe: "#f5c400", skin: "#a06a44" } },
  { id: "chidi", name: "Chidi", skill: "Veteran", blurb: "An experienced seller. Gets a good price.",
    price: 9500, perMin: 420, look: { hat: "fila", shirt: "#f5c400", trouser: "#8b6b3e", shoe: "#2a2118", skin: "#5a3a22" } },
  { id: "bisi", name: "Mama Bisi", skill: "Boss", blurb: "Top tier seller with the best prices.",
    price: 22000, perMin: 900, look: { hat: "bucket", shirt: "#e8412c", trouser: "#2a2118", shoe: "#ffffff", skin: "#8a5a3c" } },
];
export const sellerById = (id: string) => SELLERS.find((s) => s.id === id);

/** Sellers go home after this long without you collecting. */
export const MAX_AWAY_MIN = 180;

export function pendingFor(h: HiredSeller, now: number): number {
  const def = sellerById(h.id); if (!def) return 0;
  const mins = Math.min(MAX_AWAY_MIN, Math.max(0, (now - h.since) / 60000));
  return Math.floor(def.perMin * mins);
}
export const pendingTotal = (hs: HiredSeller[], now: number) => hs.reduce((a, h) => a + pendingFor(h, now), 0);
