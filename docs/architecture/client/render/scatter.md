Source: apps/client/src/render/scatterPass.ts, scatterCells.ts, scatterMask.ts, scatterView.ts, scatterMeshes.ts

# Ground scatter

Grass tufts, pebbles and bushes on the ground. Pure decoration. Client only: not in the sim, not in the snapshot. It uses the static-prop path (`client/render/features.md`) with a fade.

## Placement (pure)

`placeScatter(terrain, mask, view, limit, sink)` walks the cells inside the window. A cell's props come from `hash01(i, j, salt)` alone, so every client sees the same ground, and moving the window never moves a prop.

- Count: `floor(hash · (1 + 4 · density))`, at most 5. `density` is a hash of the 8-by-8-cell patch, so meadows and bare patches show.
- Position: a hash inside the cell. Height: `heightAt`. Yaw and tint: hashes.
- Kind: 10% pebbles, 6% bushes, else a tuft. A tuft is dry grass with a chance that grows with height (smoothstep 0.25 to 0.7 of `TERRAIN_MAX_HEIGHT`).
- Size (world units, footprint · height): tuft 10 to 18 · 18 to 30, dry tuft 10 to 18 · 16 to 26, pebbles 6 to 12 · 4 to 9, bush 16 to 28 · 20 to 34.

## The mask (pure)

`scatterMask(world)` gives one byte per terrain cell, 1 = no scatter:

- Steep: corner heights differ by more than 0.3 × cell.
- Resource fields: field radius + 60.
- Features: feature radius × 1.8, so leaves are not buried in grass.

Water and lava are not in the sim yet. When they land, their cells join the mask.

## Models

`SCATTER_MESHES`, indexed by `TUFT`, `DRY_TUFT`, `PEBBLES`, `BUSH`. Tuft: seven thin three-sided cones, 28 triangles. Pebbles: three small `blob`s, 60. Bush: three `blob`s, 60.

## Window and fade (`scatterView.ts`)

- Fade end = `cam.dist × 1.4`, clamped to 1200 to 3200, rounded up to 500. Props are full size inside 60% of it and shrink to nothing by the end. The vertex shader does this (`u_fade`), so there is no blending and no sorting.
- The window is centred on the camera target snapped to 500 units and has radius fade end + 400. It rebuilds only when that centre or the fade end changes, or when the mask changes. The true camera position drives the fade each frame.
- Past camera distance 7000 nothing is built or drawn.

## ScatterPass

- `prepare(world, cam)`: recompute the mask when `FeatureWatch` fires; rebuild the window if needed. Cap: `SCATTER_LIMIT` = 8000 props. Past it the far cells stay bare.
- `draw(cam, sun)`: one instanced draw per kind. No depth pass: scatter casts no shadows. It receives them.
- Fog of war does not touch it.

## Cost

A typical window holds 1500 to 2300 props, 28 to 60 triangles each. A rebuild takes under 1 ms and happens a few times per pan across the map.
