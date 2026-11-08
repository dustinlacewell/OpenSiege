import { fieldUnder, type World } from "@mf/sim";

// Filters for the idle-selection keys. Pure: world in, own unit ids out.

/** Own engineers with no orders, and own factories with an empty build queue. */
export function idleBuilders(world: World, me: number): number[] {
  return world.units
    .filter((u) => u.owner === me && ((u.kind === "engineer" && u.orders.length === 0) || (u.kind === "factory" && u.queue.length === 0)))
    .map((u) => u.id);
}

/** Own harvesters with no orders, except those sieged inside a non-empty field: they are at work. */
export function idleHarvesters(world: World, me: number): number[] {
  return world.units
    .filter((u) => u.owner === me && u.kind === "harvester" && u.orders.length === 0)
    .filter((u) => !(u.mode === "sieged" && fieldUnder(world.fields, u)))
    .map((u) => u.id);
}
