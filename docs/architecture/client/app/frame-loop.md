Source: apps/client/src/app/frameLoop.ts, apps/client/src/app/start.ts

# The frame loop

`startLoop(parts)` is called once by `startClient` (`client/app/start.md`). It runs one `requestAnimationFrame` callback and returns a cancel function. `startClient`'s `stop()` calls it.

`LoopParts` holds the canvas, `session`, `cam`, `input`, `renderer`, `hud`, `vision`, `sounds`, `autoSiege`, `autoSiegeOn()`, `renderScale()`, `drawPick(now, cam, terrain)` and an optional `guide` (default `NO_GUIDE`). The loop builds the `Effects`, the `Backdrop` (`client/app/backdrop.md`), the `PickScene` (`client/app/pick-scene.md`) and the `GuideCamera`.

## Each frame

`dt` is seconds since the last frame, capped at 0.1.

1. `fitView`: `renderer.fit(dpr)` resizes the drawing buffer. If the canvas CSS size changed, `resize(cam, w, h)`. `dpr` is the device pixel ratio times `renderScale()`.
2. `input.update(dt)`: keyboard and edge panning.
3. If a lockstep exists (`session.lockstep`):
   - `ls.update(now)`: steps any due turns.
   - If the terrain watch has a dirty box, `refreshTerrain` hands it to the renderer, the vision and the HUD.
   - `session.pruneSelection()`: drop dead ids.
   - `guide.update()`: the tutorial moves on when its step is done (`client/game/tutorial/core.md`).
   - `autoSiege.update(...)` (`client/game/auto-siege.md`). It is off for a spectator, a viewer and when `autoSiegeOn()` is false.
   - `goHome` once per session (`session.homed`): centre the camera on the player's first factory.
   - `guideCam.update(...)`: the tutorial's camera glide (`client/game/tutorial/camera-glide.md`).
   - `vision.update(world, me, now / 1000)` (`client/game/vision.md`). `revealAll` follows `session.overview`.
   - `effects.update(world, prev, dt)`: particles from what changed.
   - `sounds.update(...)`: sounds from what changed (`client/audio/events.md`).
   - Else `frame.guide` is null.
4. `followGround(cam, terrain, dt)`: eases camera height and rebuilds the matrices.
5. Draw one of three scenes:
   - A lockstep exists: `fillFrame` then `renderer.draw(frame)`.
   - Else a pick world exists: `pickScene.update`, `renderer.draw(pickScene.frame)`, then `drawPick` (the panel and the markers, `client/ui/pick.md`).
   - Else `backdrop.update(now, dt, dpr, cam)` then `renderer.draw(backdrop.frame)`. `cam` only gives the canvas size.
6. `hud.update(now)`.

## Frame object

One `Frame` is created once and mutated each frame (`client/render/frame.md`). `fillFrame` sets `world`, `prev`, `prevShots`, `alpha`, `me`, `selected`, `dpr`, `time`, and `guide` from `guide.view()`. With no lockstep, `guide` is null. `cam`, `particles` and `vision` are set once.

## Invariants

- The order matters. Lockstep steps before effects, so `Effects` sees the new tick. The camera matrices update before draw and before the HUD minimap reads them.
- Matrices are rebuilt in `followGround`. Input code that changes the camera must not assume the matrices are current until the next frame, except `zoomAt`, which calls `updateMatrices` itself.
- `time` is `now / 1000` seconds. Shaders animate from it.

## Add a per-frame step

Add it in `tick` at the right position. Keep it a call into a named object. Do not put logic in the loop.
