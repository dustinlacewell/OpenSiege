import { MAX_FIELDS } from "./stats.ts";
import { mapSize, scaledCount } from "./mapSize.ts";
import { dist2 } from "./math.ts";
import { randInt } from "./rng.ts";
import { roughness } from "./flatness.ts";
import { FEATURE_STATS } from "./features/featureStats.ts";
import { seaLevelOf } from "./terrain/water.ts";
import type { MapSpec, ResourceField, World } from "./types.ts";

export const FIELD_AMOUNT = 5000;
const FIELD_COUNT = 40;
const FIELD_SPACING = 1500;
const FIELD_TRIES = 4000;
const FIELD_RADIUS_MIN = 400;
const FIELD_RADIUS_MAX = 700;
const FIELD_ROUGH_MAX = 200;

/** A fresh world from a map spec: fields then features get ids 1..n in order. No players. */
export function createWorld(spec: MapSpec): World {
  const cols = spec.width / spec.cell + 1, rows = spec.height / spec.cell + 1;
  const world: World = {
    tick: 0, rng: spec.rng, nextId: 1, players: [], units: [], fields: [], features: [], projectiles: [], blasts: [],
    terrain: { cols, rows, cell: spec.cell, heights: spec.heights.slice(), seaLevel: seaLevelOf(spec.heights) },
    dug: new Array<number>(cols * rows).fill(0),
  };
  for (const f of spec.fields) world.fields.push({ id: world.nextId++, ...f });
  for (const f of spec.features) world.features.push({ id: world.nextId++, ...f, hp: FEATURE_STATS[f.kind].maxHp });
  return world;
}

/**
 * Rejection sampling: random flat spots, kept only if far enough from every field so far.
 * Count and tries scale with map area. `validateMapParams` keeps each side above twice FIELD_RADIUS_MAX.
 */
export function placeFields(world: World): void {
  const m = mapSize(world.terrain);
  const count = Math.min(MAX_FIELDS, Math.max(1, scaledCount(FIELD_COUNT, m)));
  const tries = scaledCount(FIELD_TRIES, m);
  for (let i = 0; i < tries && world.fields.length < count; i++) {
    const radius = randInt(world, FIELD_RADIUS_MIN, FIELD_RADIUS_MAX);
    const x = randInt(world, radius, m.width - radius);
    const y = randInt(world, radius, m.height - radius);
    if (tooClose(world.fields, x, y)) continue;
    if (roughness(world.terrain, x, y, radius) > FIELD_ROUGH_MAX) continue;
    world.fields.push({ id: world.nextId++, x, y, radius, amount: FIELD_AMOUNT });
  }
}

function tooClose(fields: readonly ResourceField[], x: number, y: number): boolean {
  const min2 = FIELD_SPACING * FIELD_SPACING;
  return fields.some((f) => dist2(f.x, f.y, x, y) < min2);
}
