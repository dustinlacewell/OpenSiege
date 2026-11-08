Source: apps/client/src/render/frame.ts, apps/client/src/app/frameLoop.ts

# Frame

`Frame` is the one object that carries game state into the renderer. It is created once by `startLoop` and mutated every frame. Passes take what they need from it.

## Fields

| Field | Type | Set by | Meaning |
|---|---|---|---|
| `world` | `World` | `fillFrame` | The live sim state after the last step. |
| `prev` | `ReadonlyMap<id, PrevPose>` | `fillFrame` | Unit poses before the last step. |
| `prevShots` | `ReadonlyMap<id, PrevShot>` | `fillFrame` | Shell positions before the last step (fixed point). |
| `alpha` | number 0..1 | `fillFrame` | Progress through the current turn. |
| `me` | number | `fillFrame` | Local player id. |
| `selected` | `ReadonlySet<number>` | `fillFrame` | Selected unit ids. |
| `curve` | `Curve \| null` | `fillFrame` | The right-drag curve move being drawn, from `session.curve`. |
| `area` | `ReclaimArea \| null` | `fillFrame` | The right-drag area reclaim being drawn, from `session.area`. |
| `guardHover` | number | `fillFrame` | Guard mode: the unit a click would guard, from `session.guardHover`. 0 = none. |
| `cam` | `Camera` | once | The shared camera (`client/game/camera.md`). |
| `dpr` | number | `fillFrame` | Device pixel ratio. Line and bar widths use it. |
| `particles` | `ParticlePool` | once | From `Effects.pool`. |
| `lights` | `LightPool` | once | From `Effects.lights` (`client/game/lights.md`). |
| `vision` | `Vision` | once | The local player's fog of war, from `startClient` through `startLoop` (`client/game/vision.md`). |
| `time` | number | `fillFrame` | Seconds. Shaders animate from it. |
| `guide` | `GuideView \| null` | `fillFrame` | What the tutorial points at, from `guide.view()`. Null with no tutorial or no lockstep. The pick scene and backdrop frames set it to null. |

## Rules

- `Frame` is read-only for render code. Do not write to `world`, `selected` or `cam` from a pass. One exception: `Renderer.prepare` replaces the held lights in `lights` each frame (`client/render/lights.md`).
- Do not keep references to `frame.world` units across frames. The sim mutates them in place.
- Do not allocate per frame in passes. Reuse buffers (`InstanceBuffer`, `PoseTable`).
- The match `frame.world` is a dummy until the first `fillFrame`. `Renderer.draw` gets the match frame only when a lockstep exists, and the backdrop frame otherwise (`client/app/backdrop.md`), so `world` is always valid inside a pass.

## Not in Frame

- The `SmokeField` is owned by `Renderer` (`client/game/smoke.md`).
- The pose table is owned by `Renderer`. It is built from the frame in `prepare`.
- The sun and shadow map are owned by `Renderer`.

## Add a field

1. Add it to `Frame`.
2. Give it an initial value in `startLoop`.
3. Set it in `fillFrame` if it changes per frame.
