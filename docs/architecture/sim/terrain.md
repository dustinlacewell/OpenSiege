Source: packages/sim/src/terrain.ts, packages/sim/src/flatness.ts, packages/sim/src/slope.ts, packages/sim/src/mapSize.ts, packages/sim/src/types.ts, packages/sim/src/stats.ts

# Sim terrain

## Shape

`Terrain` is `{ cols, rows, cell, heights, seaLevel }`.

- `cell` is the distance between vertices in world units. The default map uses 125. It is an integer that divides the map width, the map height and 1000 (`sim/map-spec.md`).
- `cols` = `width / cell + 1` vertices along `x`. `rows` = `height / cell + 1` vertices along `y`. The default map has 129 by 129.
- There is no width or height field. `mapWidth(t)` is `(cols - 1) * cell`. `mapHeight(t)` is `(rows - 1) * cell`. `mapSize(t)` gives both.
- `heights` is row-major: vertex `(i, j)` is `heights[j * cols + i]`. It sits at world `(i * cell, j * cell)`.
- Heights are integers in `0..TERRAIN_MAX_HEIGHT` (900).
- `seaLevel` is an integer height. Ground below it is water (`sim/water.md`). `createWorld` and `generateTerrain` set it with `seaLevelOf(heights)`. Nothing changes it after that.
- Terrain is part of `World` and never changes after `createWorld`.

## Generation

`generateTerrain(seed, params)` is called once from `generateMap` with one rng draw (`sim/map-spec.md`). It sums three value-noise octaves. Their periods are in world units: 4000, 2000 and 1000. The weights are 4, 2 and 1. A vertex at `i * cell` reads the noise at that world position, so the hills have the same size at every cell size. All math is integer. `normalize` stretches the result to `0..TERRAIN_MAX_HEIGHT`.

## heightAt

`heightAt(terrain, x, y)` is the ground height at any point.

- Bilinear between the four nearest vertices. Floor to an integer.
- Clamps `x` to `0..(cols-1)*cell - 1` and `y` to `0..(rows-1)*cell - 1`. Outside points read the edge.
- The client may pass float coordinates. The result is still an integer.
- It is the single source of ground height. The sim, the picking code, the camera, the particles and the render mesh all call it.

## Users of height

- `movement` slows uphill and speeds downhill (`slope.ts`, speed 45% to 115%).
- `movement` slows a unit in water to `waterSpeed` percent (`sim/water.md`).
- `combat` adds a range bonus for a high shooter (`effectiveRange`, up to +50%).
- `projectiles` hits the ground when `z <= heightAt * PROJ_FP`.
- `launch` aims at ground height plus half the target height.
- `world.ts` and `spawn.ts` use `roughness` (`flatness.ts`) to pick flat spots.

## Sim height map versus the render mesh

The sim map has `cols` x `rows` vertices (129 x 129 on the default map). The render mesh is 4 times finer per axis. Mesh vertex heights still come from `heightAt`, so the drawn ground matches the sim ground. Shading normals come from a smoother curve. See `client/render/terrain.md`.

## Hash

`hash.ts` hashes `cols`, `rows`, `cell`, `seaLevel`, the number of heights and every height (`sim/hash.md`).
