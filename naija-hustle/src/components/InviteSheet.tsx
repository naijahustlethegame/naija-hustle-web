"use client";
import { useEffect, useState } from "react";
import { api, getMe, type Invites } from "@/lib/api";
import { naira } from "@/game/engine/items";
import { JUNCTIONS } from "@/game/engine/junctions";
import type { JunctionScene } from "@/game/scenes/JunctionScene";

const PITCH = "Come hustle with me on Naija Hustle! Sell pure water at Lagos red lights, grab power-ups and block your rivals. Join with my link, we both start with a shield and get cash:";
const TAG = "PlayNaijaHustle";
const PROMO = "/images/promo.png";
type Src = "x" | "fb" | "wa" | "share" | "copy";

/** The invite sheet: your link, how to share it (X, Facebook, WhatsApp), your result card, and how each friend is doing. */
export default function InviteSheet({ onClose, scene }: { onClose: () => void; scene?: JunctionScene }) {
  const [inv, setInv] = useState<Invites | null>(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [useResult, setUseResult] = useState(true);
  const session = scene?.getSession();
  const hasResult = !!session && session.sales > 0;

  useEffect(() => {
    let dead = false;
    api.invites().then((i) => { if (!dead) setInv(i); }).catch(() => { if (!dead) setErr(true); });
    if (hasResult) getMe().then((m) => { if (!dead && m.rank) setRank(m.rank); }).catch(() => {});
    return () => { dead = true; };
  }, [hasResult]);

  /** The invite link. It carries your room, so a friend lands on your road, and where the click came from. */
  const link = (src: Src) => {
    if (!inv) return "";
    const u = new URL("/play", location.origin);
    u.searchParams.set("ref", inv.code);
    const s = scene?.getShareInfo();
    if (s?.room && s.id) { u.searchParams.set("r", s.room); u.searchParams.set("i", s.id); }
    u.searchParams.set("src", src);
    return u.toString();
  };
  const result = hasResult && useResult && session
    ? `Sold ${session.sales}, ${naira(session.earned)}${rank ? `, #${rank}` : ""} at ${JUNCTIONS[session.junction].name}.`
    : "";
  const text = [result, PITCH].filter(Boolean).join(" ");

  const copy = async () => {
    try { await navigator.clipboard.writeText(link("copy")); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the link is shown in the box to copy by hand */ }
  };
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const postX = () => open(`https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${result ? result + " " : ""}Come hustle with me on Naija Hustle! Grab power-ups, block your rivals. We both start with a shield:`, url: link("x"), hashtags: TAG })}`);
  const postFb = () => open(`https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: link("fb"), hashtag: "#" + TAG, quote: `${result ? result + " " : ""}Come hustle with me on Naija Hustle!` })}`);
  const postWa = () => open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link("wa")}`)}`);
  /** Phone share sheet, with the promo image attached when the phone allows it. */
  const more = async () => {
    const data: ShareData = { title: "Naija Hustle", text: `${text} #${TAG}`, url: link("share") };
    try {
      const blob = await (await fetch(PROMO)).blob();
      const file = new File([blob], "naija-hustle.png", { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
    } catch { /* no image: share the link alone */ }
    try { await navigator.share(data); } catch { /* closed */ }
  };

  return (
    <div className="sheet invite-sheet" role="dialog" aria-label="Invite friends">
      <div className="sheet-head"><h2>Invite friends</h2><button className="sheet-x" onClick={onClose} aria-label="Close">✕</button></div>
      {err && <p className="dock-why">Could not load your invite link. Close this and try again.</p>}
      {!inv && !err && <p>Getting your link...</p>}
      {inv && (
        <>
          <p className="invite-rule">
            You get <strong>{naira(inv.reward)}</strong> when a friend sells {inv.salesToQualify} items. They get <strong>{naira(inv.friendReward)}</strong> too. Up to {inv.maxPaid} friends. A friend who joins your road starts with a shield, and so do you.
          </p>
          {hasResult && (
            <label className="invite-result">
              <input type="checkbox" checked={useResult} onChange={(e) => setUseResult(e.target.checked)} />
              <span>Add my result: <strong>{`Sold ${session!.sales}, ${naira(session!.earned)}${rank ? `, #${rank}` : ""} at ${JUNCTIONS[session!.junction].name}`}</strong></span>
            </label>
          )}
          <div className="invite-link">
            <input readOnly value={link("copy")} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn alt" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <div className="sheet-foot start invite-share">
            <button className="btn" onClick={postX}>Post on X</button>
            <button className="btn" onClick={postFb}>Facebook</button>
            <button className="btn" onClick={postWa}>WhatsApp</button>
            {typeof navigator !== "undefined" && "share" in navigator && <button className="btn alt" onClick={more}>More...</button>}
          </div>
          <dl className="invite-stats">
            <div><dt>Joined</dt><dd>{inv.friends.length}</dd></div>
            <div><dt>Paid</dt><dd>{inv.paid}/{inv.maxPaid}</dd></div>
            <div><dt>Earned</dt><dd>{naira(inv.earned)}</dd></div>
          </dl>
          {inv.friends.length > 0 && (
            <ul className="invite-list">
              {inv.friends.map((f, i) => (
                <li key={i}>
                  <strong>{f.name}</strong>
                  <span className={f.done ? "ok" : ""}>{f.done ? (f.reward > 0 ? `Paid ${naira(f.reward)}` : "Joined (limit reached)") : `${f.sales}/${inv.salesToQualify} sales`}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}