"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SellersCanvas from "@/components/SellersCanvas";
import SoundToggle from "@/components/SoundToggle";
import { sfx } from "@/game/audio/sfx";
import { naira } from "@/game/engine/items";
import { MAX_AWAY_MIN, SELLERS, pendingFor, pendingTotal, type SellerDef } from "@/game/sellers";
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

  const crew = SELLERS.filter((s) => save.sellers.some((h) => h.id === s.id));
  const forHire = SELLERS.filter((s) => !save.sellers.some((h) => h.id === s.id));
  const perMin = crew.reduce((a, s) => a + s.perMin, 0);
  const oldest = save.sellers.reduce((a, h) => Math.min(a, h.since), now);
  const minsOn = Math.min(MAX_AWAY_MIN, Math.max(0, (now - oldest) / 60000));
  const full = crew.length > 0 && minsOn >= MAX_AWAY_MIN;
  const leftMin = Math.max(0, Math.ceil(MAX_AWAY_MIN - minsOn));
  const nextHire = forHire.find((s) => save.money >= s.price);
  const hrs = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

  const card = (s: SellerDef, owned: boolean) => {
    const h = save.sellers.find((x) => x.id === s.id);
    const got = h ? pendingFor(h, now) : 0;
    const short = s.price - save.money;
    const payback = Math.ceil(s.price / s.perMin);
    return (
      <li key={s.id} className={"hire-card" + (owned ? " owned" : "") + (!owned && nextHire?.id === s.id ? " best" : "")}>
        <span className="badge" style={{ background: s.look.shirt }} aria-hidden>{s.name.replace("Mama ", "").slice(0, 1)}</span>
        <div className="hire-main">
          <h3>{s.name} <span className="skill">{s.skill}</span></h3>
          <p className="hire-blurb">{s.blurb}</p>
          <dl className="hire-facts">
            <div><dt>Earns</dt><dd>{naira(s.perMin)}/min</dd></div>
            {owned ? <div><dt>Waiting</dt><dd>{naira(got)}</dd></div> : <div><dt>Pays for itself</dt><dd>~{hrs(payback)}</dd></div>}
          </dl>
        </div>
        {owned
          ? <span className="working">● Working</span>
          : <button className="btn" onClick={() => hire(s.id)} disabled={busy || short > 0}>{short > 0 ? `Need ${naira(short)} more` : `Hire for ${naira(s.price)}`}</button>}
      </li>
    );
  };

  return (
    <>
      <SellersCanvas ids={ids} sound />
      <SoundToggle />

      <section className="panel sellers-top" aria-label="Collect earnings">
        <dl className="sum">
          <div><dt>Your cash</dt><dd>{ready ? naira(save.money) : "..."}</dd></div>
          <div><dt>Crew earning</dt><dd>{crew.length ? `${naira(perMin)}/min` : "None yet"}</dd></div>
          <div className="wait"><dt>Waiting for you</dt><dd>{naira(waiting)}</dd></div>
        </dl>
        {crew.length > 0 && (
          <div className="shift" aria-label="Shift time left">
            <div className="shift-bar"><i style={{ width: `${(minsOn / MAX_AWAY_MIN) * 100}%` }} className={full ? "full" : ""} /></div>
            <p>{full ? "Your crew has gone home. Collect to send them back out." : `Crew works for ${hrs(leftMin)} more, then goes home. Collect any time to reset.`}</p>
          </div>
        )}
        {err && <p className="why" role="alert">{err}</p>}
        <div className="collect">
          <button className={"btn big" + (waiting > 0 ? " blink" : "")} onClick={collect} disabled={busy || waiting <= 0}>
            {waiting > 0 ? `Collect ${naira(waiting)}` : crew.length ? "Nothing to collect yet" : "Hire a seller to start earning"}
          </button>
          <Link className="btn alt" href="/play">Back to the street</Link>
        </div>
      </section>

      {crew.length > 0 && (
        <section className="panel" aria-label="Your crew">
          <div className="panel-head"><h2>Your crew</h2><p className="money">{crew.length} of {SELLERS.length} hired</p></div>
          <ul className="hire-grid">{crew.map((s) => card(s, true))}</ul>
        </section>
      )}

      {forHire.length > 0 && (
        <section className="panel" aria-label="Hire sellers">
          <div className="panel-head"><h2>{crew.length ? "Hire more" : "Hire your first seller"}</h2></div>
          <p className="note">Sellers work their own corner while you play, even when you are away. Hire once, and they earn every minute.</p>
          <ul className="hire-grid">{forHire.map((s) => card(s, false))}</ul>
        </section>
      )}
    </>
  );
}
