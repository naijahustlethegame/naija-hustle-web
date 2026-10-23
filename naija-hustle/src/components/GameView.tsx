"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadAvatar } from "@/lib/storage";
import { api, loadPlayer } from "@/lib/api";
import { Sync } from "@/lib/sync";
import { JUNCTION_ITEMS, hasItem, hasJunction, junctionForItem, starterUnlocks, type Unlocks } from "@/game/engine/progression";
import type { HiredSeller, SaveData } from "@/lib/storage";
import { pendingTotal } from "@/game/sellers";
import LockedJunction from "./LockedJunction";
import InviteSheet from "./InviteSheet";

import { CAPACITY, CORE_ITEMS, ITEMS, ITEM_IDS, countStock, naira } from "@/game/engine/items";
import { JUNCTIONS, JUNCTION_LIST, type Junction } from "@/game/engine/junctions";
import { feeRange, marketsFor } from "@/game/engine/markets";
import type { JunctionScene, Snapshot } from "@/game/scenes/JunctionScene";
import SoundToggle from "./SoundToggle";
import "./game-dock.css";

/**
 * The street. With `demo` a bot plays it on the homepage. Otherwise the light cycles by itself:
 * pick a junction, restock, press Play and you walk on at whatever light is showing.
 */
export default function GameView({ demo = false }: { demo?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<JunctionScene | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [unlocks, setUnlocks] = useState<Unlocks>(starterUnlocks);
  const [sellers, setSellers] = useState<HiredSeller[]>([]);
  const syncRef = useRef<Sync | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    let stop = () => {};
    let dead = false;
    // Lazy-load the engine so the page JS stays small.
    // Wait for the display font so the backdrop's painted signs are drawn with it.
    Promise.all([import("@/game/scenes/JunctionScene"), document.fonts.load("24px Anton").catch(() => []), demo ? null : loadPlayer()]).then(([{ JunctionScene }, , save]) => {
      if (dead) return;
      let s!: InstanceType<typeof JunctionScene>;
      // The server owns money and stock. The scene queues changes here and they are sent in batches.
      const sync = demo ? undefined : new Sync(async () => { s.applyServer(await loadPlayer()); });
      syncRef.current = sync ?? null;
      if (save) { setUnlocks(save.unlocks); setSellers(save.sellers); }
      s = new JunctionScene(canvas, {
        demo, multi: true, avatar: loadAvatar(), money: save?.money, stock: save?.stock, storage: save?.storage, junction: save?.junction,
        sync, onJunction: demo ? undefined : (j) => { api.setJunction(j).catch(() => {}); },
      });
      s.start();
      setScene(s); setSnap(s.getSnapshot());
      const unsub = s.subscribe(() => setSnap(s.getSnapshot()));
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.resume() : s.pause()));
      io.observe(canvas);
      const hide = () => sync?.flush(true);
      window.addEventListener("pagehide", hide);
      stop = () => { unsub(); io.disconnect(); window.removeEventListener("pagehide", hide); s.destroy(); };
    }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; stop(); };
  }, [demo]);

  const body = (
    <>
      <div className="frame">
        <canvas ref={ref} aria-label={demo ? "Live gameplay: a hawker working a red light" : "Naija Hustle street"} />
      </div>
      <SoundToggle />
      {failed && <p className="why" role="alert">Could not reach the server. Refresh to try again.</p>}
      {!demo && <p className="rotate-hint">Turn your phone sideways for a bigger street.</p>}
      {!demo && scene && snap && <Controls scene={scene} snap={snap} unlocks={unlocks} sellers={sellers}
        beforeBuy={async () => { await syncRef.current?.flush(); }}
        onBought={(s: SaveData) => { setUnlocks(s.unlocks); setSellers(s.sellers); scene.applyServer(s); }} />}
    </>
  );
  // The homepage demo keeps its own layout. The real game gets .game, which the mobile layout in game-dock.css hangs on.
  return demo ? body : <div className="game">{body}</div>;
}

