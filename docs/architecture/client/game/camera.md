Source: apps/client/src/game/camera.ts, apps/client/src/game/mat4.ts, apps/client/src/game/zoom.ts, apps/client/src/render/cameraAxes.ts, packages/sim/src/mapSize.ts

# Camera model

An RTS camera that orbits a ground point. One mutable `Camera` object is shared by input, picking, the HUD and the renderer.

## State

- `x, y`: the look-at ground point. `z`: look-at height. It eases toward `heightAt(x, y)` in `followGround`.
- `dist`: distance from the look-at point to the eye. Clamped to `MIN_DIST` 600 .. `MAX_DIST` 14000.
- `yaw`: radians around the look-at point. 0 looks toward `-y`.
- `tilt`: a user pitch offset. `pitch`: derived, never set directly.
- `width`, `height`: the canvas in CSS pixels.
- `map`: the map's `MapSize` (world width and height). `{0, 0}` until `setCameraMap(cam, map)`. That call sets it and centres the look-at point on the map. Every path that sets a world calls it, else the camera stays pinned at the origin. `clamp` keeps `x` and `y` inside `0..map.width` and `0..map.height` (`clampX`, `clampY` from `@mf/sim`).
- Derived each `updateMatrices`: `eye`, `right`, `up`, `back`, `view`, `proj`, `viewProj`, `invViewProj`.

## Axes

At yaw 0:

- Screen right is world `+x`.
- Screen up on the ground (away from the camera) is world `-y`. Down the screen is `+y`.
- World `z` is up.

Generally: screen right on the ground is `(cos yaw, sin yaw)`. Away from the camera is `(sin yaw, -cos yaw)`. A positive yaw turns the view clockwise seen from above.

## Pitch

`pitch = clamp(autoPitch(dist) + tilt, 25°, 85°)`. `autoPitch` goes from 45° at `MIN_DIST` to 65° at `MAX_DIST`, along a square root curve. `addTilt` keeps the final pitch in range. Field of view is 40° vertical. Near plane is `max(5, dist * 0.05)`. Far plane is `dist * 3 + 12000`.

## Basis and matrices

`back = (-fx·cos p, -fy·cos p, sin p)` where `(fx, fy)` is the ground forward and `p` the pitch. `eye = lookAt + dist · back`. `viewFromBasis` stores `right`, `up`, `back` as the rows of the view matrix. Matrices are column-major `Float32Array` (`mat4.ts`). All `mat4.ts` functions write into `out`. `out` must not alias an input for `multiply`.

## Operations

`setCameraMap`, `pan`, `centerOn`, `setDistance`, `rotate`, `addTilt`, `resize`, `followGround`, `updateMatrices`, `worldPerPixel`. `zoomAt(cam, terrain, sx, sy, factor)` in `zoom.ts` zooms and shifts the look-at point so the ground under the cursor stays fixed.

## How render reads the axes

`render/cameraAxes.ts` copies view-matrix rows 0 and 1 into `right` and `up`. These equal `cam.right` and `cam.up`.

- `BillboardProgram` and `SmokePass` pass them as `u_right` and `u_up`. Camera-facing quads offset a point by `u_right · x + u_up · y`.
- Flat rings ignore them and lie in the ground plane.
- Everything else reads `cam.viewProj`. The sky and the shadow fit read `cam.invViewProj`. Fog reads `cam.eye` and `cam.dist`.

## Invariants

- After you change `x, y, dist, yaw, tilt` or the size, call `updateMatrices` before you read a matrix. `followGround` does it once per frame.
- `rotate` changes yaw only. The sim and the match messages do not know the camera.
