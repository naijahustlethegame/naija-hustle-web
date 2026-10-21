"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAvatar, loadSave, writeSave } from "@/lib/storage";
import { ITEMS, ITEM_IDS, STORAGE_CAP, countStock, emptyStock, naira } from "@/game/engine/items";
import type { Stock } from "@/game/engine/types";
import type { RunResult, RunnerScene } from "@/game/scenes/RunnerScene";

const FEE = 150;   // pay to play
const FINE = 300;  // LASTMA fine when caught (or whatever you have left)

type Summary = {
  outcome: "finished" | "caught"; gained: Stock; dropped: number; cash: number; fine: number;
  lostItems: number; lostCash: number; stumbles: number; money: number; carrying: number;
};
type Ui = "ready" | "running" | "result";

/** Pay to run, dodge LASTMA, and carry stock back home. You pick what goes on your tray on the junction page. */
export default function RunnerView() {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RunnerScene | null>(null);
  const applied = useRef(false);
  const [ready, setReady] = useState(false);
  const [ui, setUi] = useState<Ui>("ready");
  const [money, setMoney] = useState(0);
  const [carrying, setCarrying] = useState(0);
  const [sum, setSum] = useState<Summary | null>(null);

  const refresh = useCallback(() => {
    const s = loadSave(); setMoney(s.money); setCarrying(countStock(s.storage));
  }, []);

  // Apply the result of a run to the save. Done once per run.
  const finish = useCallback((r: RunResult) => {
    if (applied.current) return; applied.current = true;
    const s = loadSave(), storage = { ...s.storage }; let m = s.money;
    const gained = emptyStock(); let dropped = r.dropped, fine = 0, cash = 0, lostItems = 0, lostCash = 0;
    const got = ITEM_IDS.reduce((a, id) => a + r.items[id], 0);
    if (r.outcome === "finished") {
      for (const id of ITEM_IDS) {
        const n = Math.min(r.items[id], Math.max(0, STORAGE_CAP - countStock(storage)));
        storage[id] += n; gained[id] = n; dropped += r.items[id] - n;
      }
      cash = r.cash; m += cash;
    } else {
      fine = Math.min(m, FINE); m -= fine; lostItems = got; lostCash = r.cash;
    }
    writeSave({ ...s, money: m, storage });
    setMoney(m); setCarrying(countStock(storage));
    setSum({ outcome: r.outcome, gained, dropped, cash, fine, lostItems, lostCash, stumbles: r.stumbles, money: m, carrying: countStock(storage) });
    setUi("result");
  }, []);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    refresh();
    const canvas = ref.current!;
    let stop = () => {}; let dead = false;
    Promise.all([import("@/game/scenes/RunnerScene"), document.fonts.load("24px Anton").catch(() => [])]).then(([{ RunnerScene }]) => {
      if (dead) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const s = new RunnerScene(canvas, { avatar: loadAvatar(), reducedMotion: reduced, onEnd: (r) => finishRef.current(r) });
      s.start(); sceneRef.current = s; setReady(true);
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.resume() : s.pause()));
      io.observe(canvas);
      stop = () => { io.disconnect(); s.destroy(); sceneRef.current = null; };
    });
    return () => { dead = true; stop(); };
  }, [refresh]);

  const space = STORAGE_CAP - carrying;
  const canRun = ready && money >= FEE && space > 0;

  const run = () => {
    const s = loadSave(), sc = sceneRef.current;
    if (!sc || s.money < FEE || countStock(s.storage) >= STORAGE_CAP) return;
    writeSave({ ...s, money: s.money - FEE }); // the fee is paid up front, win or lose
    applied.current = false; setMoney(s.money - FEE); setSum(null); setUi("running");
    sc.begin(STORAGE_CAP - countStock(s.storage));
  };

  const why = !ready ? "Loading the street..." : space <= 0 ? "Your stock at home is full. Go and sell some first." : money < FEE ? `You need ${naira(FEE)} to run.` : "";

  return (
    <>
      <div className="frame runner">
        <canvas ref={ref} aria-label="Balogun Market run: dodge LASTMA and grab stock" />
      </div>

      {ui === "running" && (
        <>
          <p className="hint">Left and right arrows (or swipe, or tap the sides) change lane. Up arrow, space, swipe up or tap the middle to jump.</p>
          <div className="pad" aria-label="Touch controls">
            <button className="opt" onClick={() => sceneRef.current?.moveLane(-1)} aria-label="Move left">◀</button>
            <button className="opt" onClick={() => sceneRef.current?.jump()}>Jump</button>
            <button className="opt" onClick={() => sceneRef.current?.moveLane(1)} aria-label="Move right">▶</button>
          </div>
        </>
      )}

      {ui === "ready" && (
        <section className="panel" aria-label="Start a run">
          <div className="panel-head">
            <h2>Run to Balogun Market</h2>
            <p className="money">You have <strong>{naira(money)}</strong></p>
          </div>
          <p>Stock is cheaper when you run for it. Pay the entry fee, dodge LASTMA, jump the potholes and grab what you can before the market gate. Get caught and you pay a fine and lose everything you picked up.</p>
          <ul className="rules">
            <li><strong>Entry:</strong> {naira(FEE)}, paid up front</li>
            <li><strong>Caught:</strong> fine of up to {naira(FINE)}, and you lose this run&apos;s stock and cash</li>
            <li><strong>Made it:</strong> keep the items and cash bundles</li>
            <li><strong>At home:</strong> {carrying} of {STORAGE_CAP} in stock</li>
          </ul>
          <div className="btns">
            <button className="btn" onClick={run} disabled={!canRun}>Pay {naira(FEE)} and run</button>
            <Link className="btn alt" href="/play">Back to the junction</Link>
          </div>
          {why && <p className="why" role="status">{why}</p>}
        </section>
      )}

      {ui === "result" && sum && (
        <section className={`panel result ${sum.outcome}`} aria-label="Run result" aria-live="polite">
          <h2>{sum.outcome === "finished" ? "You made it to Balogun Market!" : "LASTMA caught you"}</h2>
          {sum.outcome === "finished" ? (
            <>
              <ul className="chips">
                {ITEM_IDS.filter((id) => sum.gained[id] > 0).map((id) => <li key={id}><span aria-hidden>{ITEMS[id].icon}</span> {ITEMS[id].name} x{sum.gained[id]}</li>)}
                {sum.cash > 0 && <li>Cash {naira(sum.cash)}</li>}
                {ITEM_IDS.every((id) => sum.gained[id] === 0) && sum.cash === 0 && <li>Nothing this time</li>}
              </ul>
              {sum.dropped > 0 && <p>No space at home, so {sum.dropped} {sum.dropped === 1 ? "item was" : "items were"} dropped.</p>}
            </>
          ) : (
            <p>
              You paid a fine of <strong>{naira(sum.fine)}</strong>
              {sum.lostItems + sum.lostCash > 0 ? ` and lost ${sum.lostItems} ${sum.lostItems === 1 ? "item" : "items"}${sum.lostCash > 0 ? ` and ${naira(sum.lostCash)}` : ""}` : ""}.
              Next time, dodge the officers and jump the low stuff.
            </p>
          )}
          <p className="totals">You have <strong>{naira(sum.money)}</strong>. Stock at home: <strong>{sum.carrying}</strong> of {STORAGE_CAP}.</p>
          <div className="btns">
            <button className="btn" onClick={run} disabled={!canRun}>Run again for {naira(FEE)}</button>
            <Link className="btn alt" href="/play">Back to the junction</Link>
          </div>
          {why && <p className="why" role="status">{why}</p>}
        </section>
      )}
    </>
  );
}
