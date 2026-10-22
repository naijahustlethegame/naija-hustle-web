"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_AVATAR, OPTIONS, drawAvatar, type AvatarConfig } from "@/game/avatar/avatar";
import { loadAvatar, saveAvatar } from "@/lib/storage";

const PARTS = ["hat", "shirt", "trouser", "shoe"] as const;
const LABEL = { hat: "Hat", shirt: "Shirt", trouser: "Trouser", shoe: "Shoes" };

export default function AvatarEditor() {
  const [a, setA] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => setA(loadAvatar()), []);
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    drawAvatar(ctx, c.width / 2, c.height - 20, a, 0, 3.4, false);
    saveAvatar(a);
  }, [a]);

  return (
    <div className="panel">
      <canvas ref={ref} width={240} height={280} style={{ display: "block", margin: "0 auto" }} aria-label="Avatar preview" />
      {PARTS.map((p) => (
        <div key={p}>
          <strong>{LABEL[p]}</strong>
          <div className="opts">
            {OPTIONS[p].map((v) => (
              <button key={v} className="opt" aria-pressed={a[p] === v} aria-label={`${LABEL[p]} ${v}`}
                onClick={() => setA({ ...a, [p]: v })}
                style={p !== "hat" ? { background: v } : undefined}>
                {p === "hat" ? v : "\u00A0\u00A0\u00A0"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
