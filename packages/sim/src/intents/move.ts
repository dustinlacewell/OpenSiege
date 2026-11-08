import { MAX_PATH_POINTS } from "../stats.ts";
import { toInt } from "../math.ts";
import { clampX, clampY, mapSize } from "../mapSize.ts";
import { assignSpots, type Spot } from "../formation.ts";
import { assignAlongPath, type PathPoint } from "../pathSpots.ts";
import { give, lastMove, moveOrder } from "../orders.ts";
import { isAnchored, startPacking } from "../siege.ts";
import type { MapSize, Unit } from "../types.ts";
import type { IntentHandler } from "./handler.ts";
import { ownUnits } from "./lookup.ts";

/**
 * Every unit takes the move. A replacing move packs an anchored unit up at once; a queued one packs when it comes up.
 * A factory that takes a move drops its rally point.
 * The units that take the order form one group. Spots spread around the click, or along
 * `path` when it has 2 or more points, from where each unit will start this leg: its last
 * queued move when `queue`, else where it stands. A malformed `path` drops the intent.
 * `attack` makes it an attack-move; it changes nothing here.
 */
export const move: IntentHandler<"move"> = (world, player, intent) => {
  const queue = intent.queue === true, attack = intent.attack === true;
  const x = toInt(intent.x), y = toInt(intent.y);
  const m = mapSize(world.terrain);
  const rawPath: unknown = intent.path;
  const path = rawPath === undefined ? [] : readPath(rawPath, m);
  if (x === null || y === null || path === null) return;
  const movers = ownUnits(world, player, intent.units);
  if (movers.length === 0) return;
  const group = world.nextId++;
  const from = movers.map((u) => legStart(u, queue));
  const spots = path.length >= 2 ? assignAlongPath(from, path, m) : assignSpots(from, clampX(m, x), clampY(m, y), m);
  for (const s of spots) {
    const u = s.unit;
    give(u, moveOrder(s.x, s.y, group, attack), queue);
    u.rally = null;
    if (!queue && isAnchored(u)) startPacking(u);
  }
};

/** Clamped integer points, at most MAX_PATH_POINTS. Not an array, too long, or a bad point gives null. */
function readPath(raw: unknown, m: MapSize): PathPoint[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PATH_POINTS) return null;
  const out: PathPoint[] = [];
  for (const p of raw as unknown[]) {
    if (typeof p !== "object" || p === null) return null;
    const x = toInt((p as Record<string, unknown>).x), y = toInt((p as Record<string, unknown>).y);
    if (x === null || y === null) return null;
    out.push({ x: clampX(m, x), y: clampY(m, y) });
  }
  return out;
}

function legStart(u: Unit, queue: boolean): Spot {
  const from = queue ? lastMove(u) : undefined;
  return from ? { unit: u, x: from.x, y: from.y } : { unit: u, x: u.x, y: u.y };
}
