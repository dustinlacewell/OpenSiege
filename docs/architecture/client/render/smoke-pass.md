Source: apps/client/src/render/smokePass.ts, apps/client/src/game/smoke.ts

# Smoke pass

Draws the puffs of a `SmokeField` (`client/game/smoke.md`) as smoke clouds. Scorches are not here; they burn into the decal map (`client/render/decal-map.md`).

## Calls

- `fill(field, vision)`: called in `Renderer.prepare`. Skips puffs where `vision.sees` is false (`client/game/vision.md`). Computes alpha and size for each.
- `drawPuffs(cam)`: in the scene after units. Translucent state (depth test, no depth write). Nothing draws when the batch is empty.

## Instance layout

Stride 7: `x, y, z, size | alpha, shade, seed`. Locations 1 and 2. The quad corner is location 0.

## Vertex shader

The quad is rotated by `seed · 2π`, scaled by `size`, and faces the camera using `u_right` and `u_up`.

## Fragment shader

Value noise (two octaves) erodes the circle edge, so each puff has a ragged outline. Grey comes from `shade` (linearised), lighter toward the top of the quad, with a warm tint.

## Life curve (in the pass, not the field)

Fades in over the first 6% of life, then `(1-t)^1.5`, peak alpha 0.6. Size grows from `size` to `size · grow` along `sqrt(t)`.

## Invariants

- No depth sort. Overlapping puffs blend in array order.
- The field may hold up to 6000 records. The instance buffer grows as needed.
