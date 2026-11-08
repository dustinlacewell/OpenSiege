// Small reads of the world that lesson steps share. Pure.
import { UNIT_STATS, buildGrid, detect, fieldUnder, mapSize, type Feature, type Intent, type Unit, type UnitKind, type World } from "@mf/sim";
import { unitById } from "../lookup.ts";
import type { CameraPose, Gesture, Zone } from "./types.ts";

type MoveIntent = Extract<Intent, { t: "move" }>;
interface Point { x: number; y: number }

/** The player's own living units of `kind`, in id order. */
export function ownOfKind(world: World, me: number, kind: UnitKind): Unit[] {
  return world.units.filter((u) => u.owner === me && u.kind === kind && u.hp > 0);
}

/** Ids of the player's own units of any of `kinds`. For focus lists. */
export function ownIds(world: World, me: number, ...kinds: UnitKind[]): number[] {
  return kinds.flatMap((k) => ownOfKind(world, me, k)).map((u) => u.id);
}

/** Ids of living units of `kind` that belong to anyone but the player. */
export function otherIds(world: World, me: number, kind: UnitKind): number[] {
  return world.units.filter((u) => u.owner !== me && u.kind === kind && u.hp > 0).map((u) => u.id);
}

/** True when the unit has no move order left: it has stopped where its last move put it. */
export function arrived(u: Pick<Unit, "orders">): boolean {
  return !u.orders.some((o) => o.type === "move");
}

export function inZone(u: Pick<Unit, "x" | "y">, z: Zone): boolean {
  return Math.hypot(u.x - z.x, u.y - z.y) <= z.radius;
}

/** True when every listed id is an own unit of one of `kinds`. An empty list is false. */
export function allOwnOf(world: World, me: number, ids: readonly number[], kinds: readonly UnitKind[]): boolean {
  return ids.length > 0 && ids.every((id) => {
    const u = unitById(world.units, id);
    return u !== undefined && u.owner === me && kinds.includes(u.kind);
  });
}

/** True when no listed id is an own factory. */
export function noFactory(world: World, me: number, ids: readonly number[]): boolean {
  return ids.every((id) => {
    const u = unitById(world.units, id);
    return !(u && u.owner === me && u.kind === "factory");
  });
}

export function isOwnOf(world: World, me: number, id: number, kind: UnitKind): boolean {
  const u = unitById(world.units, id);
  return u !== undefined && u.owner === me && u.kind === kind && u.hp > 0;
}

/** A unit that is sieged and sits on a field with crystal left. */
export function siegedOnField(world: World, u: Unit): boolean {
  return u.mode === "sieged" && fieldUnder(world.fields, u) !== undefined;
}

/** A selectable test: own units of these kinds. */
export function ownKinds(...kinds: UnitKind[]): (u: Unit, me: number) => boolean {
  return (u, me) => u.owner === me && kinds.includes(u.kind);
}

/** True when the move's target and every point of its path lie farther than `radius` from `p`. */
export function moveStaysAway(move: Pick<MoveIntent, "x" | "y" | "path">, p: Point, radius: number): boolean {
  return [move, ...(move.path ?? [])].every((q) => Math.hypot(q.x - p.x, q.y - p.y) > radius);
}

/** True when the unit `id` exists and lies farther than `radius` from `p`. */
export function unitStaysAway(world: World, id: number, p: Point, radius: number): boolean {
  const u = unitById(world.units, id);
  return u !== undefined && Math.hypot(u.x - p.x, u.y - p.y) > radius;
}

/** True when some sent move is a drag (a path of 2 or more points) that names an own unit of `kind`. */
export function sentDragWith(sent: readonly Intent[], world: World, me: number, kind: UnitKind): boolean {
  return sent.some((i) => i.t === "move" && (i.path?.length ?? 0) >= 2 && i.units.some((id) => isOwnOf(world, me, id, kind)));
}

/** The player's own sieged units of `kind` inside `z`. */
export function siegedInZone(world: World, me: number, kind: UnitKind, z: Zone): Unit[] {
  return ownOfKind(world, me, kind).filter((u) => u.mode === "sieged" && inZone(u, z));
}

/** The most-finished fraction (0 to 1) of any `kind` job in the player's factory queues. 0 with none queued. */
export function buildDone(world: World, me: number, kind: UnitKind): number {
  const jobs = ownOfKind(world, me, "factory").flatMap((f) => f.queue).filter((j) => j.kind === kind);
  return Math.max(0, ...jobs.map((j) => j.progress / UNIT_STATS[kind].buildTicks));
}

/** True when some own sieged engineer has an own factory within its sieged work range. */
export function engineerSiegedAtFactory(world: World, me: number): boolean {
  const reach = UNIT_STATS.engineer.workRange;
  return ownOfKind(world, me, "engineer").some((e) => e.mode === "sieged"
    && ownOfKind(world, me, "factory").some((f) => Math.hypot(f.x - e.x, f.y - e.y) <= reach));
}

/** Scrap with hp left whose centre lies within `radius` of `p`: what engineers can still reclaim there. */
export function scrapNear(world: World, p: Point, radius: number): Feature[] {
  return world.features.filter((f) => f.kind === "scrap" && f.hp > 0 && Math.hypot(f.x - p.x, f.y - p.y) <= radius);
}

/** Margin past the farthest wreck's centre, so the acted-out circle plainly holds it. World units. */
const CIRCLE_MARGIN = 60;

/**
 * An area reclaim drag over `scraps`: it presses on the wreck nearest their middle (a drag must start on scrap)
 * and ends past the wreck farthest from there. Null with none.
 */
export function reclaimDrag(scraps: readonly Feature[]): Gesture | null {
  if (scraps.length === 0) return null;
  const mx = scraps.reduce((s, f) => s + f.x, 0) / scraps.length, my = scraps.reduce((s, f) => s + f.y, 0) / scraps.length;
  const from = nearestTo(scraps, mx, my);
  const far = scraps.reduce((a, f) => (Math.hypot(f.x - from.x, f.y - from.y) > Math.hypot(a.x - from.x, a.y - from.y) ? f : a), from);
  const d = Math.hypot(far.x - from.x, far.y - from.y);
  const [ux, uy] = d > 0 ? [(far.x - from.x) / d, (far.y - from.y) / d] : [1, 0];
  const r = d + CIRCLE_MARGIN;
  return { shape: "circle", from: { x: from.x, y: from.y }, to: { x: from.x + ux * r, y: from.y + uy * r } };
}

function nearestTo(fs: readonly Feature[], x: number, y: number): Feature {
  return fs.reduce((a, f) => (Math.hypot(f.x - x, f.y - y) < Math.hypot(a.x - x, a.y - y) ? f : a));
}

/** How far the camera's ground point moved from `a` to `b`. World units. */
export function panned(a: CameraPose, b: CameraPose): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** How far the camera turned from `a` to `b`, the short way round. Radians, 0 to π. */
export function turned(a: CameraPose, b: CameraPose): number {
  const d = Math.abs(b.yaw - a.yaw) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
}

/** Ids of living units of `kind` that belong to anyone but the player and that the player's team detects (sight or radar). */
export function detectedOthers(world: World, me: number, kind: UnitKind): number[] {
  const seen = detect(world, buildGrid(world.units, mapSize(world.terrain)));
  return world.units.filter((u) => u.owner !== me && u.kind === kind && u.hp > 0 && seen.detects(me, u)).map((u) => u.id);
}
