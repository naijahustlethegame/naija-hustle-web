"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMe, getTop, setName, type Me, type Row } from "@/lib/api";
import { naira } from "@/game/engine/items";

const COLORS = ["#e4382f", "#0e8f4e", "#2b6cb0", "#7a3fb0", "#d6540c", "#1f9fb0", "#b23a6f", "#5a7d1f"];
const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
// "Player0417" would be "PL" for everybody, so generated names show their last two digits instead.
const initials = (n: string) => (/^Player\d+$/.test(n) ? n.slice(-2) : (n.match(/[A-Za-z0-9]/g)?.slice(0, 2).join("") || "?").toUpperCase());
const PODIUM = [{ cls: "gold", label: "1st", crown: "👑" }, { cls: "silver", label: "2nd", crown: "" }, { cls: "bronze", label: "3rd", crown: "" }];

function Badge({ name, size = 40 }: { name: string; size?: number }) {
  return <span className="badge" style={{ background: hue(name), width: size, height: size, fontSize: size * 0.4 }} aria-hidden>{initials(name)}</span>;
}

/** Richest hustlers first. Ranked by money in hand: stock and unsaved prizes do not count. */
export default function Leaderboard() {
  const [top, setTop] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    // the list is public; "you" needs a session, so a failure there must not hide the list
    const [t, m] = await Promise.allSettled([getTop(), getMe()]);
    if (t.status === "fulfilled") { setTop(t.value); setErr(""); } else setErr("Could not load the leaderboard. Refresh to try again.");
    if (m.status === "fulfilled") setMe(m.value);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; setBusy(true); setErr("");
    try { await setName(draft); setEditing(false); await load(); }
    catch { setErr("That name did not work. Use at least 2 letters or numbers."); }
    finally { setBusy(false); }
  };

  // Equal money shares a place, like the server's rank.
  const ranked = useMemo(() => (top ?? []).map((r, i, a) => ({ ...r, place: a.findIndex((x) => x.money === r.money) + 1 })), [top]);
  const myIdx = me && me.name ? ranked.findIndex((r) => r.name === me.name && r.money === me.money) : -1;
  const above = myIdx > 0 ? ranked[myIdx - 1] : null;
  const gap = above && me ? above.money - me.money : 0;
  const best = ranked[0]?.money || 1;
  const podium = ranked.slice(0, 3), rest = ranked.slice(3);

  return (
    <section className="board" aria-label="Leaderboard">
      <header className="board-head">
        <h1>Leaderboard</h1>
        <p>The richest hustlers in the game.</p>
      </header>

      {err && <p className="why" role="alert">{err}</p>}

      {me && (
        <div className="you-card">
          <Badge name={me.name || "?"} size={56} />
          <div className="you-info">
            <span className="you-label">You</span>
            <strong className="you-name">{me.name}</strong>
            {above && gap > 0 && <small>{naira(gap)} to pass {above.name}</small>}
            {above && gap === 0 && <small>Level with {above.name}</small>}
            {myIdx === 0 && <small>You are on top. Hold it!</small>}
          </div>
          <div className="you-stats">
            <span className="you-rank">{me.rank ? `#${me.rank}` : "-"}</span>
            <span className="you-money">{naira(me.money)}</span>
          </div>
          <button className="link" onClick={() => { setDraft(me.name); setEditing((v) => !v); }}>{editing ? "Cancel" : "Change name"}</button>
          {editing && (
            <form className="namer" onSubmit={save}>
              <label htmlFor="hustler-name" className="sr">Your hustler name</label>
              <input id="hustler-name" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={16} placeholder="Your hustler name" autoComplete="off" autoFocus />
              <button className="btn" disabled={busy || draft.trim().length < 2}>Save</button>
            </form>
          )}
        </div>
      )}

      {top === null && !err && <p className="board-empty">Loading...</p>}
      {top && top.length === 0 && <p className="board-empty">Nobody is on the board yet. Go and make some money.</p>}

      {podium.length > 0 && (
        <ol className="podium" aria-label="Top three">
          {[1, 0, 2].filter((i) => podium[i]).map((i) => {
            const r = podium[i]!, p = PODIUM[i]!, mine = i === myIdx;
            return (
              <li key={i} className={`step ${p.cls}${mine ? " mine" : ""}`} aria-current={mine ? "true" : undefined}>
                <span className="crown" aria-hidden>{p.crown}</span>
                <Badge name={r.name} size={i === 0 ? 64 : 52} />
                <strong className="p-name">{r.name}{mine ? " (you)" : ""}</strong>
                <span className="p-cash">{naira(r.money)}</span>
                <span className="p-place">{p.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {rest.length > 0 && (
        <ol className="rank" start={4}>
          {rest.map((r, k) => {
            const mine = k + 3 === myIdx;
            return (
              <li key={k + 3} className={mine ? "me" : undefined} aria-current={mine ? "true" : undefined}>
                <span className="pos">{r.place}</span>
                <Badge name={r.name} />
                <span className="nm">
                  <span className="nm-top">{r.name}{mine ? " (you)" : ""}</span>
                  <span className="bar" aria-hidden><i style={{ width: `${Math.max(3, (r.money / best) * 100)}%` }} /></span>
                </span>
                <span className="cash">{naira(r.money)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {me?.rank && myIdx < 0 && top && top.length > 0 && (
        <p className="far">You are <strong>#{me.rank}</strong> with <strong>{naira(me.money)}</strong>. Keep hustling to reach the top {top.length}.</p>
      )}

      <div className="btns">
        <Link className="btn" href="/play">Go and make money</Link>
        <Link className="btn alt" href="/restock">Run to a market</Link>
      </div>
    </section>
  );
}
