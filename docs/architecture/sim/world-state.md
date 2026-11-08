Source: packages/sim/src/types.ts, packages/sim/src/world.ts, packages/sim/src/mapSize.ts, packages/sim/src/codec.ts, packages/sim/src/index.ts

# World state

`World` is the whole game state. Plain data only.

```
World { tick, rng, nextId, players[], units[], fields[], features[], projectiles[], terrain }
```

- `tick`: ticks stepped so far. `step()` increments it last.
- `rng`: mulberry32 state (uint32). Only the sim advances it.
- `nextId`: next id for any new unit, shell, field, feature, move group or build job.
- `players`: sorted by id. Players are never removed. A leaver stays with `connected: false`.
- `units`, `projectiles`, `features`: sorted by id.
- `fields`: `ResourceField[]` in creation order (ids ascending).
- `features`: rocks, boulders and trees. Features are removed when destroyed or crushed. See `sim/features/feature-stats.md`.
- `terrain`: `{ cols, rows, cell, heights }`. The map width and height derive from it. See `sim/terrain.md` and `sim/map-spec.md`.

## Player

`{ id, name, color, credits, alive, connected }`.

- `id` is the id the match host assigned. `color` is `id % 12`. The client palette has 12 colours (`client/game/palette.md`).
- `alive` is false after elimination. `connected` is false after `leave`.
- `credits` start at `START_CREDITS` (600). Building charges at enqueue.

## ResourceField

`{ id, x, y, radius, amount }`. A harvester inside `radius` takes credits from `amount`. `FIELD_AMOUNT` (5000) is the full value. See `sim/systems/economy.md`.

## Feature

`{ id, kind, x, y, radius, hp, variant }`. Rules per kind: `FEATURE_STATS` (`sim/features/feature-stats.md`). Placement: `sim/features/placement.md`.

## Projectile

`{ id, owner, source, x, y, z, vx, vy, vz, damage, splash, ttl }`. `source` is the `UnitKind` that fired. Fixed point: `sim/coordinates.md`. Flight: `sim/systems/projectiles.md`.

## Public API

`packages/sim/src/index.ts` exports:

- all types (`export type *` from `types.ts`)
- everything in `stats.ts` (`UNIT_STATS`, `UNIT_KINDS`, `MAX_FIELDS`, `TICK_MS`, `ANGLE_STEPS`, `PROJ_FP`, `BUILDABLE`, `MAX_QUEUE`, ...)
- `FEATURE_STATS`, `FEATURE_KINDS`, `FeatureStats`
- the map helpers of `mapSize.ts`: `mapWidth`, `mapHeight`, `mapSize`, `clampX`, `clampY`, `mapDiagonal`, `mapCentre`, `spawnEdge`, `scaledCount`, `edgeMargin`, `validateMapSpec`, `validateMapParams`, `MIN_MAP_SIDE` (`sim/map-spec.md`)
- `createWorld`, `generateMap`, `DEFAULT_MAP_PARAMS`, `FIELD_AMOUNT`, `step`, `createSimState`, `SimState`, `heightAt`, `generateTerrain`, `effectiveRange`, `weaponOf`, `workRateOf`, `radarRange`, `spreadAlong`, `angleDelta`, `hashWorld`, `encodeWorld`, `decodeWorld`

Anything else in the package is internal. To use it from an app, add it to `index.ts`.

## Message copy

`encodeWorld` is `JSON.stringify(world)`. `decodeWorld` is `JSON.parse`. It is used once per match, in `welcome` (`net/match-messages.md`). It is not a delta format.

## Add a state field

1. Add it to the interface in `types.ts`.
2. Set it where the object is created (`spawnUnit` in `units.ts`, `join` in `intents.ts`, `createWorld`).
3. Add it to the `hash*` function in `hash.ts`.
4. Use `null`, not `undefined`, for empty.
