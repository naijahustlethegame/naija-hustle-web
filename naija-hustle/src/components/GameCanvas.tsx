"use client";
import { useEffect, useRef } from "react";
import { loadAvatar } from "@/lib/storage";

export default function GameCanvas({ demo = false }: { demo?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    let stop = () => {};
    let dead = false;
    // Lazy-load the engine so the homepage JS stays small.
    import("@/game/scenes/StreetScene").then(({ StreetScene }) => {
      if (dead) return;
      const scene = new StreetScene(canvas, { demo, avatar: loadAvatar() });
      scene.start();
      const io = new IntersectionObserver(([e]) => (e.isIntersecting ? scene.resume() : scene.pause()));
      io.observe(canvas);
      stop = () => { io.disconnect(); scene.destroy(); };
    });
    return () => { dead = true; stop(); };
  }, [demo]);

  return <canvas ref={ref} aria-label={demo ? "Gameplay preview" : "Naija RPG game"} />;
}
