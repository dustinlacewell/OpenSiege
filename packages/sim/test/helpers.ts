import { createSimState, createWorld, generateMap, spawnUnit, type MapParams, type MapSpec, type SimState } from "../src/index.ts";

export const WIDE: MapParams = { width: 24000, height: 8000, cell: 125 };
export const TALL: MapParams = { width: 4000, height: 12000, cell: 50 };
export const TINY: MapParams = { width: 2000, height: 2000, cell: 125 };

const specs = new Map<string, MapSpec>();

/** Generated once per params and seed, shared by read-only tests. Never mutate the result. */
export function cachedSpec(seed: number, p: MapParams): MapSpec {
  const key = `${seed}:${p.width}x${p.height}@${p.cell}`;
  let s = specs.get(key);
  if (!s) specs.set(key, (s = generateMap(seed, p)));
  return s;
}

/** Seat player `id` on `team`. One factory far in the south-west corner keeps `elimination` from removing the player's units. */
export function seat(s: SimState, id: number, team: number): void {
  s.world.players.push({ id, name: `p${id}`, color: id, credits: 0, alive: true, connected: true, team });
  spawnUnit(s.world, id, "factory", 100 + id * 100, 1900);
}

/** A fresh sim state on a map, deep-copied from the cached spec so runs do not share arrays. */
export function freshState(seed: number, p: MapParams, edit?: (s: MapSpec) => void): SimState {
  const spec = structuredClone(cachedSpec(seed, p));
  edit?.(spec);
  return createSimState(createWorld(spec));
}
