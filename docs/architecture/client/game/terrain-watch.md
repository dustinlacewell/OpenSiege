Source: apps/client/src/game/terrainWatch.ts, apps/client/src/game/lockstep.ts, apps/client/src/app/frameLoop.ts

# Terrain watch

`TerrainWatch` joins the sim's terrain changes to the client code that keeps a copy of the heights. Blasts change heights in place. The `Terrain` object stays the same, so nothing that caches heights would notice alone.

## Interface

```
watch.note(boxes)   // after each sim step
watch.take()        // once per frame: VertexBox | null
unionBox(a, b)      // pure: the smallest box holding both
```

A `VertexBox` is `{ i0, j0, i1, j1 }`, inclusive sim vertex indices.

## Flow

- `Lockstep` owns one `TerrainWatch` (`terrainWatch`). After each `step` it calls `note(sim.terrainDirty)`.
- `frameLoop` calls `take()` once per frame, right after `lockstep.update`. If the result is not null, it calls `refreshTerrain` on the consumers below. This is before `vision.update` and before drawing.
- `take` returns the union of every box noted since the last `take`, then clears. Many steps in one frame give one box.
- A new match is a new `Lockstep`, so a new watch. A new world is a new `Terrain` object, and each consumer already rebuilds in full for that.

## Consumers

The consumers do not know about blasts or the sim step. Each one gets the terrain and the box.

- Ground mesh: `TerrainPass.updateMesh` rewrites and uploads the mesh rows that read the box (`client/render/terrain.md`).
- Fog of war: `Vision.refresh` calls `SightGrid.refresh`, which re-reads the ground height of the cells that touch the box. It also forces the next `update` to recompute.
- Ground cover: `ScatterPass.refresh` keeps the box. The next `prepare` redoes the steep mask inside it (`refreshScatterMask`) and rebuilds the instances.
- Features: `FeaturesPass.refresh` marks the feet stale. The next `prepare` rewrites every instance. This is one pass over the features with a few ground probes each.
- Minimap: `Minimap.refresh` repaints the pixels of the height image that read the box (`refreshHeightImage`). A pixel reads one pixel step either side.

`Renderer.refreshTerrain` fans out to the ground mesh, ground cover and features. `Hud.refreshTerrain` reaches the minimap.

## Invariants

- A box refresh gives the same data as a full rebuild. The tests check the pure builders (`scatterMask`, `paintHeights`, `SightGrid`).
- `take` is the only reader. Do not read `terrainDirty` anywhere else on the client.
