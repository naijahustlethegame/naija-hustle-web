export type DiceEvent = { die: number; text: string; delta: number; good: boolean };

const BAD = [
  { text: "Landlord is knocking. Pay up.", delta: -120 },
  { text: "Checkpoint “settlement”.", delta: -90 },
  { text: "Wrong change given.", delta: -60 },
];
const MID = [{ text: "Quiet hour. Nothing happens.", delta: 0 }, { text: "Rain drizzle, traffic slows.", delta: 0 }];
const GOOD = [
  { text: "Customer tipped you!", delta: 100 },
  { text: "Found ₦200 near the stall.", delta: 200 },
  { text: "Light came back, sales up!", delta: 80 },
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** 1-2 bad, 3-4 neutral, 5-6 good. */
export function rollDice(): DiceEvent {
  const die = 1 + Math.floor(Math.random() * 6);
  const pool = die <= 2 ? BAD : die <= 4 ? MID : GOOD;
  return { die, good: die >= 5, ...pick(pool) };
}
