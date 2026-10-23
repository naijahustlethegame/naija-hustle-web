import type { JunctionId } from "./junctions";
import { LANE_Y } from "./layout";
import { hashString } from "./rng";
import type { Kind } from "./types";

/**
 * Rough spots in the road. Where a car's lane crosses one it slows down and bumps over it, so some cars crawl past
 * even on a green light. The backdrop draws each hole dry; when it rains the weather layer fills them with water
 * and (on a dirt road) adds muddy puddles that are just as bad.
 */
export type Spot = { x: number; lane: number; rx: number; ry: number };

/** Ojuelegba is dirt and full of holes. Obalende is tar with a few bad patches. Lekki is smooth. */
const HOLES: Record<JunctionId, Spot[]> = {
  ojuelegba: [
    { x: 120, lane: 0, rx: 34, ry: 9 }, { x: 410, lane: 0, rx: 40, ry: 10 }, { x: 250, lane: 1, rx: 38, ry: 10 },
    { x: 560, lane: 1, rx: 32, ry: 9 }, { x: 905, lane: 1, rx: 30, ry: 8 }, { x: 150, lane: 2, rx: 36, ry: 10 },
    { x: 470, lane: 2, rx: 42, ry: 11 }, { x: 905, lane: 2, rx: 30, ry: 8 },
  ],
  obalende: [{ x: 300, lane: 1, rx: 22, ry: 6 }, { x: 600, lane: 2, rx: 24, ry: 7 }],
  lekki: [],
};
/** Only exist while it rains: standing water that collects on a dirt road. */
const PUDDLES: Record<JunctionId, Spot[]> = {
  ojuelegba: [
    { x: 300, lane: 0, rx: 62, ry: 12 }, { x: 690, lane: 0, rx: 54, ry: 11 }, { x: 60, lane: 1, rx: 46, ry: 10 },
    { x: 420, lane: 1, rx: 58, ry: 12 }, { x: 330, lane: 2, rx: 60, ry: 12 }, { x: 650, lane: 2, rx: 48, ry: 10 },
  ],
  obalende: [],
  lekki: [],
};

export const isDirt = (j: JunctionId) => j === "ojuelegba";
export const spotY = (lane: number) => LANE_Y[lane]! + 20;
export const holesOf = (j: JunctionId) => HOLES[j];
export const spotsFor = (j: JunctionId, raining: boolean) => (raining ? [...HOLES[j], ...PUDDLES[j]] : HOLES[j]);
/** Water makes a hole wider than it looks when dry. */
export const WET_GROW = 1.25;

/**
 * How a vehicle copes with the road at `x` in its lane: `k` scales its speed (1 = unhindered), `bump` is how far it
 * jolts upward over a hole, in pixels. Each driver copes differently (seeded by the vehicle id), and okadas pick
 * their way round better than cars and danfos do.
 */
export function roadEffect(j: JunctionId, raining: boolean, lane: number, x: number, id: number, kind: Kind) {
  let k = isDirt(j) ? (raining ? 0.8 : 0.92) : raining ? 0.93 : 1; // dirt is slower all over, and worse when wet
  let bump = 0;
  const spots = spotsFor(j, raining);
  if (!spots.length) return { k, bump };
  const driver = (hashString(String(id)) % 1000) / 1000;
  const worst = Math.max(0.18, 0.28 + 0.3 * driver + (kind === "okada" ? 0.22 : 0) - (raining ? 0.08 : 0));
  for (const s of spots) {
    if (s.lane !== lane) continue;
    const rx = s.rx * (raining ? WET_GROW : 1), zone = rx + 60, d = Math.abs(x - s.x);
    if (d >= zone) continue;
    k = Math.min(k, 1 - (1 - worst) * (1 - d / zone));
    if (d < rx) bump = Math.max(bump, 3 * (1 - d / rx));
  }
  return { k, bump };
}
