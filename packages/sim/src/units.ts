import { MOBILE_REPAIR_REACH, UNIT_STATS } from "./stats.ts";
import { clampX, clampY, mapSize } from "./mapSize.ts";
import type { Unit, UnitKind, World } from "./types.ts";

/** Largest unit radius. Pads grid queries that test against unit bodies. */
export const MAX_RADIUS = Math.max(...Object.values(UNIT_STATS).map((s) => s.radius));

/** Binary search: units are sorted by id. */
export function findUnit(world: World, id: number): Unit | undefined {
  const units = world.units;
  let lo = 0, hi = units.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const u = units[mid]!;
    if (u.id === id) return u;
    if (u.id < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/** New ids only grow, so push keeps `units` sorted. */
export function spawnUnit(world: World, owner: number, kind: UnitKind, x: number, y: number): Unit {
  const m = mapSize(world.terrain);
  const unit: Unit = {
    id: world.nextId++,
    owner,
    kind,
    x: clampX(m, x),
    y: clampY(m, y),
    facing: 0,
    hp: UNIT_STATS[kind].maxHp,
    mode: "mobile",
    modeTimer: 0,
    orders: [],
    cooldown: 0,
    queue: [],
    lastFired: 255,
    target: 0,
    aim: 0,
    elevation: 0,
    work: 0,
    arrived: 0,
    rally: null,
    quota: {},
  };
  world.units.push(unit);
  return unit;
}

export function removeUnitsOf(world: World, owner: number): void {
  world.units = world.units.filter((u) => u.owner !== owner);
}

/** Work per tick for factories, harvesters and engineers: full when mobile, siege rate when sieged, none in transition. */
export function workRateOf(u: Pick<Unit, "kind" | "mode">): number {
  const s = UNIT_STATS[u.kind];
  return u.mode === "mobile" ? s.workRate : u.mode === "sieged" ? s.siegeWorkRate : 0;
}

/** How far engineer `e` works: a short reach when mobile, `workRange` when sieged. */
export function workReachOf(e: Pick<Unit, "mode">): number {
  return e.mode === "sieged" ? UNIT_STATS.engineer.workRange : MOBILE_REPAIR_REACH;
}

/** Radar range by mode: `siegeRadar` when sieged, else `radar` (also while deploying or packing). Read by `detection.ts`. */
export function radarRange(u: Pick<Unit, "kind" | "mode">): number {
  const s = UNIT_STATS[u.kind];
  return u.mode === "sieged" ? s.siegeRadar : s.radar;
}

/** Jam radius by mode: `siegeJam` when sieged, else `jam` (also while deploying or packing). Read by `detection.ts`. */
export function jamRange(u: Pick<Unit, "kind" | "mode">): number {
  const s = UNIT_STATS[u.kind];
  return u.mode === "sieged" ? s.siegeJam : s.jam;
}