function Controls({ scene, snap, unlocks, sellers, beforeBuy, onBought }: { scene: JunctionScene; snap: Snapshot; unlocks: Unlocks; sellers: HiredSeller[]; beforeBuy: () => Promise<void>; onBought: (s: SaveData) => void }) {
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<null | "loc" | "tray" | "invite">(null);
  const [locOk, setLocOk] = useState(false); // has the player chosen a junction this visit?
  const [now, setNow] = useState(() => Date.now());
  const dock = useRef<HTMLDivElement>(null);

  // Sheets close on Escape, on a tap anywhere outside the dock, and once you walk onto the road.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!dock.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  useEffect(() => { if (snap.playing) setOpen(null); }, [snap.playing]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(t); }, []);

  // ---------- on the road: cash, tray, and the way out ----------
  if (snap.playing) {
    const shown = ITEM_IDS.filter((id) => CORE_ITEMS.includes(id) || snap.stock[id] > 0);
    return (
      <div className="dock" ref={dock} role="region" aria-label="On the road">
        <div className="dock-row road">
          <div className="dock-stat"><small>Cash</small><strong>{naira(snap.money)}</strong></div>
          <div className={"dock-stat" + (snap.outOfStock ? " empty" : "")} aria-live="polite"><small>On tray</small><strong>{snap.carrying}</strong></div>
          <ul className="dock-tray" aria-label="On your tray">
            {shown.map((id) => (
              <li key={id} className={snap.stock[id] === 0 ? "gone" : ""}>
                <span aria-hidden>{ITEMS[id].icon}</span> {snap.stock[id]}<span className="sr"> {ITEMS[id].name}</span>
              </li>
            ))}
          </ul>
          <button className="dock-btn leave" onClick={() => scene.leave()}><strong>Leave junction</strong></button>
        </div>
        {snap.outOfStock && <p className="dock-why" role="status">Tray empty. Leave the road and reload.</p>}
      </div>
    );
  }

  // ---------- getting ready: 1 location, 2 tray, 3 play ----------
  const athome = countStock(snap.storage);
  const next = !locOk ? 1 : snap.carrying === 0 ? 2 : 3;
  const ready = locOk && snap.carrying > 0;
  const waiting = pendingTotal(sellers, now);
  const toggle = (w: "loc" | "tray" | "invite") => setOpen((o) => (o === w ? null : w));

  // Spread the tray across items one at a time so it is a mixed load, not 14 sachets of water.
  const fill = () => {
    let added = true;
    while (added) {
      added = false;
      for (const id of ITEM_IDS) {
        const s = scene.getSnapshot();
        if (!hasItem(unlocks, id) || s.storage[id] <= 0 || s.carrying >= CAPACITY) continue;
        scene.load(id); added = true;
      }
    }
  };
  const clear = () => { for (const id of ITEM_IDS) { while (scene.getSnapshot().stock[id] > 0) scene.unload(id); } };

  return (
    <div className="dock" ref={dock} role="region" aria-label="Get ready">
      {open === "loc" && (
        <div className="sheet" role="dialog" aria-label="Choose your junction">
          <div className="sheet-head"><h2>Where are you selling?</h2><button className="sheet-x" onClick={() => setOpen(null)} aria-label="Close">✕</button></div>
          <div className="picker" role="radiogroup" aria-label="Junction">
            {JUNCTION_LIST.map((j) => !hasJunction(unlocks, j.id) ? (
              <LockedJunction key={j.id} junction={j} money={snap.money} unlocks={unlocks} beforeBuy={beforeBuy}
                onBought={(s: SaveData, jn: Junction) => {
                  onBought(s);
                  if (hasJunction(s.unlocks, jn.id)) setNotice(`${jn.name} unlocked! You can now stock ${JUNCTION_ITEMS[jn.id].map((i) => ITEMS[i].name).join(" and ")}.`);
                }} />
            ) : (
              <button key={j.id} role="radio" aria-checked={locOk && snap.junction === j.id} className="pick"
                onClick={() => { scene.selectJunction(j.id); setLocOk(true); setOpen(null); }}>
                <strong>{j.name}</strong>
                <span>{j.blurb}</span>
                <span className="meta">Red light: about {j.red} seconds</span>
                <span className="meta">Market entry: {naira(feeRange(j.id)[0])} to {naira(feeRange(j.id)[1])}</span>
                <span className="meta mk">{marketsFor(j.id).map((m) => m.name).join(", ")}</span>
              </button>
            ))}
          </div>
          {notice && <p className="banked" role="status">{notice}</p>}
        </div>
      )}

      {open === "tray" && (
        <div className="sheet tray-sheet" role="dialog" aria-label="Load your tray">
          <div className="sheet-head">
            <h2>Your tray <span className="cap">{snap.carrying}/{CAPACITY}</span></h2>
            <button className="sheet-x" onClick={() => setOpen(null)} aria-label="Close">✕</button>
          </div>
          {athome === 0 && snap.carrying === 0 && <p className="dock-why">Nothing at home. Run to the market for stock.</p>}
          <ul className="tray-grid">
            {ITEM_IDS.map((id) => !hasItem(unlocks, id) ? (
              <li key={id} className="tray-card locked" aria-label={`${ITEMS[id].name}, locked`}>
                <span className="big" aria-hidden>{ITEMS[id].icon}</span>
                <strong>{ITEMS[id].name}</strong>
                <small>🔒 Unlock {JUNCTIONS[junctionForItem(id)].name}</small>
              </li>
            ) : (
              <li key={id} className={"tray-card" + (snap.stock[id] > 0 ? " has" : "")}>
                <span className="big" aria-hidden>{ITEMS[id].icon}</span>
                <strong>{ITEMS[id].name}</strong>
                <small>Home: {snap.storage[id]} · sells ~{naira(ITEMS[id].price)}</small>
                <span className="qty">
                  <button className="step-btn" onClick={() => scene.unload(id)} disabled={snap.stock[id] === 0} aria-label={`Take ${ITEMS[id].name} off the tray`}>-</button>
                  <output aria-label={`${ITEMS[id].name} on tray`}>{snap.stock[id]}</output>
                  <button className="step-btn" onClick={() => scene.load(id)} disabled={snap.storage[id] === 0 || snap.carrying >= CAPACITY} aria-label={`Put ${ITEMS[id].name} on the tray`}>+</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="sheet-foot">
            <button className="btn alt" onClick={fill} disabled={athome === 0 || snap.carrying >= CAPACITY}>Fill it up</button>
            <button className="btn alt" onClick={clear} disabled={snap.carrying === 0}>Empty tray</button>
            <button className="btn" onClick={() => setOpen(null)}>Done</button>
          </div>
        </div>
      )}

      {open === "invite" && <InviteSheet onClose={() => setOpen(null)} />}

      {/* The main flow: 1 location, 2 tray, 3 play. */}
      <div className="dock-row">
        <button className={"dock-btn dock-where" + (locOk ? " done" : "") + (next === 1 ? " blink" : "")} onClick={() => toggle("loc")} aria-expanded={open === "loc"}>
          <small><span className="step">{locOk ? "✓" : "1"}</span> Location</small>
          <strong>{locOk ? `📍 ${JUNCTIONS[snap.junction].name}` : "Choose where to sell"}</strong>
        </button>

        <button className={"dock-btn dock-load" + (snap.carrying > 0 ? " done" : "") + (next === 2 ? " blink" : "")} onClick={() => toggle("tray")} aria-expanded={open === "tray"}>
          <small><span className="step">{snap.carrying > 0 ? "✓" : "2"}</span> Tray</small>
          <strong>{snap.carrying === 0 ? "🧺 Empty: fill it" : `🧺 ${snap.carrying}/${CAPACITY} loaded`}</strong>
          <span className="meter" aria-hidden><i style={{ width: `${(snap.carrying / CAPACITY) * 100}%` }} /></span>
        </button>

        <button className={"dock-btn dock-play" + (next === 3 ? " ready" : "")} onClick={() => scene.play()} disabled={!ready}>
          <small>{ready ? "3 · Go" : !locOk ? "Pick a location first" : "Load your tray first"}</small>
          <strong>▶ Play</strong>
        </button>

        {/* Side trips: three equal buttons in their own strip under the main flow. */}
        <div className="dock-tools" role="group" aria-label="More">
          <Link className={"dock-btn mini dock-market" + (athome === 0 && snap.carrying === 0 ? " blink" : "")} href="/restock">
            <span>🛒 Market</span>
            <small>Stock up</small>
          </Link>
          <Link className={"dock-btn mini dock-sellers" + (waiting > 0 ? " cash" : "")} href="/sellers">
            <span>👥 Sellers</span>
            <small>{sellers.length === 0 ? "Hire your first" : waiting > 0 ? `${naira(waiting)} waiting` : `${sellers.length} hired`}</small>
          </Link>
          <button className="dock-btn mini dock-invite" onClick={() => toggle("invite")} aria-expanded={open === "invite"}>
            <span>🎁 Invite</span>
            <small>Earn cash</small>
          </button>
        </div>
      </div>
    </div>
  );
}