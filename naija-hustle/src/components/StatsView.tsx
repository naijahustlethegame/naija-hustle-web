"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, getAdminStats, type AdminStats } from "@/lib/api";
import { naira } from "@/game/engine/items";

const KEY = "nh:adminkey";
const num = (n: number) => Math.round(n).toLocaleString("en-NG");
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "0%");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="tile"><span className="t-label">{label}</span><strong className="t-value">{value}</strong>{sub && <small>{sub}</small>}</div>;
}
function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="card"><h2>{title}</h2>{note && <p className="card-note">{note}</p>}{children}</section>;
}
/** Horizontal bars, scaled to the biggest value. */
function Bars({ rows, fmt = num }: { rows: { label: string; n: number }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="empty">Nothing yet.</p>;
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label}><span className="b-label">{r.label}</span><span className="b-track"><i style={{ width: `${(r.n / max) * 100}%` }} /></span><span className="b-n">{fmt(r.n)}</span></li>
      ))}
    </ul>
  );
}
function Spark({ rows }: { rows: { day: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="spark" role="img" aria-label="New players per day, last 14 days">
      {rows.map((r) => (
        <div key={r.day} className="s-col" title={`${r.day}: ${r.n}`}>
          <span className="s-n">{r.n || ""}</span>
          <i style={{ height: `${Math.max(3, (r.n / max) * 100)}%` }} />
          <span className="s-d">{r.day.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

/** Admin dashboard. The key is checked by the server on every request; it is kept for this tab only. */
export default function StatsView() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [d, setD] = useState<AdminStats | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(0);

  useEffect(() => { try { setKey(sessionStorage.getItem(KEY) ?? ""); } catch { setKey(""); } }, []);

  const load = useCallback(async (k: string) => {
    setBusy(true);
    try { setD(await getAdminStats(k)); setErr(""); setAt(Date.now()); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) { try { sessionStorage.removeItem(KEY); } catch {} setKey(""); setD(null); setErr("That key was not accepted."); }
      else setErr(e instanceof ApiError ? e.message : "Could not reach the server.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!key) return;
    void load(key);
    const id = setInterval(() => { if (!document.hidden) void load(key); }, 15_000);
    return () => clearInterval(id);
  }, [key, load]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const k = draft.trim(); if (!k) return;
    try { sessionStorage.setItem(KEY, k); } catch {}
    setDraft(""); setKey(k);
  };
  const lock = () => { try { sessionStorage.removeItem(KEY); } catch {} setKey(""); setD(null); };

  if (key === null) return null;
  if (!key) {
    return (
      <section className="stats">
        <h1>Stats</h1>
        <form className="gate" onSubmit={submit}>
          <label htmlFor="ak">Admin key</label>
          <input id="ak" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="btn">Open</button>
          {err && <p className="why" role="alert">{err}</p>}
        </form>
      </section>
    );
  }

  const p = d?.players;
  return (
    <section className="stats" aria-label="Game stats">
      <header className="stats-head">
        <h1>Stats</h1>
        <div className="stats-meta">
          <span>{d ? `Updated ${ago(new Date(at).toISOString())}` : busy ? "Loading…" : ""}</span>
          <button type="button" className="link" onClick={() => void load(key)} disabled={busy}>Refresh</button>
          <button type="button" className="link" onClick={lock}>Lock</button>
        </div>
      </header>
      {err && <p className="why" role="alert">{err}</p>}

      {d && p && (
        <>
          <div className="tiles">
            <Tile label="Online now" value={num(d.live.online)} sub={`${d.live.seated} playing, ${d.live.watching} watching`} />
            <Tile label="Players" value={num(p.total)} sub={`${p.new_24h} new today`} />
            <Tile label="Active 24h" value={num(p.active_24h)} sub={pct(p.active_24h, p.total) + " of players"} />
            <Tile label="Came back" value={pct(p.returned, p.total)} sub={`${p.returned} played on a later day`} />
            <Tile label="Money in game" value={naira(d.economy.total_money)} sub={`median ${naira(d.economy.median_money)}`} />
            <Tile label="Hired sellers" value={num(d.sellers.hired_total)} sub={`${naira(d.sellers.income_per_min)}/min passive`} />
          </div>

          <div className="grid">
            <Card title="Live" note="Rooms on this server right now.">
              {d.live.list.length === 0 ? <p className="empty">Nobody is on a road.</p> : (
                <table className="tbl"><thead><tr><th>Room</th><th>Junction</th><th>Seated</th><th>Watching</th></tr></thead>
                  <tbody>{d.live.list.map((r) => <tr key={r.id}><td>{r.id}</td><td>{cap(r.junction)}</td><td>{r.seated}/{d.live.cap}</td><td>{r.watching}</td></tr>)}</tbody></table>
              )}
            </Card>

            <Card title="Players" note="Active means their data changed in that window.">
              <Bars rows={[
                { label: "Active, last hour", n: p.active_1h }, { label: "Active, last 24h", n: p.active_24h },
                { label: "Active, last 7 days", n: p.active_7d }, { label: "New, last 7 days", n: p.new_7d }, { label: "All players", n: p.total },
              ]} />
              <h3>New players per day</h3>
              <Spark rows={d.signups_by_day} />
            </Card>

            <Card title="Economy">
              <div className="mini">
                <Tile label="Average" value={naira(d.economy.avg_money)} />
                <Tile label="Richest" value={naira(d.economy.max_money)} />
                <Tile label="Nearly broke" value={num(d.economy.broke)} sub="under ₦100" />
              </div>
              <h3>Players by money</h3>
              <Bars rows={d.wealth_buckets} />
              <h3>Spent on upgrades</h3>
              <Bars fmt={naira} rows={[{ label: "Sellers", n: d.spend.sellers }, { label: "Junctions", n: d.spend.junctions }]} />
            </Card>

            <Card title="Sellers">
              <div className="mini">
                <Tile label="Players with one" value={pct(d.sellers.players_with_any, p.total)} sub={`${d.sellers.players_with_any} players`} />
                <Tile label="Hired today" value={num(d.sellers.hired_24h)} />
                <Tile label="Total spent" value={naira(d.sellers.spent)} />
              </div>
              <table className="tbl"><thead><tr><th>Seller</th><th>Hired</th><th>Price</th><th>Earns/min</th></tr></thead>
                <tbody>{d.sellers.by_seller.map((s) => <tr key={s.seller}><td>{cap(s.seller)}</td><td>{s.n}</td><td>{naira(s.price)}</td><td>{naira(s.perMin)}</td></tr>)}</tbody></table>
            </Card>

            <Card title="Market runs">
              <div className="mini">
                <Tile label="Running now" value={num(d.runs.running)} sub={`avg level ${d.runs.avg_level}`} />
                <Tile label="Waiting to bank" value={num(d.runs.banked_waiting)} />
                <Tile label="Cash in pots" value={naira(d.runs.cash_in_pots)} />
              </div>
              <h3>By market</h3>
              <Bars rows={d.runs.by_market.map((m) => ({ label: cap(m.market), n: m.n }))} />
            </Card>

            <Card title="Progress">
              <h3>Where players are standing</h3>
              <Bars rows={d.by_junction.map((j) => ({ label: cap(j.junction), n: j.n }))} />
              <h3>Junctions unlocked</h3>
              <Bars rows={d.junction_unlocks.map((j) => ({ label: cap(j.junction), n: j.n }))} />
              <h3>Items unlocked</h3>
              <Bars rows={d.item_unlocks.map((i) => ({ label: cap(i.item), n: i.n }))} />
              <h3>Items held (tray + storage)</h3>
              <Bars rows={d.items_held.map((i) => ({ label: cap(i.item), n: i.n }))} />
            </Card>

            <Card title="Referrals">
              {d.referrals ? (
                <div className="mini">
                  <Tile label="Invited" value={num(d.referrals.total)} />
                  <Tile label="Qualified" value={num(d.referrals.qualified)} sub={pct(d.referrals.qualified, d.referrals.total)} />
                  <Tile label="Paid out" value={naira(d.referrals.paid_out)} />
                </div>
              ) : <p className="empty">The referrals table does not exist in this database yet.</p>}
            </Card>

            <Card title="Top players">
              <table className="tbl"><thead><tr><th>#</th><th>Name</th><th>Money</th><th>Junctions</th><th>Sellers</th><th>Last seen</th></tr></thead>
                <tbody>{d.top_players.map((t, i) => <tr key={t.player_no}><td>{i + 1}</td><td>{t.name} <small>#{t.player_no}</small></td><td>{naira(t.money)}</td><td>{t.junctions}</td><td>{t.sellers}</td><td>{ago(t.updated_at)}</td></tr>)}</tbody></table>
            </Card>

            <Card title="Latest activity" note="Most recent players to save progress.">
              <table className="tbl"><thead><tr><th>Player</th><th>Where</th><th>Money</th><th>When</th></tr></thead>
                <tbody>{d.recent_activity.map((a) => <tr key={a.player_no}><td>{a.name} <small>#{a.player_no}</small></td><td>{cap(a.junction)}</td><td>{naira(a.money)}</td><td>{ago(a.updated_at)}</td></tr>)}</tbody></table>
            </Card>

            <Card title="New signups">
              <table className="tbl"><thead><tr><th>Player</th><th>Where</th><th>Joined</th></tr></thead>
                <tbody>{d.recent_signups.map((a) => <tr key={a.player_no}><td>{a.name} <small>#{a.player_no}</small></td><td>{cap(a.junction)}</td><td>{ago(a.created_at)}</td></tr>)}</tbody></table>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
