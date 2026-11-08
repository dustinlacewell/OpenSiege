import { nextU32 } from "./rng.ts";
import { generateTerrain } from "./terrain.ts";
import { validateMapParams, validateMapSpec } from "./mapSize.ts";
import { placeFeatures } from "./features/place.ts";
import { placeFields } from "./world.ts";
import type { MapFeatureKind, MapParams, MapSize, MapSpec, World } from "./types.ts";

export const DEFAULT_MAP_PARAMS: MapParams = { width: 16000, height: 16000, cell: 125 };

/**
 * A map from the seed, as plain data. Pure. The rng runs in a fixed order: terrain seed, fields, features.
 * Throws if the params or the result are not valid.
 */
export function generateMap(seed: number, params: MapParams): MapSpec {
  const bad = validateMapParams(params);
  if (bad.length > 0) throw new Error(`generateMap: ${bad.join("; ")}`);
  const scratch: World = {
    tick: 0, rng: seed >>> 0, nextId: 1, players: [], units: [], fields: [], features: [], projectiles: [], blasts: [],
    terrain: { cols: 0, rows: 0, cell: params.cell, heights: [], seaLevel: 0 }, dug: [],
  };
  scratch.terrain = generateTerrain(nextU32(scratch), params);
  placeFields(scratch);
  placeFeatures(scratch);
  const spec = specOf(scratch, params);
  const errors = validateMapSpec(spec);
  if (errors.length > 0) throw new Error(`generateMap: ${errors.join("; ")}`);
  return spec;
}

/** Strip ids and hp from a generated scratch world. It holds map kinds only: no unit has died in it. */
function specOf(w: World, params: MapParams): MapSpec {
  return {
    width: params.width, height: params.height, cell: params.cell,
    heights: w.terrain.heights,
    rng: w.rng,
    fields: w.fields.map((f) => ({ x: f.x, y: f.y, radius: f.radius, amount: f.amount })),
    features: w.features.filter((f) => onMap(params, f.x, f.y)).map((f) => ({ kind: f.kind as MapFeatureKind, x: f.x, y: f.y, radius: f.radius, variant: f.variant })),
  };
}

/**
 * A forest near an edge reaches past it, so a few trees land off the map. They shaped the rest of the layout
 * (crowding, connectivity), so the generator places them and the spec drops them.
 */
function onMap(m: MapSize, x: number, y: number): boolean {
  return x >= 0 && x <= m.width && y >= 0 && y <= m.height;
}
