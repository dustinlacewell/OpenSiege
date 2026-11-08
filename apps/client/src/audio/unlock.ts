import type { AudioEngine } from "./audioEngine.ts";

/** Browsers start audio only inside a user gesture. Unlocks the engine on the first click or key, then stops listening. */
export function unlockOnGesture(engine: AudioEngine): void {
  const events = ["pointerdown", "keydown"] as const;
  const onGesture = () => {
    engine.unlock();
    if (engine.running) for (const e of events) window.removeEventListener(e, onGesture, true);
  };
  for (const e of events) window.addEventListener(e, onGesture, true);
}
