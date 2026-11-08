Source: packages/sim/src/nav/ (moveClass.ts, cellGrade.ts, navGrid.ts, navState.ts, featureCells.ts, openFeatures.ts, closeFeatures.ts, reshapeTerrain.ts, regions.ts, slide.ts, escape.ts, openPoint.ts, spawnSpot.ts, nearest.ts), packages/sim/src/simState.ts, packages/sim/src/mapSize.ts

# Nav grid

The nav grid answers "can this unit drive here?". The terrain slope and the blocking features feed it. Water does not feed it: water only slows a unit (`sim/water.md`, `future-work/terrain/water-pathing.md`). Lava is meant to feed it later (`future-work/terrain/lava.md`).

## Shape

- One cell per terrain cell. `NavShape` is `{ cols, rows, cell }` with `cols = terrain.cols - 1`, `rows = terrain.rows - 1` and `cell = terrain.cell` (`navShape(terrain)`). The default map has 128 x 128 cells of 125 world units. Cell (i, j) spans vertices (i, j) to (i+1, j+1). Index is `j * cols + i`.
- Every helper in `navGrid.ts` takes the shape first: `colOf`, `rowOf`, `cellIndexAt`, `cellCentre`, `centreOfCell`, `wholeMap`, `growBox`, `refreshCells`. So do the helpers elsewhere that read a grid: `findCells`, `labelRegions`, `clearLine`, `nearestInRegion`, `stampFeature`.
- One `Uint8Array` per move class (`NavGrid`). A cell is open (0) or `BLOCKED` (1). There are no costs.
- Move classes, not unit kinds. `UnitStats.moveClass` names one. Adding a kind adds no nav code.
  - `light` (most kinds): `maxGrade` 38.
  - `climber` (mine): `maxGrade` 80, and `uphillMinPct` 85 so slopes slow it little.
  - `heavy` (factory): `maxGrade` 36.
- The slope limits live in `CLASS_PARAMS` (`moveClass.ts`): `maxGrade` blocks cells, `uphillMinPct` is the uphill speed floor that `slopeSpeed` uses (`sim/systems/movement.md`).
- `CLEARANCE_RADIUS` (`moveClass.ts`) is, per class, the largest radius of any unit in it, read from `UNIT_STATS`. `light` 50 (harvester), `heavy` 90 (factory).

## What blocks a cell

A cell is `BLOCKED` for a class when:

