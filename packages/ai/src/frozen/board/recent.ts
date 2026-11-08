import type { Events } from "./delay.ts";

/** Released events stay this many ticks past their release, so the commander, which runs every 20 ticks, sees them. */
export const RECENT = 200;

/** The kept events plus the ones released this think, less those released more than `RECENT` ticks ago. */
export function keepRecent(kept: Events, released: Events, tick: number, delay: number): Events {
  const fresh = (e: { tick: number }): boolean => e.tick >= tick - RECENT - delay;
  return { hurts: [...kept.hurts, ...released.hurts].filter(fresh), losses: [...kept.losses, ...released.losses].filter(fresh) };
}
