Source: apps/client/src/render/decalMap.ts, apps/client/src/game/decalStamps.ts, apps/client/src/render/terrainShader.ts

# Decal map

The ground's battle scars. One top-down texture over the map holds how charred each spot is. The terrain shader darkens its albedo from it before lighting, so the sun and realtime lights shade scorched ground. Scorches never fade. Their count costs nothing at draw time.

## Texture

- `R8`, 4096 by 4096 (less if `MAX_TEXTURE_SIZE` is smaller). 16 MiB of GPU memory.
- Covers the map 0..`mapWidth(terrain)` in x and 0..`mapHeight(terrain)` in y. A non-square map gets non-square texels.
- `LINEAR` filtering, no mips, `CLAMP_TO_EDGE`.
- 0 is clean ground, 1 is fully charred.
- Cleared to 0 on creation and when the `world` object changes.

## Stamping

`DecalMap.update(world, stamps, sight)` runs in `Renderer.prepare`, after `smokeField.update`.

1. Drain the `DecalStamps` queue (`client/game/smoke.md`). Stamps the local player does not see are dropped.
2. Draw each seen stamp as one instanced quad into the texture, through its own framebuffer, viewport the full texture.
3. Bind the default framebuffer and reset the viewport to the drawing buffer.

GL state is `stamp` (`glState.ts`): no depth, blend `ONE, ONE_MINUS_SRC_COLOR`. That is `dst = src + dst · (1 − src)`, so hits add up but never pass 1.

The stamp shader maps world `xy` to clip space by `xy / map · 2 − 1`. The quad is rotated by `seed · 2π` and scaled by `radius`. Two octaves of value noise erode the disc edge; `seed` offsets the noise. One hit peaks near 0.85, so it is not pure black.

## Terrain read

`TerrainPass` binds the texture on `DECAL_UNIT` (5) as `u_decals`. In the fragment shader, `scorch(g)` runs right after `ground()`: it samples at `clamp(v_pos.xy / u_map, 0, 1)` and multiplies the albedo by `mix(1, CHAR_RGB, char)`, with `CHAR_RGB` = (0.05, 0.045, 0.04) linear. Crystals, `lit` and `pointLights` all read the scorched albedo.

Only the terrain reads the map. Scatter, props and features do not darken.
