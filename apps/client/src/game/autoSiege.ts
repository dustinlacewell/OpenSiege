import { TICK_MS, UNIT_STATS, type Intent, type Unit, type World } from "@mf/sim";

/** A mobile unit with no orders for this long gets a siege order: 15 seconds of sim time. */
export const IDLE_SIEGE_TICKS = 15_000 / TICK_MS;

/**
 * Local automation: sends a plain `siege` intent for own units that have idled long enough.
 * It lives on the client and only ever emits intents, so the sim stays the same on every peer.
 * The clock is sim ticks, so it stands still while the sim does.
 */
export class AutoSiege {
  private readonly idleSince = new Map<number, number>();

  /** `delayTicks` is read every frame, so a changed setting applies at once. */
  constructor(
    private readonly send: (intent: Intent) => void,
    private readonly delayTicks: () => number = () => IDLE_SIEGE_TICKS,
  ) {}

  /** Call once per frame. `active` is false for a spectator or a watcher: nothing goes out then. */
  update(world: World, me: number, active: boolean): void {
    if (!active) return this.idleSince.clear();
    const due = this.track(world, me);
    if (due.length > 0) this.send({ t: "siege", units: due, on: true, queue: false });
  }

  /** Records when each idle unit went idle, forgets the rest, and returns ids that reached the limit. */
  private track(world: World, me: number): number[] {
    const seen = new Set<number>();
    const due: number[] = [];
    const limit = this.delayTicks();
    for (const u of world.units) {
      if (!isIdle(u, me)) continue;
      seen.add(u.id);
      const since = this.idleSince.get(u.id);
      if (since === undefined) this.idleSince.set(u.id, world.tick);
      else if (world.tick - since >= limit) {
        due.push(u.id);
        this.idleSince.set(u.id, world.tick);
      }
    }
    for (const id of this.idleSince.keys()) if (!seen.has(id)) this.idleSince.delete(id);
    return due;
  }
}

function isIdle(u: Unit, me: number): boolean {
  return u.owner === me && u.mode === "mobile" && u.orders.length === 0 && UNIT_STATS[u.kind].siegeTicks > 0;
}
