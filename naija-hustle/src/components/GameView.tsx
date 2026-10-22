"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadAvatar } from "@/lib/storage";
import { api, loadPlayer } from "@/lib/api";
import { Sync } from "@/lib/sync";

import { CAPACITY, CORE_ITEMS, ITEMS, ITEM_IDS, countStock, naira } from "@/game/engine/items";
import { JUNCTION_LIST } from "@/game/engine/junctions";
import { feeRange, marketsFor } from "@/game/engine/markets";
import type { JunctionScene, Snapshot } from "@/game/scenes/JunctionScene";

/**
 * The street. With `demo` a bot plays it on the homepage. Otherwise the light cycles by itself:
 * pick a junction, restock, press Play and you walk on at whatever light is showing.
 */
export default function GameView({ demo = false }: { demo?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<JunctionScene | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);

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

  return (
    <>
      <div className="frame">
        <canvas ref={ref} aria-label={demo ? "Live gameplay: a hawker working a red light" : "Naija Hustle street"} />
      </div>
      {failed && <p className="why" role="alert">Could not reach the server. Refresh to try again.</p>}
      {!demo && <p className="rotate-hint">Turn your phone sideways for a bigger street.</p>}
      {!demo && scene && snap && <Controls scene={scene} snap={snap} />}
    </>
  );
}

function Controls({ scene, snap }: { scene: JunctionScene; snap: Snapshot }) {
  if (snap.playing) {
    return (
      <section className="panel" aria-label="On the road">
        <div className="panel-head">
          <h2>On the road</h2>
          <p className="money">You have <strong>{naira(snap.money)}</strong></p>
        </div>
        <p className="tray" aria-live="polite">
          <strong>On your tray: {snap.carrying}</strong>
          {ITEM_IDS.map((id) => (
            <span key={id} className={snap.stock[id] === 0 ? "gone" : ""}>
              <span aria-hidden>{ITEMS[id].icon}</span> {snap.stock[id]}<span className="sr"> {ITEMS[id].name}</span>
            </span>
          ))}
        </p>
        {snap.outOfStock && <p className="why" role="status">Your tray is empty. Leave the road and load more from home.</p>}
        <p className="hint">
          The light never stops, so sell while it is red. Tap a stopped car to run to it. A hand out, or a bubble
          above the car, means a chance. Tap the pavement to run back before the light goes green.
        </p>
        <div className="btns">
          <button className="btn alt" onClick={() => scene.leave()}>Leave the junction</button>
        </div>
      </section>
    );
  }

  const athome = countStock(snap.storage);
  return (
    <section className="panel" aria-label="Get ready">
      <div className="panel-head">
        <h2>Pick a junction</h2>
        <p className="money">You have <strong>{naira(snap.money)}</strong></p>
      </div>
      <div className="picker" role="radiogroup" aria-label="Junction">
        {JUNCTION_LIST.map((j) => (
          <button key={j.id} role="radio" aria-checked={snap.junction === j.id} className="pick"
            onClick={() => scene.selectJunction(j.id)}>
            <strong>{j.name}</strong>
            <span>{j.blurb}</span>
            <span className="meta">Red light about {j.red} seconds</span>
            <span className="meta">Market runs: {naira(feeRange(j.id)[0])} to {naira(feeRange(j.id)[1])} to enter</span>
            <span className="meta mk">{marketsFor(j.id).map((m) => m.name).join(", ")}</span>
          </button>
        ))}
      </div>

      <div className="panel-head">
        <h2>Load your tray</h2>
        <p className="money">On your tray <strong>{snap.carrying}</strong> of {CAPACITY}</p>
      </div>
      <p className="note">
        Stock comes from the market, so choose what to carry from what you have at home.
        {athome === 0 && snap.carrying === 0 ? " You have nothing left. Run to the market to fill up." : ""}
      </p>
      <ul className="shop">
        {ITEM_IDS.filter((id) => CORE_ITEMS.includes(id) || snap.storage[id] + snap.stock[id] > 0).map((id) => (
          <li key={id}>
            <span className="icon" aria-hidden>{ITEMS[id].icon}</span>
            <span className="what"><strong>{ITEMS[id].name}</strong><small>At home: {snap.storage[id]}. Sells for about {naira(ITEMS[id].price)}</small></span>
            <span className="qty">
              <button className="opt" onClick={() => scene.unload(id)} disabled={snap.stock[id] === 0} aria-label={`Take ${ITEMS[id].name} off the tray`}>-</button>
              <output aria-label={`${ITEMS[id].name} on tray`}>{snap.stock[id]}</output>
              <button className="opt" onClick={() => scene.load(id)} disabled={snap.storage[id] === 0 || snap.carrying >= CAPACITY} aria-label={`Put ${ITEMS[id].name} on the tray`}>+</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="btns">
        <button className="btn" onClick={() => scene.play()} disabled={snap.carrying === 0}>
          {snap.carrying === 0 ? "Put something on your tray first" : "Play"}
        </button>
        <Link className="btn alt" href="/restock">Run to the market for stock</Link>
      </div>
    </section>
  );
}
