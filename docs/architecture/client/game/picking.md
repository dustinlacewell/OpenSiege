Source: apps/client/src/game/picking.ts, apps/client/src/game/zoom.ts

# Picking and projection

Turns screen pixels into world points and units. Pure functions over `Camera`, `Terrain` and unit lists. No DOM.

## Functions

- `project(cam, x, y, z, out)`: world point to CSS pixels. Returns false if the point is behind the camera.
- `groundAt(cam, terrain, sx, sy, out)`: the ground point under a pixel. Returns false if the ray points at or above the horizon.
- `unitAtScreen(cam, terrain, units, vision, sx, sy, slackPx, accept)`: the nearest accepted unit whose projected centre is within its projected radius plus `slackPx`.
- `unitsInRect(cam, terrain, units, vision, rect, accept)`: ids of accepted units whose projected centre is inside the rect (any corner order).
- `unitsOnScreen(cam, terrain, units, vision, accept)`: same with the whole viewport.

`unitAtScreen` and `unitsInRect` skip units that `vision.shows` rejects, before `accept`. So an enemy out of sight or on radar only can never be clicked or boxed (`client/game/vision.md`). Own units always pass. The caller passes the `Vision`; `createActions` gets it from `main.ts`.

## groundAt method

1. Unproject the pixel at the near and far clip planes with `invViewProj`. This gives a ray.
2. March down the ray in steps of `MARCH_STEP` (60) through the terrain height band (0 to `TERRAIN_MAX_HEIGHT`).
3. At the first step below `heightAt`, bisect 10 times, then set `z = heightAt` at the hit.
4. If there is no hit, fall back to where the ray crosses `z = 0`. With a null terrain it uses the floor plane.

## Unit hit shape

A unit is a disc on screen. Its centre is the sim position `(u.x, u.y)` at ground height plus half the model `height`. Its radius is the projected distance of `UNIT_STATS.radius` in the world `+x` direction. Picking uses the sim state, not the interpolated pose.

## Invariants

- Module-scope scratch vectors (`origin`, `dir`, `clip`, `at`, `edge`) hold temporary values. The functions are not reentrant. Do not call one from inside `accept`.
- `out` vectors are written, never allocated.
- `groundAt` returns a point on the ground even outside the map. Callers that need the map should clamp (the sim clamps in `move`).

## Callers

`input/actions.ts` (select, command), `ui/minimap.ts` (camera footprint), `game/zoom.ts` (zoom anchor).
