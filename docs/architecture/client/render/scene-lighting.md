Source: apps/client/src/render/scene.ts, apps/client/src/render/skyPass.ts

# Scene lighting

`scene.ts` is the shared lighting library for lit shaders. The sky pass uses the same colours.

## The sun

`SUN` is a unit vector pointing toward the sun: `normalize(-0.5, -0.62, 0.6)`. Light comes from the north-west (smaller `x`, smaller `y`) and above (`+z`).

## Shader library

- `SCENE_VS`: declares `u_viewProj`.
- `SCENE_FS`: uniforms `u_eye`, `u_sun`, `u_fog`, `u_shadowMat`, `u_shadow`, `u_shadowTexel`, `u_lightData`, `u_lightTiles`, `u_lightIndex`, `u_lightsOn`, plus functions. Paste both after `precision` in a program.
- `toLinear(c)`: sRGB to linear. Albedos are authored in sRGB.
- `sunShadow(world, normal)`: 3 by 3 hardware-compare taps, with a normal offset against acne. A point outside the shadow map's coverage returns 1 (lit).
- `lit(albedo, n, shadow, ao)`: hemisphere ambient plus sun diffuse.
- `pointLights(albedo, n, world)`: diffuse from the frame's capsule lights (`client/render/lights.md`).
- `specular(...)`: Blinn-Phong with Fresnel.
- `haze(dir)`, `skyColor(dir)`, `fogged(color, world)`: horizon and sky colours. Fog starts at `1.3 · cam.dist` with scale `2.6 · cam.dist`.

All colour is linear HDR radiance before tone mapping (`client/render/hdr-and-post.md`).

## TypeScript side

- `SunLight`: the shadow map as shaders read it: `shadowMat`, `texture`, `texelUv`, `texelWorld`. `ShadowMap` implements it.
- `SceneLights`: the frame's light textures, `data`, `tiles`, `index`, and `on`. `LightTextures` implements it. `NO_LIGHTS` is the empty one (`on` false).
- `sceneUniforms(gl, program)`: looks up the eleven locations.
- `SceneView`: the camera fields lit passes read, `viewProj`, `eye`, `dist`. A `Camera` is one; so is a `PortraitView`.
- `applyScene(gl, u, cam, sun, lights)`: call after `useProgram`. `cam` is a `SceneView`. Sets all of them and binds the shadow texture to unit `SHADOW_UNIT` (1). When `lights.on`, it binds the light textures to `LIGHT_DATA_UNIT` (2), `LIGHT_TILES_UNIT` (3) and `LIGHT_INDEX_UNIT` (4). It leaves unit 0 active and free for the pass's own texture.

## SkyPass

A fullscreen triangle. The fragment shader unprojects the pixel with `cam.invViewProj` to get a view direction and outputs `skyColor(dir)`. It draws first, so the haze at the horizon matches the ground fog.

## Recipe: write a lit shader

1. Add `${SCENE_VS}` and `${SCENE_FS}` after `precision highp float;`.
2. In the pass, call `sceneUniforms` once, then `applyScene` each draw after `useProgram`. Take the frame's `SceneLights` as a parameter.
3. Use texture unit 0 for the pass's own texture. Unit 1 is the shadow map. Units 2 to 4 are the lights. Units 5 to 11 belong to the terrain and the water; their names are in `scene.ts`.
4. Draw into the HDR scene target. `pointLights` finds its tile from `gl_FragCoord`, so the tiles fit only that target.
5. Output `fogged(lit(...) + pointLights(...), worldPos)`.

## Change the look

Tune the `*_RGB` constants in `SCENE_FS` and `SUN`. A changed `SUN` is picked up by the shadow fit automatically.
