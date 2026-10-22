"use client";
import { useEffect, useMemo, useState } from "react";
import SellersCanvas from "@/components/SellersCanvas";
import { naira } from "@/game/engine/items";
import { MAX_AWAY_MIN, SELLERS, pendingFor, pendingTotal } from "@/game/sellers";
import { defaultSave, loadSave, writeSave, type SaveData } from "@/lib/storage";

export default function SellersBase() {
  const [save, setSave] = useState<SaveData>(defaultSave);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { setSave(loadSave()); setReady(true); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const ids = useMemo(() => save.sellers.map((s) => s.id), [save.sellers]);
  const waiting = pendingTotal(save.sellers, now);

  const commit = (next: SaveData) => { writeSave(next); setSave(next); };
  const hire = (id: string) => {
    const def = SELLERS.find((s) => s.id === id);
    if (!def || save.money < def.price || save.sellers.some((s) => s.id === id)) return;
    commit({ ...save, money: save.money - def.price, sellers: [...save.sellers, { id, since: Date.now() }] });
  };
  const collect = () => {
    const t = Date.now(), amount = pendingTotal(save.sellers, t);
    if (amount <= 0) return;
    commit({ ...save, money: save.money + amount, sellers: save.sellers.map((s) => ({ ...s, since: t })) });
    setNow(t);
  };

  return (
    <>
      <SellersCanvas ids={ids} />
      <section className="panel" aria-label="Collect earnings">
        <div className="panel-head">
          <h2>Your sellers</h2>
          <p className="money">You have <strong>{ready ? naira(save.money) : "..."}</strong></p>
        </div>
        <p>
          Hired sellers work their own corner. They never come to your junction, so you
          can leave them and play. They stop after {MAX_AWAY_MIN / 60} hours, so come back and collect.
        </p>
        <div className="collect">
          <p className="waiting">Waiting for you: <strong>{naira(waiting)}</strong></p>
          <button className="btn" onClick={collect} disabled={waiting <= 0}>
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
                <button className="btn alt" onClick={() => hire(s.id)} disabled={!!owned || save.money < s.price}>
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
