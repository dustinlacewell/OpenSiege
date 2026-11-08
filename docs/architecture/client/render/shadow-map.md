Source: apps/client/src/render/shadowMap.ts, apps/client/src/render/lightFrustum.ts

# Sun shadow map

One 4096 by 4096 depth texture (clamped to `MAX_TEXTURE_SIZE`). It is refitted to the camera every frame.

## ShadowMap

Implements `SunLight` (`client/render/scene-lighting.md`).

- `fit(cam, map)`: `map` is the world's `MapSize`. Calls `fitLight` and sets `shadowMat = BIAS · viewProj`. `BIAS` maps clip space -1..1 to 0..1.
- `begin()`: binds the framebuffer, sets the viewport, applies `shadowCaster` state (polygon offset 1.5, 3) and clears depth.
- `end()`: unbinds the framebuffer.
- `viewProj`: world to light clip space. Casters draw with it.
- The texture uses `COMPARE_REF_TO_TEXTURE` (compare function `LEQUAL`) and linear filtering. The lit shaders sample it through a `sampler2DShadow`.
- `DEPTH_FS` (exported) is the empty fragment shader for depth-only draws.

## fitLight (`lightFrustum.ts`)

Builds an orthographic frustum along `SUN`, around only the ground the camera sees.

1. Light view: looks along `-SUN`.
2. Footprint: the four screen corners are unprojected with `cam.invViewProj` into near-to-far rays. Each ray is cut at `z = 0` and `z = CASTER_TOP` (`TERRAIN_MAX_HEIGHT + 300`). Points are clamped to the map rectangle plus `MARGIN` (1500) on each axis, using `map.width` and `map.height`. The light-space bounding box of those points is the footprint.
3. Size: the larger box side, at least 200, rounded up in steps of 1/8 of the next power of two.
4. Centre: snapped to whole texels. Size changes only in steps. Both avoid shimmering shadows.
5. Depth range: covers the whole map box (`map.width` by `map.height`, plus `MARGIN`), so hills outside the view still cast.

It returns world units per texel (`texelWorld`).

## Casters

- `TerrainPass.drawDepth(terrain, lightViewProj)`
- `FeaturesPass.drawDepth(lightViewProj)` (`client/render/features.md`)
- `UnitsPass.drawDepth(lightViewProj, time)`

All use the same vertex shader as their lit pass, with `DEPTH_FS`.

## Invariants

- Casters must be drawn between `begin()` and `end()`.
- `fit` must run before `begin`. `Renderer.prepare` does it.
- Anything that moves a vertex in the lit vertex shader (unit siege fold, turret turn) must move it the same way in the depth pass. Sharing `UNIT_VS` guarantees that.
- Billboards, smoke, lines and ground scatter cast no shadows.
