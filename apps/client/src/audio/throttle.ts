import type { Cue } from "./cues.ts";

/** Drops a cue that played too recently. `now` is seconds, from the caller's clock. */
export class Throttle {
  private readonly last = new Map<Cue, number>();
  private readonly gapOf: (cue: Cue) => number;

  /** `gapOf(cue)`: least seconds between two plays. Read on every call, so a live tuning change counts. 0 = never throttled. */
  constructor(gapOf: (cue: Cue) => number) {
    this.gapOf = gapOf;
  }

  allow(cue: Cue, now: number): boolean {
    const gap = this.gapOf(cue);
    if (gap <= 0) return true;
    const last = this.last.get(cue);
    if (last !== undefined && now - last < gap) return false;
    this.last.set(cue, now);
    return true;
  }
}
