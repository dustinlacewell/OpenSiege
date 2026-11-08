import type { Hurt, Loss } from "./hurt.ts";

/** Hurt and loss events that wait out the reaction delay. */
export interface Events {
  hurts: readonly Hurt[];
  losses: readonly Loss[];
}

export const NO_EVENTS: Events = { hurts: [], losses: [] };

/** Adds this think's events to the queue, then lets out those at least `delay` ticks old (`Knobs.reactionDelay`). */
export function releaseEvents(pending: Events, fresh: Events, tick: number, delay: number): { ready: Events; pending: Events } {
  const ripe = (e: { tick: number }): boolean => tick - e.tick >= delay;
  const hurts = [...pending.hurts, ...fresh.hurts];
  const losses = [...pending.losses, ...fresh.losses];
  return {
    ready: { hurts: hurts.filter(ripe), losses: losses.filter(ripe) },
    pending: { hurts: hurts.filter((e) => !ripe(e)), losses: losses.filter((e) => !ripe(e)) },
  };
}
