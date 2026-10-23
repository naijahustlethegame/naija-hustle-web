"use client";
import { useState } from "react";
import { ApiError, api, loadPlayer } from "@/lib/api";
import { ITEMS, naira } from "@/game/engine/items";
import type { Junction } from "@/game/engine/junctions";
import { JUNCTION_ITEMS, junctionBlock, junctionUnlock, type Unlocks } from "@/game/engine/progression";
import type { SaveData } from "@/lib/storage";

/**
 * A junction you have not unlocked yet. The place is what you pay for: its stock comes with it,
 * so the card says what you will get. The server takes the money and opens the items in the same step.
 */
export default function LockedJunction({ junction: j, money, unlocks, beforeBuy, onBought }: {
  junction: Junction; money: number; unlocks: Unlocks;
  beforeBuy: () => Promise<void>;           // send pending sales first, so the server has your latest money
  onBought: (s: SaveData, j: Junction) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const price = junctionUnlock(j.id)?.price ?? 0;
  const block = junctionBlock(unlocks, j.id);
  const short = money < price;

  const buy = async () => {
    if (busy) return; setBusy(true); setMsg("");
    try {
      await beforeBuy(); await api.unlockJunction(j.id);
      onBought(await loadPlayer(), j);
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 402 ? "You do not have enough money yet." : e instanceof ApiError && e.status === 409 ? "Unlock the earlier junction first." : "That did not go through. Try again.");
      try { onBought(await loadPlayer(), j); } catch {}
      setBusy(false);
    }
  };

  return (
    <div className="pick locked" aria-label={`${j.name}, locked`}>
      <strong>🔒 {j.name}</strong>
      <span>{j.blurb}</span>
      <span className="meta">Red light: about {j.red} seconds</span>
      <span className="meta">
        Comes with: {JUNCTION_ITEMS[j.id].map((i) => `${ITEMS[i].icon} ${ITEMS[i].name}`).join(", ")}
      </span>
      {block && <span className="meta why">{block}</span>}
      <button className="btn alt" onClick={buy} disabled={busy || !!block || short}>
        {short && !block ? `Need ${naira(price - money)} more` : `Unlock for ${naira(price)}`}
      </button>
      {msg && <span className="meta why" role="status">{msg}</span>}
    </div>
  );
}