1. Its grade exceeds the class's `maxGrade`. `cellGrade(terrain, i, j)` is the largest difference of the four corner heights, in percent of the cell size (`terrain.cell`). Integer, floored. A finer cell gives a steeper grade for the same heights. The slope is beyond what the class climbs.
2. Its centre lies within (feature radius + the class's clearance radius) of a `blocksMove` feature. The cell that holds the feature's centre is blocked whatever its distance.

Nothing else. A cell has no cost, so a hill that is climbable costs nothing extra, and there is no ring around cliffs. A unit's body fits wherever a cell is open, against features. Against a cliff the body can overlap the cliff cell edge: the grid does not pad terrain.

`refreshCells` (`navGrid.ts`) writes a box of cells from the terrain and the feature counts. A cell reads nothing outside itself, so a box is exact on its own.

## Features

`blocksMove` features (`sim/features/feature-stats.md`: rocks, boulders and scrap) block every class. For a class, a feature covers the cell that holds its centre, and every cell whose centre lies inside its circle grown by the class's clearance radius (`stampFeature`, `featureCells.ts`). The wider the class, the more cells a feature blocks.

`NavState.featureBlock` is one `Uint8Array` per class, one count per cell: how many blocking features cover it for that class. A cell with a count is blocked. Trees block nothing and are not in the grid.

When a blocking feature is removed, `reap` (`sim/features/effects.md`) calls `openFeatures(nav, terrain, gone)` (`openFeatures.ts`) in that same tick:

1. For each class, subtract the features from that class's `featureBlock`.
2. For each class, `refreshCells` the cells they covered.
3. Relabel the regions of both classes, once.

The result equals a nav built fresh from the world without those features. A late joiner builds exactly that.

When a blocking feature appears (scrap from a dead unit, `sim/features/wreckage.md`), `deaths` calls `closeFeatures(nav, terrain, added)` (`closeFeatures.ts`) in that same tick. It is the mirror of `openFeatures`: add the features to each class's `featureBlock`, `refreshCells` the cells they cover, relabel the regions once per class. The result equals a nav built fresh from the world with those features. There is no `navRev`: the nav is derived from heights and features, both in the snapshot.

## Derived, never sent

`NavState` is `{ shape, featureBlock (per class), grids, regions }`. It is built from `World.terrain` and `World.features`. It is not in `World`, not in `encodeWorld`, not in `hashWorld`.

- `regions` (`regions.ts`): per class, a `Uint32Array` with a label per open cell. Two open cells share a label exactly when A* can lead one to the other. Blocked cells have label 0. Planning reads it to tell a reachable goal from an unreachable one in O(1) (`sim/nav/pathfinding.md`).

- `SimState` is `{ world, nav, features }`. `features` is the feature index (`sim/features/spatial-index.md`). `step(state, intents)` advances it.
- `createSimState(world)` builds `nav` and `features`. Call it wherever a world appears: a host after `createWorld`, the client after `decodeWorld`.

The grids change at two fixed points in `step`: `reap` and `deaths`. `openFeatures` runs when a blocking feature is destroyed. `closeFeatures` runs when a unit dies and leaves scrap. `reshapeTerrain` (`reshapeTerrain.ts`) runs when a blast changed heights (`SimState.terrainDirty`). It turns each vertex box into the cells around it, calls `refreshCells`, and relabels a class's regions once only if a cell of that class flipped.

## The block rule

`slide(grid, from, to)` (`slide.ts`) decides where a step ends. A unit on open ground never ends a tick inside a `BLOCKED` cell of its class.

- A step from open ground is legal when it ends in an open cell. If it crosses a cell corner (the cell column and row both change), the two cells beside the corner must be open too. A* cuts no corner either, so a one-vertex pinhole between two diagonal open cells stays shut.
- An illegal step keeps the x part if that is legal, else the y part if that is legal, else the unit stays. This is a slide along the cell edge.
- A unit that starts inside a blocked cell may take any step. `escapeAim` leads it out.

Two places use it: `stepToward` in `movement.ts` (every move, attack chase and guard follow) and `push` in `separation.ts`. `featureContact` uses it too.

## Leaving blocked ground

A unit can start in a blocked cell: a player spawns on a cliff, or a hull sits in a cell a rock's clearance covers.

- `escapeAim(grid, x, y)` (`escape.ts`) gives the centre of the nearest open cell, or null on open ground.
- `stepToward` calls it first, for every driving order (move, attack chase, guard follow). While the unit is in a blocked cell it aims there, not at the order's point, and the step never counts as reaching the point. `slide` lets every step of that walk through.
- A move order plans from that open cell (`sim/nav/pathfinding.md`), so the unit follows its path as soon as it is out.
- An idle unit does not walk out. Pushes from separation may still move it, with any step allowed.
- A new unit from a factory: `production` asks `spawnSpot` (`spawnSpot.ts`) for a spot. It tries eight directions at six growing distances. It takes the first spot with an open cell of the new unit's class and no overlap with any unit. If none is free, it falls back to `openPoint` on the first direction.

## Seams

- `cellGrade`, `stampFeature`, `refreshCells`, `reshapeTerrain`, `slide`, `escapeAim`, `openPoint`, `nearestOpen`, `nearestInRegion`, `labelRegions`, `clearLine`, `planPath` and the pieces under it are pure functions on plain data.
- `slope.ts` still sets speed on a slope. The nav grid only decides where a unit may enter.

## Change the limits

Edit `CLASS_PARAMS` in `moveClass.ts` (`maxGrade`). A class's clearance follows from the unit radii in `UNIT_STATS`: a wider unit widens every feature's blocked disc for its class. Probe the blocked share on generated terrain after a change, and the landing numbers in `sim/nav/pathfinding.md`.
