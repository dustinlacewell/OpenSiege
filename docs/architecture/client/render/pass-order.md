Source: apps/client/src/render/renderer.ts, apps/client/src/render/frame.ts, apps/client/src/render/hdrTarget.ts

# Render pass order

`Renderer` (`renderer.ts`) is the only owner of passes. Its public calls: `fit(dpr)`, `draw(frame)`, and the `portraits` field for the HUD. Everything it draws is in the order below.

## draw(frame)

1. `prepare`
   - `fillPoses(poses, world, prev, alpha)`
   - `keepVisible(poses, vision)`: keep only seen units (`client/game/vision.md`). Every pass that reads poses sees only shown units.
   - `teams.use(world.players)`
   - `portraits.update(teams.of(me))`: re-render the HUD headshots if the local team colour changed (`client/render/portraits.md`). Before `units.prepare`, since it reuses unit instance buffers.
   - `units.prepare(poses, teams)`: fill and upload unit instances
   - `features.prepare(world)`: rebuild feature instances if the set changed (`client/render/features.md`). Not filtered by vision.
   - `scatter.prepare(world, cam)`: rebuild the ground-cover window if the camera block or the inputs changed (`client/render/scatter.md`)
   - `smokeField.update(world, time)` then `smoke.fill(smokeField, vision)`
   - `decals.update(world, smokeField.stamps, vision)`: burn this frame's seen scorches into the decal map (`client/render/decal-map.md`)
   - `shadowMap.fit(cam)`: refit the sun frustum
   - `gatherLights`: `lights.beginFrame()`, `holdShellLights`, `workBeams.prepare(poses, lights, time)`, then pack, bin into screen tiles and upload the lights for the lit passes (`client/render/lights.md`)
2. `castShadows` (into the 4096 shadow map): `terrain.drawDepth`, then `features.drawDepth`, then `units.drawDepth`
3. `ripples.update(frame, terrain)`: step the ripple field in its own framebuffer (`client/render/ripples.md`)
4. `hdr.begin(w, h)`: bind the multisampled HDR target and clear it
5. `drawScene` (into the HDR target), in this order:

| Pass | Reads from the frame | GL state |
|---|---|---|
| `sky.draw` | `cam`, sun | fullscreen |
| `terrain.draw` | `world.terrain`, `world.fields`, `cam`, sun, lights, `time`, decal map | opaque |
| `scatter.draw` | `cam`, sun, lights (window from `prepare`) | opaque |
| `features.draw` | `cam`, sun, lights | opaque |
| `contact.draw` | poses, `cam` | decal |
| `overlay.drawGround` | `selected`, `me`, `world.terrain`, poses, `cam`, `dpr` | decal (lines), overlay (rings) |
| `radar.draw` | `vision` (radar contacts), `world.terrain`, team colours, `cam`, `time` | additive |
| `units.draw` | `cam`, sun, lights | opaque |
| `hdr.grab()` | the scene so far | blit |
| `water.draw` | `world.terrain`, `cam`, sun, lights, the grab, the ripple field, `time` | surface |
| `smoke.drawPuffs` | smoke field, `cam` | translucent |
| `projectiles.draw` | `world.projectiles`, `prevShots`, `alpha`, `cam`, `vision` | additive |
| `workBeams.draw` | beams from `prepare`, `cam`, `time` | additive |
| `effects.draw` | `particles`, `cam`, `vision` | additive |

The water draws after everything opaque and the ground marks, so it can see them through itself: units and rings under water are refracted and tinted. It draws before smoke and light, so those stay on top of it (`client/render/water.md`).

6. `hdr.resolve()`: blit the multisampled image into a texture
7. `post.draw(hdr.texture, w, h)`: tone map to the canvas (default framebuffer)
8. `overlay.drawScreen`: health and build bars on the final image (`selected`, `me`, poses, `cam`, `dpr`)

Before a match exists, `draw` gets the backdrop frame (`client/app/backdrop.md`). There is no empty draw.

## Rules

- Every pass sets its own GL state first, with a function from `glState.ts`. Never rely on the previous pass.
- Passes read the `Frame`, the poses and the shared sun. They do not read the session, DOM or network.
- The sun is the `ShadowMap`. Lit passes get it as a `SunLight` (`client/render/scene-lighting.md`). They get the tiled light textures as `SceneLights`.
- Passes after `post` draw to the 8-bit canvas. Passes before it draw linear HDR.
- No transparent sorting. Order in the table is the order of blending.
- A pass that reads the scene behind it (the water) draws after `hdr.grab()`. Anything drawn after the grab is not in it.
- A pass that draws world things filters them with `frame.vision`, never with its own distance test. Map knowledge is not filtered: terrain, features and ground scatter always draw. Scatter's own distance fade is decoration, not a vision test.

## Recipe: add a pass

1. Write `render/<name>.ts` with a class that takes `gl` (and shared helpers such as `quad`) in its constructor and builds its program and buffers there.
2. Give it `draw(...)` that sets a state function, calls `useProgram`, sets uniforms, binds a VAO and draws. Use `InstanceBuffer` for per-instance data (`client/render/gl-helpers.md`).
3. For a lit pass, paste `SCENE_FS` into the shader and call `applyScene`.
4. Construct it in the `Renderer` constructor. Call it from `drawScene` (HDR, before tone map) or after `post.draw` (screen).
5. If it needs a new input, add a field to `Frame` and set it in `fillFrame` (`client/render/frame.md`).
6. If it must cast shadows, add `drawDepth(lightViewProj)` and call it in `castShadows`.
