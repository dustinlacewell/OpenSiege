Source: apps/client/src/game/lights.ts

# Lights: the light pool

`LightPool` holds the realtime lights of explosions, muzzle flashes, shells and work beams. It is pure: no GL, no clock. Up to `MAX_LIGHTS` (512) reach the shaders each frame. Lights add up. They cast no shadows.

## A light

A capsule from A to B. A point light has A == B. `radius` is where the light falls to 0, in world units. `rgb` is peak linear HDR radiance (the sun is 3.0).

## Timed lights

`spawn(x, y, z, radius, rgb, life, curve, holdFor = 0.5)` makes a point light that lives `life` seconds.

- `"decay"`: `(1 - u)^3`, with `u = age / life`. A fast fall from full.
- `"hold"`: full until `u = holdFor`, then a straight ramp to 0 at `u = 1`.

`advance(dt)` ages them and swap-removes the dead, as `ParticlePool` does.

## Held lights

`hold(ax, ay, az, bx, by, bz, radius, rgb)` makes a light for one frame at full strength. `beginFrame()` drops all held lights. The caller holds them again each frame and applies its own flicker.

## pack

`pack(out, vision, max = MAX_LIGHTS)` writes lights into `out` and returns the count.

- Strength is `max(r, g, b) · fade · radius`. The strongest `max` lights win, written strongest first. Tile binning relies on this order (`client/render/light-tiles.md`).
- A light whose midpoint `vision.sees` rejects is skipped.
- Each light is `FLOATS_PER_LIGHT` (12) floats, three vec4: `[A, radius]`, `[B, 0]`, `[rgb · fade, 0]`.

`LIGHT_BUFFER_FLOATS` is the size of a buffer for `MAX_LIGHTS` lights.

## Who adds lights

- `explosion` and `muzzleFlash` in `explosions.ts` spawn timed lights (`client/game/effects.md`).
- `holdShellLights` in `shellLights.ts` holds one point light per shell in flight (`client/render/lights.md`).
- `WorkBeamsPass.prepare` holds one capsule per work beam (`client/render/lights.md`).
