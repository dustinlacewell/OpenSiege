Source: apps/client/src/render/groundHeight.ts, apps/client/src/render/materialTexture.ts

# Ground height texture

The sim's vertex heights on the GPU. The water reads it to know how deep it is at each point (`client/render/water.md`).

## GroundHeightTexture

- One `R16F` texel per sim vertex, `cols` by `rows`. Linear filtering, so a lookup is bilinear between vertices, like `heightAt`.
- Vertex `(i, j)` sits on texel centre `(i, j)`. A shader maps world xy to uv as `(xy / cell + 0.5) / (cols, rows)`.
- Wrap is `MIRRORED_REPEAT`. The shader folds world xy onto the map first, with the same reflection as the mirrored surround (`client/render/terrain.md`). So a point in a copy reads the height it copies, and the wrap mode is never reached.
- `texture`: null until the first `sync`.
- `sync(terrain)`: a new `Terrain` object makes a new texture and uploads every height. The same object does nothing.
- `update(terrain, box)`: the heights in the inclusive vertex box changed in place. It copies only that rectangle into its `Float32Array` copy and uploads it with one `texSubImage2D`. A new terrain object falls back to `sync`.

`R16F` holds 0..900 to half a unit near the top, and it is always filterable. `R32F` is not filterable in plain WebGL2.

## Rect upload

`rectUploadPlan` (from `materialTexture.ts`) clamps the box to the grid. `copyHeightRect(heights, plan, out)` is pure: it copies the plan's vertices from the sim's row-major array into the same places in `out`. The upload sets `UNPACK_ROW_LENGTH`, `UNPACK_SKIP_PIXELS` and `UNPACK_SKIP_ROWS` so the source is the full copy.

## Who calls it

- `WaterPass.draw` calls `sync` every frame.
- `WaterPass.refresh(terrain, box)` calls `update`. In play, `Renderer.refreshTerrain` calls it with the box `TerrainWatch` takes after a crater. In the map editor, `Viewport.updateMesh` calls it after each frame's height dabs.
