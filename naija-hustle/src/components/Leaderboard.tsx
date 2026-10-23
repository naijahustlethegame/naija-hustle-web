"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getMe, getTop, setName, type Me, type Row } from "@/lib/api";
import { naira } from "@/game/engine/items";

const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? String(i + 1);

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

  const named = !!me?.name;
  const inTop = named && !!top?.some((r) => r.name === me!.name && r.money === me!.money);
  const asking = me && (!named || editing);

  return (
    <section className="panel board" aria-label="Leaderboard">
      <div className="panel-head">
        <h2>Richest hustlers</h2>
        {me && <p className="money">You have <strong>{naira(me.money)}</strong></p>}
      </div>

      {err && <p className="why" role="alert">{err}</p>}

      {asking && (
        <form className="namer" onSubmit={save}>
          <label htmlFor="hustler-name">{named ? "Change your name" : "Pick a name to join the board"}</label>
          <div className="namer-row">
            <input id="hustler-name" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={16} placeholder="Your hustler name" autoComplete="off" />
            <button className="btn" disabled={busy || draft.trim().length < 2}>Save</button>
            {editing && <button type="button" className="btn alt" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}

      {named && !editing && me && (
        <p className="you">
          {me.rank ? <>You are <strong>#{me.rank}</strong> as <strong>{me.name}</strong>.</> : null}{" "}
          <button className="link" onClick={() => { setDraft(me.name); setEditing(true); }}>Change name</button>
        </p>
      )}

      {top === null && !err && <p>Loading...</p>}
      {top && top.length === 0 && <p>Nobody is on the board yet. Pick a name and be the first.</p>}

      {top && top.length > 0 && (
        <ol className="rank">
          {top.map((r, i) => {
            const mine = named && r.name === me!.name && r.money === me!.money;
            return (
              <li key={i} className={mine ? "me" : undefined} aria-current={mine ? "true" : undefined}>
                <span className="pos">{medal(i)}</span>
                <span className="nm">{r.name}{mine ? " (you)" : ""}</span>
                <span className="cash">{naira(r.money)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {named && me?.rank && !inTop && top && top.length > 0 && (
        <p className="you far">You are <strong>#{me.rank}</strong> with <strong>{naira(me.money)}</strong>. Keep hustling.</p>
      )}

      <div className="btns">
        <Link className="btn" href="/play">Go and make money</Link>
      </div>
    </section>
  );
}
