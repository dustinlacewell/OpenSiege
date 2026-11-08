Source: packages/sim/src/types.ts, packages/sim/src/mapSize.ts, packages/sim/src/generateMap.ts, packages/sim/src/world.ts, packages/sim/src/stats.ts

# Map spec

A map is plain data. The map width, the map height and the terrain cell size are values the world carries. No constant holds them. A map may be any rectangle.

## Types

- `MapSize` is `{ width, height }` in world units. Integers. The map spans `0..width` on `x` and `0..height` on `y`.
- `MapParams` is `MapSize` plus `cell`. It is the input of `generateMap`.
- `MapSpec` is `{ width, height, cell, heights, rng, fields, features }`.
  - `heights`: `cols * rows` integers in `0..TERRAIN_MAX_HEIGHT` (`sim/terrain.md`).
  - `rng`: the world rng at tick 0, after generation. A uint32.
  - `fields`: `{ x, y, radius, amount }` each.
  - `features`: `{ kind, x, y, radius, variant }` each. Hp comes from `FEATURE_STATS`.
  - No ids. `createWorld` assigns them.
- A spec is JSON data. It round-trips.

`DEFAULT_MAP_PARAMS` is `{ width: 16000, height: 16000, cell: 125 }`.

## Functions

- `generateMap(seed, params)` returns a `MapSpec`. It is pure. It throws if `validateMapParams` or `validateMapSpec` reports an error.
- `createWorld(spec)` returns a world with no players. Fields then features get ids `1..n` in order, so ids have no gaps. `nextId` is `n + 1`. `rng` is `spec.rng`. The heights are copied. See `sim/world-creation.md`.

The match host calls `generateMap` once per match. The choose-your-start world and the match world both build from the same spec, so they are equal.

## Reading the size

`mapSize.ts` is the one source for the map size.

- `mapWidth`, `mapHeight`, `mapSize` read a `Terrain` (`(cols - 1) * cell`, `(rows - 1) * cell`).
- `clampX(m, v)` and `clampY(m, v)` clamp one value into `0..width` or `0..height`.
- `mapCentre(m)` is the middle, rounded down.
- `mapDiagonal(m)` is `Math.hypot`. Only the AI and the client may call it. The sim must not: `hypot` is not exact on every machine.
- `spawnEdge(m)` is the margin for spawn picks: the smaller of 1000 and an eighth of the short side.
- `edgeMargin(base, m)` is `base`, cut to an eighth of the short side if it is more.
- `scaledCount(base, m)` is `base * width * height / REF_AREA`, rounded down. `REF_AREA` is 16000 x 16000. It is the area the generator counts were tuned for. It is not a map size.

A system reads `mapSize(world.terrain)` once per call and passes the result down. It does not read it in a hot loop. `step` reads it once per tick.

## Validation

`validateMapParams(p)` returns a list of errors. Empty means valid. It runs before the map is built.

- `width`, `height` and `cell` are positive integers.
- `cell` divides `width`, `height` and 1000. The grid lines, the unit grid and the nav grid all use 1000 spacing. Valid cells include 125, 100, 50 and 25.
- At most `MAX_VERTICES` (2^18) vertices, `cols * rows`. This keeps the A* heap key under 2^53 (`sim/nav/pathfinding.md`) and the render mesh (16 mesh vertices per map vertex) to a few million.
- At most `MAX_SIDE_CELLS` (2048) cells along one side.
- Each side is at least `MIN_MAP_SIDE` (2000).

`validateMapSpec(s)` checks the same sizes, except the minimum side. It also checks:

- `rng` is a uint32.
- `heights` has `cols * rows` entries. Each is an integer in `0..TERRAIN_MAX_HEIGHT`.
- At most `MAX_FIELDS` (64) fields.
- Each field has an integer positive radius and amount, and lies wholly inside the map: `radius <= x <= width - radius`, and the same for `y`.
- Each feature has an integer centre on the map, an integer radius and an integer variant. Only the centre must be inside. A rock may overhang the edge.

## Scaling

The generator scales its counts and its try limits with the map area, using `scaledCount`. At the reference area the result is exact, so the default map keeps its old counts. Radii, field spacing and the number of tree spots in one forest do not scale. Edge margins shrink with `edgeMargin`. The field count is at least 1 and at most `MAX_FIELDS`.
