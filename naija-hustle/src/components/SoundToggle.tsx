"use client";
import { useSyncExternalStore } from "react";
import { sfx } from "@/game/audio/sfx";

/** Turns the game's sound on and off. The choice is remembered. */
export default function SoundToggle() {
  const on = useSyncExternalStore(sfx.subscribe, () => sfx.isOn(), () => false);
  return (
    <div className="sound-row">
      <button type="button" className="sound-btn" aria-pressed={on} onClick={() => sfx.toggle()}>
        <span aria-hidden>{on ? "🔊" : "🔇"}</span> {on ? "Sound on" : "Sound off"}
      </button>
    </div>
  );
}
