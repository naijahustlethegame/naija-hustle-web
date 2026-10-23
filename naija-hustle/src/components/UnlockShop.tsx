"use client";
import { useState } from "react";
import { ApiError, api, loadPlayer } from "@/lib/api";
import { naira } from "@/game/engine/items";
import { JUNCTIONS, type JunctionId } from "@/game/engine/junctions";
import { ITEMS } from "@/game/engine/items";
import { ITEM_PACKS, JUNCTION_UNLOCKS, hasJunction, junctionBlock, packBlock, packOwned, type ItemPack, type Unlocks } from "@/game/engine/progression";
import type { SaveData } from "@/lib/storage";

/**
 * Where you spend money to open up the rest of the game: better junctions and dearer stock.
 * Everything starts locked except Ojuelegba and the everyday stock. The server takes the money.
 */
export default function UnlockShop({ money, unlocks, beforeBuy, onBought }: {
  money: number; unlocks: Unlocks;
  beforeBuy?: () => Promise<void>;          // send pending sales first, so the server has your latest money
  onBought: (s: SaveData) => void;          // the player as the server now has them
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const buy = async (what: string, call: () => Promise<unknown>) => {
    if (busy) return; setBusy(true); setMsg("");
    try {
      await beforeBuy?.(); await call();
      onBought(await loadPlayer()); setMsg(`${what} unlocked!`);
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 402 ? "You do not have enough money yet." : e instanceof ApiError && e.status === 409 ? "Unlock the earlier one first." : "That did not go through. Try again.");
      try { onBought(await loadPlayer()); } catch {}
    } finally { setBusy(false); }
  };

  const junctions = JUNCTION_UNLOCKS.filter((j) => !hasJunction(unlocks, j.id));
  const packs = ITEM_PACKS.filter((p) => !packOwned(unlocks, p));
  if (junctions.length === 0 && packs.length === 0) return msg ? <p className="banked" role="status">{msg}</p> : null;

  const row = (key: string, title: string, blurb: string, price: number, block: string, run: () => void) => (
    <li key={key}>
      <span className="what"><strong>{title}</strong><small>{blurb}</small>{block && <small className="why">{block}</small>}</span>
      <button className="btn alt" onClick={run} disabled={busy || !!block || money < price}>
        {money < price && !block ? `Need ${naira(price - money)} more` : `Unlock for ${naira(price)}`}
      </button>
    </li>
  );

  return (
    <div className="unlocks" role="group" aria-label="Unlock more of the game">
      <h2>Unlock more</h2>
      <p className="note">You start with the first junction and the everyday stock. Pay once to open up the rest.</p>
      {msg && <p className="banked" role="status">{msg}</p>}
      <ul className="shop unlock-list">
        {junctions.map((j) => row(j.id, JUNCTIONS[j.id].name, JUNCTIONS[j.id].blurb, j.price, junctionBlock(unlocks, j.id), () => buy(JUNCTIONS[j.id].name, () => api.unlockJunction(j.id))))}
        {packs.map((p: ItemPack) => row(p.id, `${p.items.map((i) => ITEMS[i].icon).join(" ")} ${p.name}`, p.blurb, p.price, packBlock(unlocks, p), () => buy(p.name, () => api.unlockPack(p.id))))}
      </ul>
    </div>
  );
}

export type { JunctionId };
