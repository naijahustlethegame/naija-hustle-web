import type { Junction } from "./junctions";
import { hashString } from "./rng";

/** Seconds of green after the red (on average). The red length lives on each junction. */
export const GREEN_SECS = 12;
/** The last seconds of green, when the light turns amber and some cars rush to beat it. */
export const AMBER = 2.2;
/** The last seconds of the red, when the amber lamp flashes. */
export const WARN = 2.2;

export type LightPhase = "red" | "yellow" | "green";
export type LightClock = {
  cycle: number;       // which light this is. Same number for everybody at the junction.
  local: number;       // seconds since this cycle began
  phase: LightPhase;
  redLeft: number;     // seconds until the red ends (0 once green)
  toRed: number;       // seconds until the next red starts
  amber: boolean;      // the light has turned amber at the end of green
};

/** Every red is a different length (about 20% either way), so nobody can count it. Seeded, so the whole junction agrees. */
export const redFor = (j: Junction, cycle: number) => j.red * (0.8 + 0.4 * ((hashString(`${j.id}:${cycle}`) % 1000) / 1000));

export const cycleLength = (j: Junction) => j.red + GREEN_SECS;

/**
 * The light is a pure function of the wall clock, never of what a player does.
 * Everybody who opens the same junction sees the same colour at the same moment,
 * which is what lets many players share one road later on.
 */
export function lightAt(nowMs: number, j: Junction): LightClock {
  const C = cycleLength(j);
  const t = nowMs / 1000 + (hashString(j.id) % 997);
  const cycle = Math.floor(t / C);
  const local = t - cycle * C;
  const red = redFor(j, cycle);
  const phase: LightPhase = local < red - WARN ? "red" : local < red ? "yellow" : "green";
  return { cycle, local, phase, redLeft: Math.max(0, red - local), toRed: C - local, amber: local >= red && C - local <= AMBER };
}
