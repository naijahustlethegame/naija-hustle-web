/** One dice roll at the start of every red light (seeded, so the whole junction shares it). 1-2 bad, 3-4 normal, 5-6 good. */
export type RoundEventKind = "normal" | "rain" | "lastma" | "sun" | "goslow";
export type RoundEvent = { die: number; kind: RoundEventKind; title: string; text: string; good: boolean };

import type { Rng } from "./rng";

const pick = <T,>(a: T[], rng: Rng) => a[Math.floor(rng() * a.length)];

const BAD: Omit<RoundEvent, "die">[] = [
  { kind: "lastma", title: "LASTMA!", text: "LASTMA takes 2 items from your tray.", good: false },
  { kind: "rain", title: "Rain dey fall", text: "Windows go up. Fewer buyers.", good: false },
];
const NORMAL: Omit<RoundEvent, "die">[] = [
  { kind: "normal", title: "Normal hustle", text: "A normal day. Start selling.", good: false },
];
const GOOD: Omit<RoundEvent, "die">[] = [
  { kind: "sun", title: "Hot sun", text: "Everybody wants water and cold drinks.", good: true },
  { kind: "goslow", title: "Go-slow", text: "Cars stuck even on green. Risk it!", good: true },
];
/** A hold-up: the light goes green but the cars stay put for a while. */
export const GOSLOW = GOOD[1]!;

export function rollRoundEvent(rng: Rng = Math.random): RoundEvent {
  const die = 1 + Math.floor(rng() * 6);
  const pool = die <= 2 ? BAD : die <= 4 ? NORMAL : GOOD;
  return { die, ...pick(pool, rng) };
}
