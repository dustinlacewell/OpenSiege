Source: packages/sim/src/world.ts, packages/sim/src/generateMap.ts, packages/sim/src/mapSize.ts, packages/sim/src/features/place.ts, packages/sim/src/spawn.ts, packages/sim/src/rng.ts, packages/sim/src/flatness.ts

# World creation and spawning

## generateMap and createWorld

A world comes in two steps. `generateMap(seed, params)` makes a `MapSpec`. `createWorld(spec)` makes the world. See `sim/map-spec.md` for the spec, its validation and the parameters.

`generateMap` runs on a scratch world:

1. State starts with `rng = seed >>> 0`, `nextId = 1`, empty lists.
2. `generateTerrain(nextU32(world), params)` builds the height map (`sim/terrain.md`). This is the first rng draw.
3. `placeFields` runs next.
4. `placeFeatures` runs last: rocks, boulders and trees (`sim/features/placement.md`).
5. The ids and the hp are stripped. The final rng state becomes `spec.rng`.

`createWorld(spec)` copies the heights, sets `rng = spec.rng`, and gives fields then features ids `1..n` in order. It has no players.

The match host calls `generateMap` once per match, with a fresh seed (`client/app/local-host.md`).

## Resource fields

`placeFields` uses rejection sampling, up to `FIELD_TRIES` (4000) tries, until `FIELD_COUNT` (40) fields exist. Both numbers are for the default map. They scale with map area (`scaledCount`). The count is at least 1 and at most `MAX_FIELDS` (64).

- Radius: `randInt(400, 700)`. Position: random, kept so the whole field lies on the map (`radius` from every edge).
- Rejected if closer than `FIELD_SPACING` (1500) to an existing field.
- Rejected if `roughness(terrain, x, y, radius) > FIELD_ROUGH_MAX` (200).
- Each field takes an id from `nextId++` and starts with `FIELD_AMOUNT` (5000).

## roughness

`roughness(t, x, y, r)` is the spread of `heightAt` at the centre and four points at distance `r`. 0 is flat.

## Player spawn

`spawnPlayer(world, owner, at?)` runs on `join`. It spawns one `factory` at the chosen point and one `harvester` at `x + 200`.

When `at` is given (the `join` intent has `x`, `y`), the factory goes there. The point is rounded and clamped into `[edge, width - edge]` on `x` and `[edge, height - edge]` on `y`. `edge` is `spawnEdge(m)`: 1000, or an eighth of the short side if that is less. A value that is not finite becomes the map centre (`mapCentre`). No rng is used. The sim does not move the point off rough ground or features: `join` has no nav data, so the pick is used as is.

Without `at`, `pickSpawnPoint` makes `TRIES` (20) random points at least `spawnEdge(m)` (1000 on the default map) from the map border. A point clear of features (no feature circle within `SPAWN_CLEAR` 400) beats one that is not. Then a flat point (`roughness` at reach 300 is at most 120) beats a rough one. Among equals, the point farthest from any other player's unit wins.

## The rng

`rng.ts`: `nextU32(world)` is mulberry32 on `world.rng`. `randInt(world, lo, hi)` is `lo + nextU32 % (hi - lo + 1)`. Callers: `generateMap`, `placeFields`, `placeFeatures`, `pickSpawnPoint`. No system calls the rng during play. Only `join` does, and only without a chosen spot.

All joins of a match land in turn 1, in seat order. The rng state at each join depends on that order. The order is the same on all machines.
