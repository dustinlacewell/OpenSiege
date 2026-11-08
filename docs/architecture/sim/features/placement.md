Source: packages/sim/src/features/place.ts, packages/sim/src/features/connect.ts, packages/sim/src/mapSize.ts, packages/sim/src/generateMap.ts, packages/sim/src/spawn.ts

# Feature placement

`generateMap` calls `placeFeatures(world)` after `placeFields`, on a scratch world (`sim/map-spec.md`). It uses only the world rng and takes ids from `nextId++`, so features are sorted by id and every machine gets the same map. `createWorld` later gives the features new, gap-free ids.

## Order

The counts and try limits below are for the default map. They scale with map area (`scaledCount`, `sim/map-spec.md`).

1. Forests of trees. Up to `FOREST_COUNT` (60) spots, each tried at random. A spot needs height at most 560 and `roughness` at most 70 at reach 350. A forest has a random radius (350 to 800) and `FOREST_SPOTS` (200) random tree spots inside it. A tree spot may fall off the map. It is placed like any other, because it shapes the layout around it, and `generateMap` drops it from the spec, so every feature centre in a map lies on the map.
2. Rocks: `ROCK_COUNT` (90) over the whole map, on cells with grade 16 or more.
3. Boulders: `BOULDER_COUNT` (130) over the whole map, on any open cell.
4. `keepConnected` (below).

Radius ranges: tree 50 to 80, rock 100 to 190, boulder 55 to 90. Trees need a cell grade of 16 or less.

A spot is refused when:

- Its cell is blocked for the heavy class on the bare terrain (a cliff).
- It is within `radius + field radius + 100` of a resource field.
- It overlaps a placed feature by more than a quarter of their combined radii (`PACK_PCT` 75). A `FeatureIndex` of the features so far answers this.

The edge margin is 500, cut to an eighth of the short side on a small map (`edgeMargin`). It applies to forest centres and to rock and boulder spots. A tree in a forest near the edge may stand closer to it.

A refused spot still used the same rng draws, so the sequence does not depend on who refuses. Tries are capped (`FOREST_TRIES` 3000, `SCATTER_TRIES` 6000, scaled with area), so a kind may fall short of its count.

## keepConnected

Rocks and boulders can seal a valley. `keepConnected` (`connect.ts`) builds the nav from the placed features and from none. A cell is cut off when it is open, the bare terrain puts it in the biggest region of a class, and with features it is in another region. It removes every blocking feature within 3 cells of a cut-off cell, and repeats (at most 4 passes) until nothing is cut off. After it, the regions of both classes match the bare terrain: no feature closes ground that was open to the main map.

Removal leaves gaps in the id sequence. That is fine: ids only need to be unique and sorted.

## Spawn spots

Player spawns are chosen at `join`, after the map exists, so placement cannot avoid them. `pickSpawnPoint` avoids features instead. Its 20 random points rank by tier: clear of features (no feature within 400 of its edge) first, then flat. Within a tier the point farthest from other players wins.

## Counts

Measured on the default map over 8 seeds, after `keepConnected`: about 1270 trees, 78 rocks and 123 boulders. Generation takes about 10 to 20 ms.

Rocks and boulders raise the share of blocked cells: light by about 3 points, heavy by more (the class clearance radius widens every blocker, 50 light and 90 heavy; re-measure after changing counts or unit radii). Raise the counts and the heavy class loses open ground fast.
