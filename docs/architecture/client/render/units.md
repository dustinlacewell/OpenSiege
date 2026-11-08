Source: apps/client/src/render/units.ts, apps/client/src/render/unitShader.ts, apps/client/src/render/instances.ts, apps/client/src/render/teamColors.ts

# Unit rendering

`UnitsPass` draws every unit with one instanced draw per kind. It draws twice: lit into the scene, and depth into the shadow map.

## Data per kind (`KindDraw`)

- The model: a static vertex buffer. Layout `[3, 3, 1]` = position, normal, part (`VERTEX_FLOATS` = 7). Locations 0, 1, 2.
- A VAO.
- An `InstanceBuffer` with stride 13. Locations 3 (vec4), 4 (vec4), 5 (vec3), 6 (vec2).

Instance floats: `x, y, z, yaw` | `aim, pitch, roll, siege` | `team r, g, b` | `gun, swing`. They come from a `UnitPose` (`client/game/interpolation.md`) and `TeamColors`.

## Calls

- `prepare(poses, teams)`: reset every buffer, write each pose into its kind's buffer, upload buffers that have instances. Call once per frame before `drawDepth` and `draw`.
- `drawDepth(lightViewProj, time)`: depth program, same vertex shader.
- `draw(cam, sun, time)`: opaque state, scene uniforms, then each kind. `cam` is a `SceneView` (`viewProj`, `eye`, `dist`). `time` is `Frame.time` in seconds; it drives the dish sweep.
- `drawOne(kind, pose, team, view, sun)`: one instance of one kind, for a headshot (`client/render/portraits.md`). It overwrites that kind's instances, so call it before `prepare`. `pose` is an `InstancePose` (a `UnitPose` without `unit`). Time is 0.
- Per kind, `u_lower` is the sim's `sink` stat. Uniforms `u_legLift`, `u_base` and `u_mast` come from the `UnitMesh`. `u_mast` is the hinge `(x, z, fold)`, or zero when the mesh has no `mast`. `u_gun` is the barrel pivot `(x, z)` from `gun`, or zero. `u_time` is set once per program.

## Vertex shader (`UNIT_VS`)

Applied in this order to each vertex:

1. Dish sweep. `DISH` parts turn about the vertical axis through the hinge x by `siege · 2.4 · sin(0.5 · time)` radians. It is a slow back-and-forth sweep, not a full spin: a full spin cannot ease to rest without per-unit state, and the mast must fold with the dish at rest.
2. Mast raise. `MAST` and `DISH` parts are modelled raised. They turn about the y axis through the hinge (x, z) by `fold · (1 - siege)`. So mobile they lie folded, sieged they stand up.
3. Barrel pitch and swing. `BARREL` and `BARREL_DARK` parts turn about the y axis through `u_gun` by `i_gun.x`. Positive raises the muzzle. `i_gun.x` is measured from the elevation the barrel is modelled at. Then they turn about the z axis through `(u_gun.x, 0)` by `i_gun.y`, the swing that keeps the barrel on the world aim when the hull is tilted (`client/game/gun-pitch.md`). The tank and the artillery barrels both pitch; the artillery's recoil cylinders pitch with its barrel.
4. Siege fold. Parts flagged `LEG` shrink toward the hull and lift by `legLift · (1 - siege)`. All other parts sink by `sink · siege`.
5. Turret turn. Parts `TURRET`, `TURRET_PANEL`, `TURRET_DARK`, `BARREL`, `BARREL_DARK` rotate about z by `aim - yaw`.
6. Slope tilt: roll, then pitch.
7. Hull yaw about z.
8. Add the instance position.

`POSE_GLSL` (`rot`, `tilt`) is shared with `contactShadows.ts`.

## Fragment shader (`UNIT_FS`)

A material by part: paint (`u_base` with 10% team colour), a light grey `DISH`, team colour on `PANEL` and `TURRET_PANEL`, dark parts (`MAST` too), `BARREL` as `TURRET` and `BARREL_DARK` as `TURRET_DARK`, tracks with a tread stripe, emissive `LIGHT`. Panel seams on the hull. Then `lit`, `specular`, a rim term and `fogged`.

## InstanceBuffer

One growing `Float32Array` plus a GL buffer. `push()` returns the float offset of a new slot. `upload()` sends only the used part with `bufferSubData`. The array and the GPU buffer only grow (double). `bindAttributes` sets attributes with divisor 1 into the bound VAO.

## Invariants

- Instance stride must match `STRIDE` in `units.ts` and the attribute sizes `4 + 4 + 3 + 2`.
- The constructor builds one `KindDraw` per entry of the sim's `UNIT_KINDS`, from `UNIT_MESHES`. A new kind needs no change here (`sim/stats.md`).
- Poses are not kept past the frame. Instance data is copied in `prepare`.
