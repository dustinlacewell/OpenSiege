Source: apps/client/src/render/billboards.ts, apps/client/src/render/effects.ts, apps/client/src/render/projectiles.ts, apps/client/src/render/radarPass.ts, apps/client/src/render/cameraAxes.ts

# Billboards, effects and shells

Glows, sparks, rings and shells share one additive billboard shader.

## BillboardProgram

One program, created once in `Renderer` and shared. `use(cam)` sets the additive state, `useProgram`, and the uniforms `u_viewProj`, `u_right`, `u_up`, `u_gain` (4.0).

Shapes (the `shape` instance value):

- `SOFT` (0): camera-facing soft glow.
- `FLAT_RING` (1): a ring lying in the ground plane.
- `HOT` (2): camera-facing glow with a brighter core.
- `FLAT_GLOW` (3): a soft disc with a faint rim in the ground plane. No white core, so it never reads as a unit or a shot.

Colours are sRGB. The shader linearises them and scales by the gain, so cores over-expose to white. Output is premultiplied for additive blending.

## BillboardBatch

An instanced quad draw. Stride 9: `x, y, z, size | r, g, b, a | shape`.

- `reset()`, `push(x, y, z, size, r, g, b, a, shape)`, `draw(cam)`.
- `draw` does nothing when empty. Otherwise it uploads, calls `shader.use(cam)` and draws.

Camera-facing shapes offset the point by `u_right · x + u_up · y` (`client/game/camera.md`). Flat shapes offset in the ground plane.

## EffectsPass

Reads `frame.particles`. It skips particles where `vision.sees` is false (`client/game/vision.md`). For each other particle it pushes one billboard:

- `RING`: grows (`0.2 + 0.8·sqrt(t)` of final size), fades linearly, `FLAT_RING`.
- `SPARK`: fixed size, fades linearly, `HOT`.
- Otherwise (`GLOW`): swells by 50% over its life, fades with `(1-t)²`, `SOFT`.

## ProjectilesPass

Reads `world.projectiles`, `prevShots`, `alpha`, `vision`.

- Own shells always draw. Enemy shells draw only where `vision.showsAt` is true at the blended position.
- Position is the blend of the previous and current fixed-point position, divided by `PROJ_FP`.
- Look by the source kind's `weapon`: `ballistic` is large and orange, `direct` is small and yellow.
- Per shell: a faint wide halo (`SOFT`), a bright core (`HOT`), and 7 trail points behind it along the velocity, each smaller and fainter.

## RadarPass

Reads `vision.radarContacts()` and `vision.radarSpot` (`client/game/vision.md`). Per contact: one `FLAT_GLOW` of radius 90 in the owner's team colour, at the radar spot. Its height is the highest ground under the centre and four rim points, plus 10, so slopes do not cut it. Alpha pulses gently: `0.45 · (0.65 + 0.35 · sin(time · 2.4 + id · 1.7))`.

## Recipe: add a glow

Use an existing batch: `batch.push(...)` with a shape. For a new shape, add a constant and a branch in the shader, in `billboards.ts`. For a new source of glows, add a pass like `EffectsPass`, construct it in `Renderer`, and draw it in `drawScene` (`client/render/pass-order.md`).
