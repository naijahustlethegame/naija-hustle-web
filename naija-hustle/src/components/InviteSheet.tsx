"use client";
import { useEffect, useState } from "react";
import { api, type Invites } from "@/lib/api";
import { naira } from "@/game/engine/items";

const PITCH = "Come hustle with me on Naija Hustle! Sell pure water at Lagos red lights. Join with my link and we both get cash:";

/** The invite sheet: your link, how to share it, the reward rules, and how each friend is doing. */
export default function InviteSheet({ onClose }: { onClose: () => void }) {
  const [inv, setInv] = useState<Invites | null>(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dead = false;
    api.invites().then((i) => { if (!dead) setInv(i); }).catch(() => { if (!dead) setErr(true); });
    return () => { dead = true; };
  }, []);

  const link = inv ? `${location.origin}/play?ref=${inv.code}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the link is shown in the box to copy by hand */ }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Naija Hustle", text: PITCH, url: link }); return; } catch { /* closed or unsupported: fall through to WhatsApp */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${PITCH} ${link}`)}`, "_blank", "noopener");
  };

  return (
    <div className="sheet invite-sheet" role="dialog" aria-label="Invite friends">
      <div className="sheet-head"><h2>Invite friends</h2><button className="sheet-x" onClick={onClose} aria-label="Close">✕</button></div>
      {err && <p className="dock-why">Could not load your invite link. Close this and try again.</p>}
      {!inv && !err && <p>Getting your link...</p>}
      {inv && (
        <>
          <p className="invite-rule">
            You get <strong>{naira(inv.reward)}</strong> when a friend sells {inv.salesToQualify} items. They get <strong>{naira(inv.friendReward)}</strong> too. Up to {inv.maxPaid} friends.
          </p>
          <div className="invite-link">
            <input readOnly value={link} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn alt" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <div className="sheet-foot start"><button className="btn" onClick={share}>Share on WhatsApp</button></div>
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
