const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export type Row = { name: string; score: number };

export async function getTop(): Promise<Row[]> {
  const r = await fetch(`${API}/leaderboard`, { cache: "no-store" });
  if (!r.ok) throw new Error("fail");
  return (await r.json()).top;
}
export async function submitScore(name: string, score: number): Promise<Row[]> {
  const r = await fetch(`${API}/leaderboard`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, score }),
  });
  if (!r.ok) throw new Error("fail");
  return (await r.json()).top;
}
