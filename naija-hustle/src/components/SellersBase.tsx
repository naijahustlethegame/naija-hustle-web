"use client";
import { useEffect, useMemo, useState } from "react";
import SellersCanvas from "@/components/SellersCanvas";
import SoundToggle from "@/components/SoundToggle";
import { sfx } from "@/game/audio/sfx";
import { naira } from "@/game/engine/items";
import { MAX_AWAY_MIN, SELLERS, pendingFor, pendingTotal } from "@/game/sellers";
import { defaultSave, type SaveData } from "@/lib/storage";
import { api, loadPlayer } from "@/lib/api";

export default function SellersBase() {
  const [save, setSave] = useState<SaveData>(defaultSave);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { loadPlayer().then((s) => { setSave(s); setReady(true); setNow(Date.now()); }).catch(() => setErr("Could not reach the server. Refresh to try again.")); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const ids = useMemo(() => save.sellers.map((s) => s.id), [save.sellers]);
  const waiting = pendingTotal(save.sellers, now);

  /** Run a server action once at a time; on failure show a message and reload the real state. */
  const act = async (fn: () => Promise<void>) => {
    if (busy) return; setBusy(true); setErr("");
    try { await fn(); } catch { setErr("That did not go through."); try { setSave(await loadPlayer()); } catch {} }
    finally { setBusy(false); }
  };
  const hire = (id: string) => {
    const def = SELLERS.find((s) => s.id === id);
    if (!def || save.money < def.price || save.sellers.some((s) => s.id === id)) return;
    void act(async () => { const r = await api.hire(id); setSave((s) => ({ ...s, money: r.money, sellers: [...s.sellers, { id, since: Date.now() }] })); sfx.fanfare(); });
  };
  const collect = () => {
    if (waiting <= 0) return;
    void act(async () => { const r = await api.collect(), t = Date.now(); setSave((s) => ({ ...s, money: r.money, sellers: s.sellers.map((h) => ({ ...h, since: t })) })); setNow(t); sfx.cashier(1); setTimeout(() => sfx.coin(), 250); setTimeout(() => sfx.coin(), 400); });
  };

  return (
    <>
      <SellersCanvas ids={ids} sound />
      <SoundToggle />
      <section className="panel" aria-label="Collect earnings">
        <div className="panel-head">
          <h2>Your sellers</h2>
          <p className="money">You have <strong>{ready ? naira(save.money) : "..."}</strong></p>
        </div>
        <p>
          Your sellers sell for you while you play. They stop after {MAX_AWAY_MIN / 60} hours,
          so come back and collect your money.
        </p>
        {err && <p className="why" role="alert">{err}</p>}
        <div className="collect">
          <p className="waiting">Waiting for you: <strong>{naira(waiting)}</strong></p>
          <button className="btn" onClick={collect} disabled={busy || waiting <= 0}>
            {waiting > 0 ? `Collect ${naira(waiting)}` : "Nothing to collect yet"}
          </button>
        </div>
      </section>

      <section className="panel" aria-label="Hire sellers">
        <h2>Hire a seller</h2>
        <ul className="roster">
          {SELLERS.map((s) => {
            const owned = save.sellers.find((h) => h.id === s.id);
            return (
              <li key={s.id}>
                <div className="who">
                  <strong>{s.name}</strong> <span className="skill">{s.skill}</span>
                  <small>{s.blurb}</small>
                  <small>Earns about {naira(s.perMin)} a minute{owned ? `, ${naira(pendingFor(owned, now))} so far` : ""}</small>
                </div>
                <button className="btn alt" onClick={() => hire(s.id)} disabled={busy || !!owned || save.money < s.price}>
                  {owned ? "Working" : `Hire for ${naira(s.price)}`}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}