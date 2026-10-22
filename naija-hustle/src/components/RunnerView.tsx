"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAvatar, type Pot, type SaveData } from "@/lib/storage";
import { ApiError, api, loadPlayer, toPot } from "@/lib/api";
import { ITEMS, ITEM_IDS, STORAGE_CAP, countStock, emptyStock, naira } from "@/game/engine/items";
import { JUNCTIONS, type JunctionId } from "@/game/engine/junctions";
import { feeRange, fineFor, marketById, marketsFor, rollMarket, type Market } from "@/game/engine/markets";
import type { ItemId, Stock } from "@/game/engine/types";
import { LEVEL_NAME, MAX_LEVEL, type RunResult, type RunnerScene } from "@/game/scenes/RunnerScene";

type Summary = {
  market: Market; outcome: "finished" | "caught"; level: number; gained: Stock; cash: number; dropped: number;
  fine: number; lostItems: number; lostCash: number; stumbles: number;
};
/** `pot` is a win that has not been banked yet: bank it, or run again for more. */
type Ui = "ready" | "running" | "result" | "pot";

/**
 * Pay to run, dodge LASTMA, and carry stock back home. Where you run to depends on the junction you work:
 * each has its own markets, and the game picks one at random for a fresh run.
 *
 * Risk ladder: after a win you can bank everything, or run the same market again with rewards multiplied
 * (x2, x3, x4) on a faster, tougher road. Everything unbanked is lost if LASTMA catches you.
 */
