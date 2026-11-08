import { dist2 } from "./math.ts";
import { mapCentre, mapSize, spawnEdge } from "./mapSize.ts";
import { randInt } from "./rng.ts";
import { spawnUnit } from "./units.ts";
import { roughness } from "./flatness.ts";
import { isEnemy } from "./teams.ts";
import type { MapSize, World } from "./types.ts";

const TRIES = 20;
const SPAWN_REACH = 300;
const SPAWN_ROUGH_MAX = 120;
const SPAWN_CLEAR = 400;

/** Starting force for a player: one factory, one harvester beside it. */
export function spawnPlayer(world: World, owner: number, at?: { x: number; y: number }): void {
  const m = mapSize(world.terrain);
  const { x, y } = at ? clampSpot(m, at) : pickSpawnPoint(world, m, owner);
  spawnUnit(world, owner, "factory", x, y);
  spawnUnit(world, owner, "harvester", x + 200, y);
}

/** A chosen spot, forced into the map less `spawnEdge` on every side. A value that is not finite goes to the map centre. No rng. */
function clampSpot(m: MapSize, at: { x: number; y: number }): { x: number; y: number } {
  const edge = spawnEdge(m), c = mapCentre(m);
  return {
    x: Number.isFinite(at.x) ? Math.min(m.width - edge, Math.max(edge, Math.round(at.x))) : c.x,
    y: Number.isFinite(at.y) ? Math.min(m.height - edge, Math.max(edge, Math.round(at.y))) : c.y,
  };
}

/** Of TRIES random points, the one farthest from any enemy unit (teammates do not count). A point clear of features beats one that is not; then a flat one beats a rough one. */
function pickSpawnPoint(world: World, m: MapSize, owner: number): { x: number; y: number } {
  const edge = spawnEdge(m);
  let best = mapCentre(m);
  let bestTier = -1;
  let bestScore = -1;
  for (let i = 0; i < TRIES; i++) {
    const x = randInt(world, edge, m.width - edge);
    const y = randInt(world, edge, m.height - edge);
    const tier = (clearOfFeatures(world, x, y) ? 2 : 0) + (flatSpot(world, x, y) ? 1 : 0);
    const score = nearestRival2(world, owner, x, y);
    if (tier > bestTier || (tier === bestTier && score > bestScore)) {
      bestTier = tier;
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

/** The best tier `pickSpawnPoint` knows: clear of features and flat. For hosts that choose a spot ahead of time. */
export function goodSpawnSpot(world: Pick<World, "terrain" | "features">, x: number, y: number): boolean {
  return clearOfFeatures(world, x, y) && flatSpot(world, x, y);
}

function flatSpot(world: Pick<World, "terrain">, x: number, y: number): boolean {
  return roughness(world.terrain, x, y, SPAWN_REACH) <= SPAWN_ROUGH_MAX;
}

/** No feature within SPAWN_CLEAR of the point (edge to point), so the factory and harvester stand free. */
function clearOfFeatures(world: Pick<World, "features">, x: number, y: number): boolean {
  return !world.features.some((f) => dist2(f.x, f.y, x, y) < (f.radius + SPAWN_CLEAR) ** 2);
}

function nearestRival2(world: World, owner: number, x: number, y: number): number {
  let best = Number.MAX_SAFE_INTEGER;
  for (const u of world.units) {
    if (!isEnemy(world.players, owner, u.owner)) continue;
    const d = dist2(u.x, u.y, x, y);
    if (d < best) best = d;
  }
  return best;
}
