Source: apps/client/src/render/lightTextures.ts, apps/client/src/render/scene.ts, apps/client/src/game/shellLights.ts, apps/client/src/render/workBeams.ts, apps/client/src/render/workBeamGeometry.ts

# Lights in the renderer

The lit shaders add up to `MAX_LIGHTS` (512) capsule lights on top of the sun. Each fragment reads only the lights binned into its screen tile (`client/render/light-tiles.md`). The pool is `Frame.lights` (`client/game/lights.md`).

## Per frame

`Renderer.prepare` ends with `gatherLights`:

1. `lights.beginFrame()`: last frame's held lights go.
2. `holdShellLights(lights, projectiles, prevShots, alpha)`: holds one warm point light per shell in flight. Radius 70, radiance `[2.0, 1.4, 0.7]`. The position is `shotAt`, the same one `ProjectilesPass` draws (`client/game/interpolation.md`).
3. `workBeams.prepare(poses, features, terrain, lights, time)`: finds the beams and holds one green capsule light per beam, from emitter to target. Radius 140, radiance 3 times `HALO`, times the flicker `1 + 0.15 · sin(time · 45)`.
4. `LightTextures.fill(lights, vision, target)`: packs the strongest seen lights, bins them into tiles of the scene target, and uploads three textures.

## Textures

`LightTextures` owns three NEAREST textures with no mips. Each stays bound to its own unit, so a unit never holds a texture of the wrong sampler type.

- Light data, `LIGHT_DATA_UNIT` (2): RGBA32F, 3 by `MAX_LIGHTS`. Texel `(k, i)` is vec4 `k` of light `i`.
- Tiles, `LIGHT_TILES_UNIT` (3): RG32UI, `tilesX` by `tilesY`. Texel is `(offset, count)` into the index list. It is made again only when the tile count changes.
- Index list, `LIGHT_INDEX_UNIT` (4): R32UI, `LIGHT_INDEX_ROW` (1024) wide. Entry `j` is at `(j % 1024, j / 1024)`.

`fill` updates them with `texSubImage2D`, only the rows in use. With no lights, `on` is false and nothing uploads.

The bin target is the drawing buffer size. `HdrTarget.begin` uses the same size, so the tiles match `gl_FragCoord` in every lit pass. The canvas already holds the device pixel ratio (`fitCanvas`).

## Binding

Every lit pass gets the `LightTextures` as a `SceneLights`. `applyScene(gl, u, cam, sun, lights)` points the three samplers at their units, sets `u_lightsOn`, and binds the textures when `on`. `NO_LIGHTS` is for the sky and headshots. With it, `u_lightsOn` is 0 and the shader reads no light texture.

## Shader

`pointLights(albedo, n, world)` in `SCENE_FS`:

1. Return 0 when `u_lightsOn` is 0.
2. Tile: `ivec2(gl_FragCoord.xy) / LIGHT_TILE`. Read its `(offset, count)`.
3. For each index in the run, fetch the light's three texels.

Per light: the closest point on segment A-B, attenuation `clamp(1 - dist / radius)^2`, and diffuse `0.2 + 0.8 · max(n · l, 0)`. The wrap keeps ground under a light from going black. No shadow.

Terrain, unit and prop shaders add `pointLights` next to `lit(...)`, with the same linear albedo and normal.

## Work beam geometry

`workBeamGeometry.ts` `workBeams(poses, features, terrain, out)` is pure. It writes the emitter point (the engineer's mast light, `ENGINEER_EMITTER`) and target point (half the target's height) of each working engineer into reused objects. `WorkBeamsPass` uses it for both the billboards and the light. Poses hold only seen units, so no beam needs its own vision test.

`work` names a posed unit first. Else it names a feature: scrap being reclaimed. The beam then ends at the scrap's centre, 0.2 of its unit's height over the ground. Features are not filtered by vision, so this beam shows when the engineer is seen.
