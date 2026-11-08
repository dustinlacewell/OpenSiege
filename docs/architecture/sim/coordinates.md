Source: packages/sim/src/stats.ts, packages/sim/src/mapSize.ts, packages/sim/src/math.ts, packages/sim/src/types.ts, packages/sim/src/launch.ts, packages/sim/src/systems/projectiles.ts

# Coordinates, angles and fixed point

## World axes

- `x` and `y` are the ground plane. `z` is up (height).
- The map is a rectangle from 0 to `width` on `x` and 0 to `height` on `y`. The world carries both (`sim/map-spec.md`). `mapSize(terrain)` gives them. `clampX(m, v)` and `clampY(m, v)` clamp one value.
- A unit has `x` and `y` only. Its ground height is `heightAt(terrain, x, y)` (`sim/terrain.md`).
- At camera yaw 0 on screen: `+x` is right, `+y` is down the screen, `-y` is up the screen. See `client/game/camera.md`.
- All distances, radii, ranges and splash sizes are world units.
- Speeds (`speed`, `shotSpeed`) are world units per tick.

## Angle steps

- `ANGLE_STEPS` = 256 steps per full turn. Angles are integers in `0..ANGLE_STEPS-1`.
- Step 0 points along `+x`. Step 64 (`ANGLE_STEPS / 4`) points along `+y`. Step 128 is `-x`. Step 192 is `-y`.
- `Unit.facing` is the hull heading. `Unit.aim` is the turret heading.
- `angleOf(dx, dy, fallback)` gives the step of a vector. It is linear inside each octant, so it is not true `atan2`. It returns `fallback` for a zero vector.
- `angleDelta(from, to)` is the signed shortest turn, in `-128..127`.
- `turnToward(from, to, max)` turns the short way by at most `max` steps.
- The client converts to radians with `steps / 256 * 2π` (`client/game/interpolation.md`). Radian 0 is `+x`. Radian π/2 is `+y`.

## Projectile fixed point

- `PROJ_FP` = 16. A `Projectile` stores `x, y, z, vx, vy, vz` in 1/16 world unit.
- World position is `p.x / PROJ_FP`. A unit position becomes shell position with `u.x * PROJ_FP`.
- `GRAVITY` = 24 is in 1/16 unit per tick squared. It is subtracted from `vz` once per tick.
- `Projectile.damage`, `splash` and `ttl` are plain (not fixed point). `ttl` is in ticks.
- Shells use fixed point so slow arcs stay smooth in integers.

## Time

- `TICK_MS` = 100. A tick is the only time unit in the sim.
- Timers (`cooldown`, `modeTimer`, `lastFired`, `ttl`, `BuildJob.progress`, `buildTicks`) count ticks.
- `lastFired` counts up from 0 on a shot and stops at 255. The client uses it to draw muzzle flashes.

## Percent and scaled integers

- `siegeArmor` is a percent. Damage taken is `amount * armor / 100`.
- Slope speed uses percent (`slope.ts`).
- Formation axes use a scale of 1024 (`formation.ts`). Factory exit directions use a scale of 1000 (`production.ts`).