export default function RunnerView() {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RunnerScene | null>(null);
  const applied = useRef(false);
  const runLevel = useRef(1);
  const [ready, setReady] = useState(false);
  const [ui, setUi] = useState<Ui>("ready");
  const [money, setMoney] = useState(0);
  const [carrying, setCarrying] = useState(0);
  const [sum, setSum] = useState<Summary | null>(null);
  const [notice, setNotice] = useState("");
  const [pot, setPot] = useState<Pot | null>(null);
  const [junction, setJunction] = useState<JunctionId>("ojuelegba");
  const [market, setMarket] = useState<Market | null>(null); // rolled after mount so server and browser agree

  const marketRef = useRef<Market | null>(null);
  marketRef.current = market;

  const [busy, setBusy] = useState(false);
  const saveRef = useRef<SaveData | null>(null);

  // Load the player from the server. A pot that was mid-run when the page closed counts as a catch.
  const refresh = useCallback(async () => {
    try {
      let s = await loadPlayer();
      let pm = s.pot ? marketById(s.pot.market) : undefined;
      if (s.pot && (s.pot.running || !pm)) {
        const lost = countStock(s.pot.items), lostCash = s.pot.cash;
        const f = await api.fail(), fine = Math.max(0, s.money - f.money);
        s = { ...s, money: f.money, pot: null }; pm = undefined;
        setNotice(`You left mid-run, so LASTMA caught you. You lost ${lost} ${lost === 1 ? "item" : "items"} and ${naira(lostCash)}${fine ? `, and paid a fine of ${naira(fine)}` : ""}.`);
      }
      saveRef.current = s;
      setMoney(s.money); setCarrying(countStock(s.storage)); setJunction(s.junction); setPot(s.pot);
      if (s.pot && pm) { setMarket(pm); setUi("pot"); }
      else setMarket((m) => (m && m.junction === s.junction ? m : rollMarket(s.junction)));
    } catch { setNotice("Could not reach the server. Refresh to try again."); }
  }, []);

  // Send the result of a run to the server. Done once per run; the server clamps it to what the market and run time allow.
  const finish = useCallback(async (r: RunResult) => {
    const mk = marketRef.current, s = saveRef.current;
    if (applied.current || !mk || !s) return; applied.current = true;
    const prev = s.pot;
    try {
      if (r.outcome === "finished") {
        const next = toPot((await api.finish(r.items, r.cash)).pot);
        saveRef.current = { ...s, pot: next };
        setPot(next);
        setSum({ market: mk, outcome: "finished", level: next.level, gained: r.items, cash: r.cash, dropped: r.dropped, fine: 0, lostItems: 0, lostCash: 0, stumbles: r.stumbles });
        setUi("pot");
      } else {
        const m = (await api.fail()).money, fine = Math.max(0, s.money - m), level = runLevel.current;
        const lostItems = countStock(r.items) + (prev ? countStock(prev.items) : 0), lostCash = r.cash + (prev?.cash ?? 0);
        saveRef.current = { ...s, money: m, pot: null };
        setMoney(m); setPot(null);
        setMarket(rollMarket(s.junction, mk.id)); // the next fresh run goes somewhere new
        setSum({ market: mk, outcome: "caught", level, gained: emptyStock(), cash: 0, dropped: 0, fine, lostItems, lostCash, stumbles: r.stumbles });
        setUi("result");
      }
    } catch { setNotice("Your run could not be saved. Reloading your game."); setUi("ready"); void refresh(); }
  }, [refresh]);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    void refresh();
    const canvas = ref.current!;
    let stop = () => {}; let dead = false;
    Promise.all([import("@/game/scenes/RunnerScene"), document.fonts.load("24px Anton").catch(() => [])]).then(([{ RunnerScene }]) => {
      if (dead) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const s = new RunnerScene(canvas, { avatar: loadAvatar(), market: marketRef.current ?? rollMarket("ojuelegba"), reducedMotion: reduced, onEnd: (r) => finishRef.current(r) });
      s.start(); sceneRef.current = s; setReady(true);
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.resume() : s.pause()));
      io.observe(canvas);
      stop = () => { io.disconnect(); s.destroy(); sceneRef.current = null; };
    });
    return () => { dead = true; stop(); };
  }, [refresh]);

  // keep the scene pointed at the market that has been rolled
  useEffect(() => { if (ready && market) sceneRef.current?.setMarket(market); }, [ready, market]);

  const minFee = feeRange(junction)[0], maxFee = feeRange(junction)[1];
  const space = STORAGE_CAP - carrying;
  const canRun = ready && !busy && !pot && money >= minFee && space > 0;

  const start = (level: number, room: number, mk: Market) => {
    const sc = sceneRef.current; if (!sc) return;
    marketRef.current = mk; sc.setMarket(mk);
    applied.current = false; runLevel.current = level; setSum(null); setNotice(""); setUi("running");
    sc.begin(room, level);
  };

  /** The server rolls the market and takes the fee up front, win or lose. */
  const run = async () => {
    const s = saveRef.current;
    if (!canRun || !s) return; setBusy(true);
    try {
      const r = await api.start(), mk = marketById(r.market)!;
      saveRef.current = { ...s, money: r.money, pot: null };
      setMoney(r.money); setMarket(mk);
      start(1, r.room, mk);
    } catch (e) {
      setNotice(e instanceof ApiError && e.status === 402 ? "You cannot afford the market the draw picked. Earn a bit more and try again." : "Could not start the run. Try again.");
      void refresh();
    } finally { setBusy(false); }
  };

  /** Run the same market again with bigger rewards. The server flags the pot as running, so closing the page does not dodge a catch. */
  const pushOn = async () => {
    const s = saveRef.current, p = s?.pot; if (!s || !p || busy || p.level >= MAX_LEVEL || !market) return; setBusy(true);
    try {
      const r = await api.push();
      saveRef.current = { ...s, pot: { ...p, running: true } };
      start(r.level, Math.max(0, STORAGE_CAP - countStock(s.storage) - countStock(p.items)), market);
    } catch { setNotice("Could not start that run. Try again."); void refresh(); }
    finally { setBusy(false); }
  };

  const bank = async () => {
    const s = saveRef.current, p = s?.pot; if (!s || !p || busy) return; setBusy(true);
    try {
      const b = await api.bank();
      const kept = countStock(b.storage) - countStock(s.storage), dropped = Math.max(0, countStock(p.items) - kept);
      saveRef.current = { ...s, money: b.money, storage: b.storage, pot: null };
      setMoney(b.money); setCarrying(countStock(b.storage)); setPot(null); setSum(null);
      setNotice(`Banked! ${naira(p.cash)} cash and ${kept} items are safe at home${dropped ? ` (${dropped} dropped, no space)` : ""}.`);
      setMarket(rollMarket(s.junction, p.market)); setUi("ready");
    } catch { setNotice("Could not bank that. Reloading your game."); void refresh(); }
    finally { setBusy(false); }
  };

  const why = !ready ? "Loading the street..." : space <= 0 ? "Your stock at home is full. Go and sell some first." : money < minFee ? `You need at least ${naira(minFee)} to run to a market.` : "";
  const potChips = (p: Pot) => ITEM_IDS.filter((id) => p.items[id] > 0).map((id) => <li key={id}><span aria-hidden>{ITEMS[id].icon}</span> {ITEMS[id].name} x{p.items[id]}</li>);

  return (
    <>
      <div className="frame runner">
        <canvas ref={ref} aria-label="Market run: dodge LASTMA and grab stock" />
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
            <h2>Run to a market</h2>
            <p className="money">You have <strong>{naira(money)}</strong></p>
          </div>
          {notice && <p className="banked" role="status">{notice}</p>}
          <p className="where">
            The game picks a market at random for <strong>{JUNCTIONS[junction].name}</strong> when you pay.
          </p>
          <ul className="rules">
            <li><strong>Entry:</strong> {naira(minFee)} to {naira(maxFee)} depending on the market, paid up front</li>
            <li><strong>Caught:</strong> fine of up to {naira(maxFee * 2)}, and you lose everything you have not banked</li>
            <li><strong>Made it:</strong> bank your winnings, or risk them to run again for x2, x3 and x4 rewards on a faster, tougher road</li>
            <li><strong>At home:</strong> {carrying} of {STORAGE_CAP} in stock</li>
          </ul>
          <p className="note">
            Markets near {JUNCTIONS[junction].name}:{" "}
            {marketsFor(junction).map((m) => `${m.name} (${naira(m.fee)})`).join(", ")}.
            Dearer markets stock better goods. Work a different junction to see other markets.
          </p>
          <div className="btns">
            <button className="btn" onClick={run} disabled={!canRun}>{ready ? "Pay entry and run" : "Loading"}</button>
            <Link className="btn alt" href="/play">Back to the junction</Link>
          </div>
          {why && <p className="why" role="status">{why}</p>}
        </section>
      )}

      {ui === "pot" && pot && market && (
        <section className="panel result finished" aria-label="Run result" aria-live="polite">
          <h2>{sum ? `You made it to ${market.name}!` : `Unbanked winnings from ${market.name}`}</h2>
          {notice && <p className="why" role="status">{notice}</p>}
          <p className="note">
            {pot.level > 1 ? <strong className="mult">x{pot.level} </strong> : null}
            At stake{pot.level > 1 ? ` after ${pot.level} runs in a row` : ""}:
          </p>
          <ul className="chips" aria-label="Unbanked winnings">
            {potChips(pot)}
            {pot.cash > 0 && <li>Cash {naira(pot.cash)}</li>}
            {countStock(pot.items) === 0 && pot.cash === 0 && <li>Nothing yet</li>}
          </ul>
          {sum && sum.dropped > 0 && <p>No space at home, so {sum.dropped} {sum.dropped === 1 ? "item was" : "items were"} dropped.</p>}
          {pot.level < MAX_LEVEL ? (
            <p className="risk">
              Run again for <strong>x{pot.level + 1} rewards</strong>: {LEVEL_NAME[pot.level + 1].toLowerCase()}. The road is faster, with more officers and tighter gaps.
              Get caught and you lose <strong>all of the above</strong> plus a {naira(fineFor(market))} fine.
            </p>
          ) : (
            <p className="risk">You cleared the top level. Time to bank it.</p>
          )}
          <div className="btns">
            <button className="btn" onClick={bank} disabled={busy}>Bank it</button>
            {pot.level < MAX_LEVEL && <button className="btn risky" onClick={pushOn} disabled={busy}>Risk it: x{pot.level + 1} run</button>}
          </div>
        </section>
      )}

      {ui === "result" && sum && (
        <section className="panel result caught" aria-label="Run result" aria-live="polite">
          <h2>LASTMA caught you</h2>
          <p>
            You paid a fine of <strong>{naira(sum.fine)}</strong>
            {sum.lostItems + sum.lostCash > 0 ? ` and lost ${sum.lostItems} ${sum.lostItems === 1 ? "item" : "items"}${sum.lostCash > 0 ? ` and ${naira(sum.lostCash)}` : ""}` : ""}.
            {sum.level > 1 ? ` That was a x${sum.level} run, so everything you had stacked up is gone.` : ""} Next time, dodge the officers and jump the low stuff.
          </p>
          <p className="totals">You have <strong>{naira(money)}</strong>. Stock at home: <strong>{carrying}</strong> of {STORAGE_CAP}.</p>
          <div className="btns">
            <button className="btn" onClick={() => { setUi("ready"); setSum(null); }}>Try another market</button>
            <Link className="btn alt" href="/play">Back to the junction</Link>
          </div>
        </section>
      )}
    </>
  );
}
