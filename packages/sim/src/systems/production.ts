import { UNIT_STATS } from "../stats.ts";
import { spawnUnit, workRateOf } from "../units.ts";
import { moveOrder } from "../orders.ts";
import { boostOf } from "../boost.ts";
import { spawnSpot } from "../nav/spawnSpot.ts";
import type { SimState } from "../simState.ts";
import type { Order, Unit } from "../types.ts";
import { fillQuotas } from "./quota.ts";

const EXIT_GAP = 20;

/**
 * Factories advance their head job; a finished job becomes a unit beside the factory.
 * The next id picks the first exit direction, so batches fan out. `spawnSpot` skips blocked cells and spots that overlap a unit.
 */
export function production(state: SimState): void {
  fillQuotas(state.world);
  const factories = state.world.units.filter((u) => u.kind === "factory" && u.queue.length > 0);
  for (const f of factories) advance(state, f);
}

function advance(state: SimState, f: Unit): void {
  const world = state.world;
  const job = f.queue[0]!;
  job.progress += workRateOf(f) + boostOf(world, f);
  if (job.progress < UNIT_STATS[job.kind].buildTicks) return;
  f.queue.shift();
  const radius = UNIT_STATS[job.kind].radius;
  const reach = UNIT_STATS[f.kind].radius + radius + EXIT_GAP;
  const bodies = world.units.map((o) => ({ x: o.x, y: o.y, radius: UNIT_STATS[o.kind].radius }));
  const exit = spawnSpot(state.nav.shape, state.nav.grids[UNIT_STATS[job.kind].moveClass], f, reach, radius, world.nextId, bodies);
  const u = spawnUnit(world, f.owner, job.kind, exit.x, exit.y);
  u.orders = firstOrders(f, u);
}

/** Drive to the rally if set. Else guard the factory. A harvester with no rally stays idle, so the idle-harvester key finds it. */
function firstOrders(f: Unit, u: Unit): Order[] {
  if (f.rally) return [moveOrder(f.rally.x, f.rally.y, f.id, false)];
  if (u.kind === "harvester") return [];
  return [{ type: "guard", target: f.id, chase: false }];
}
