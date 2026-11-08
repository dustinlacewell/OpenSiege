Source: apps/client/src/render/water.ts, apps/client/src/render/waterShader.ts, apps/client/src/render/waterMesh.ts, apps/client/src/render/waterWaves.ts, apps/client/src/render/waterNormalShader.ts

# Water pass

`WaterPass` draws the sea. It is one surface at `terrain.seaLevel` under the map and the whole mirrored surround. Ground above the sea level hides it through the depth test. The sim decides what is wet the same way: ground below `seaLevel` (`sim/water.md`).

## Inputs

`draw(terrain, cam, sun, lights, grab, ripples, time)`:

- `terrain`: `seaLevel`, the grid size and cell, and the heights (through the ground height texture, `client/render/ground-height-texture.md`).
- `cam`: the grid centre (`cam.x`, `cam.y`), `viewProj`, `invViewProj`, the eye.
- `sun`, `lights`: the scene set (`client/render/scene-lighting.md`).
- `grab`: `hdr.grab()`, the scene drawn so far (`client/render/hdr-and-post.md`).
- `ripples`: the ripple field texture, or null (`client/render/ripples.md`). Null binds a 1 by 1 zero texture, so the water is calm. The map editor always passes null.

`refresh(terrain, box)`: the heights in `box` changed in place; the ground height texture uploads that rectangle.

## Mesh (`waterMesh.ts`, pure)

- A tensor grid: the same coordinate list on x and y. It has no T-junctions, so it never cracks.
- The axis: `WATER_FINE_STEPS` (96) steps of `WATER_FINE_SPACING` (32) each side of the centre, then `WATER_COARSE_STEPS` (64) steps that grow by one ratio (`growthFor`) and end at the reach.
- Reach: `waterReach(w, h) = (ringsFor(w, h) + 1) · max(w, h)`. From any centre on the map it covers the whole mirrored surround (`surround.ts`).
- Default map: 321 by 321, 103041 vertices, 204800 triangles. It is rebuilt only when the reach changes.
- The grid moves with the camera. Its centre snaps to steps of 64, so the fine vertices stay on one lattice and do not swim.

## Waves (`waterWaves.ts`, pure)

Five Gerstner waves, wavelengths 420 to 76, amplitudes 2.4 to 0.32. Speed is deep-water dispersion, `ω = √(G·k)` with `WAVE_GRAVITY` 24. `crestSharpness` (Σ steepness · k · amplitude) must stay at most 1, or crests loop. `wavesGlsl` writes the table as GLSL constant arrays.

## Vertex stage

1. The rest point `p = centre + offset`.
2. Depth: `seaLevel - groundHeight(p)`.
3. Wave amplitude: `waveAmp(depth)` (0 at 2 units deep, full at 30), so the shore does not clip through the waves. It fades to 0 between 0.6 and 0.95 of the fine core's reach from the centre, where the grid grows coarse.
4. Height: sea level plus the Gerstner sum plus the ripple field's R (on the map only).

The rest point goes on to the fragment stage. Waves, maps and foam are read there.

## Fragment stage

1. Screen depth: no ground behind the pixel (the sky, depth 1) discards it. Thickness is the view-ray distance from the surface to the grabbed depth, made linear with `invViewProj`. Thickness 0 or less discards.
2. Normal: the analytic Gerstner normal at the rest point (faded out from 6000 to 18000 units from the eye), plus two scrolling layers of the water normal texture (380 and 155 units per tile), plus the ripple slope (G, B). They add as slopes.
3. Body (`waterBody`): the grabbed colour, refracted. The offset is the normal's xy times 24 world units, scaled by thickness up to 80, projected to the screen. An offset that lands off screen, on the sky, or on something in front of the surface is dropped. Then Beer–Lambert absorption per channel (`ABSORB`) over the path, plus in-scattered light (`SCATTER_ALBEDO` lit by sky, sun and point lights).
4. Reflection: screen-space march along the reflected ray against the grabbed depth, 16 steps that grow by 1.35, then 5 binary refine steps. A hit fades toward the sky near the screen edge. A miss reads `skyColor`. The ray never points down.
5. Mix body and reflection by Schlick Fresnel (F0 0.02).
6. Sun glint: GGX (roughness 0.18) in HDR, clamped to 60, shadowed by the sun shadow map.
7. Foam: at the waterline (thickness under 16), in bands that roll in toward the shore (the vertical depth stands in for distance to shore), and the ripple field's A. The texture's B channel breaks it up. Foam is lit like ground: `lit` plus `pointLights`.
8. `fogged`: the same distance haze as the terrain. The fog of war never touches the water.
9. Alpha: 0 at thickness 0, 1 at 6. The shoreline has no hard seam.

## GL state

`surface` (`glState.ts`): depth test, depth write, alpha blend. The water hides what lies under it from later passes. Smoke, shells and effects set their own state.

## Uniforms and texture units

| Uniform | Unit | What |
|---|---|---|
| `u_ground` | `GROUND_HEIGHT_UNIT` (10) | ground height texture, both stages |
| `u_ripples` | `RIPPLE_UNIT` (7) | ripple field or the zero texture, both stages |
| `u_grabColor` | `GRAB_COLOR_UNIT` (8) | grabbed colour |
| `u_grabDepth` | `GRAB_DEPTH_UNIT` (9) | grabbed depth |
| `u_normals` | `WATER_NORMAL_UNIT` (11) | water normal texture |

Plus `u_seaLevel`, `u_time`, `u_map`, `u_grid` (cols, rows), `u_cell`, `u_centre`, `u_waveFade`, `u_invViewProj`, and the scene set (shadow map on unit 1, lights on 2 to 4). The units are named in `scene.ts`.

## Water normal texture

`WATER_NORMAL_FS`, drawn once by `createTilingTexture` at 512 by 512. A sum of 40 small sine waves whose wave vectors are whole numbers per tile, so it tiles exactly. R, G: slope packed 0..1. B: height 0..1.

## Tune

- Colour of shallow and deep water: `ABSORB`, `SCATTER_ALBEDO`, `SCATTER_K`.
- Wave size and speed: `WAVES` and `WAVE_GRAVITY`. Keep `crestSharpness` at most 1.
- Glint: `ROUGH`, `GLINT_MAX`.
- Shore softness: `EDGE`. Foam: `foam()`.
