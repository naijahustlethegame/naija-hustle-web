"use client";
import { useEffect, useRef } from "react";
import type { BaseScene } from "@/game/scenes/BaseScene";

/** The corner where hired sellers work on their own. `ids` are the sellers on shift. */
export default function SellersCanvas({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BaseScene | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    const canvas = ref.current!;
    let stop = () => {};
    let dead = false;
    Promise.all([import("@/game/scenes/BaseScene"), document.fonts.load("24px Anton").catch(() => [])]).then(([{ BaseScene }]) => {
      if (dead) return;
      const s = new BaseScene(canvas);
      sceneRef.current = s; s.setSellers(idsRef.current); s.start();
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.resume() : s.pause()));
      io.observe(canvas);
      stop = () => { io.disconnect(); s.destroy(); sceneRef.current = null; };
    });
    return () => { dead = true; stop(); };
  }, []);

  useEffect(() => { sceneRef.current?.setSellers(ids); }, [ids]);

  return (
    <div className="frame">
      <canvas ref={ref} aria-label="Your sellers working a red light on their own" />
    </div>
  );
}
