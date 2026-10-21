"use client";
import { useEffect, useRef, useState } from "react";
import { bankPlayer, loadAvatar, loadSave } from "@/lib/storage";
import { CAPACITY, ITEMS, ITEM_IDS, naira } from "@/game/engine/items";
import { JUNCTION_LIST } from "@/game/engine/junctions";
import type { JunctionScene, Snapshot } from "@/game/scenes/JunctionScene";

/** The street. With `demo` it plays itself (homepage). Otherwise you play, with a shop and summary below. */
export default function GameView({ demo = false }: { demo?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<JunctionScene | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    let stop = () => {};
    let dead = false;
    // Lazy-load the engine so the page JS stays small.
    // Wait for the display font so the backdrop's painted signs are drawn with it.
    Promise.all([import("@/game/scenes/JunctionScene"), document.fonts.load("24px Anton").catch(() => [])]).then(([{ JunctionScene }]) => {
      if (dead) return;
      const save = demo ? null : loadSave();
      const s = new JunctionScene(canvas, {
        demo, avatar: loadAvatar(), money: save?.money, stock: save?.stock,
        onBank: demo ? undefined : bankPlayer,
      });
      s.start();
      setScene(s); setSnap(s.getSnapshot());
      const unsub = s.subscribe(() => setSnap(s.getSnapshot()));
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.resume() : s.pause()));
      io.observe(canvas);
      stop = () => { unsub(); io.disconnect(); s.destroy(); };
    });
    return () => { dead = true; stop(); };
  }, [demo]);

  return (
    <>
      <div className="frame">
        <canvas ref={ref} aria-label={demo ? "Live gameplay: a hawker working a red light" : "Naija Hustle street"} />
      </div>
      {!demo && <p className="rotate-hint">Turn your phone sideways for a bigger street.</p>}
      {!demo && scene && snap && <Controls scene={scene} snap={snap} />}
    </>
  );
}

function Controls({ scene, snap }: { scene: JunctionScene; snap: Snapshot }) {
  if (snap.phase === "red" || snap.phase === "yellow" || snap.phase === "green") {
    return (
      <p className="hint">
        Tap a stopped car to run to it. A hand out, or a bubble above the car, means a chance.
        Be off the road before the light goes green.
      </p>
    );
  }

  if (snap.phase === "summary" && snap.summary) {
    const s = snap.summary;
    return (
      <section className="panel" aria-label="Round summary">
        <h2>Light turned green at {s.junction}</h2>
        <p className="event">{s.event.title}: {s.event.text}</p>
        <dl className="stats">
          <div><dt>Earned</dt><dd className={s.earned < 0 ? "bad" : ""}>{naira(s.earned)}</dd></div>
          <div><dt>Sales</dt><dd>{s.sales}</dd></div>
          <div><dt>Turned you down</dt><dd>{s.rejects}</dd></div>
          <div><dt>Knocked down</dt><dd>{s.hits}</dd></div>
          <div><dt>Best streak</dt><dd>{s.bestStreak}</dd></div>
          <div><dt>Left on your tray</dt><dd>{s.itemsLeft}</dd></div>
        </dl>
        <div className="btns">
          <button className="btn" onClick={() => scene.startRound()} disabled={snap.carrying === 0}>
            {snap.carrying === 0 ? "Tray is empty" : "Wait for the next red"}
          </button>
          <button className="btn alt" onClick={() => scene.toPrep()}>Restock or change junction</button>
        </div>
      </section>
    );
  }

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
          </button>
        ))}
      </div>

      <div className="panel-head">
        <h2>Stock up at Mama Put</h2>
        <p className="money">Carrying <strong>{snap.carrying}</strong> of {CAPACITY}</p>
      </div>
      <ul className="shop">
        {ITEM_IDS.map((id) => (
          <li key={id}>
            <span className="icon" aria-hidden>{ITEMS[id].icon}</span>
            <span className="what"><strong>{ITEMS[id].name}</strong><small>Costs {naira(ITEMS[id].cost)}, sells for about {naira(ITEMS[id].price)}</small></span>
            <span className="qty">
              <button className="opt" onClick={() => scene.refund(id)} disabled={snap.stock[id] === 0} aria-label={`Put back ${ITEMS[id].name}`}>-</button>
              <output aria-label={`${ITEMS[id].name} on tray`}>{snap.stock[id]}</output>
              <button className="opt" onClick={() => scene.buy(id)} disabled={snap.money < ITEMS[id].cost || snap.carrying >= CAPACITY} aria-label={`Buy ${ITEMS[id].name}`}>+</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="btns">
        <button className="btn" onClick={() => scene.startRound()} disabled={snap.carrying === 0}>
          {snap.carrying === 0 ? "Buy something to sell first" : "Wait for the red light"}
        </button>
      </div>
    </section>
  );
}
