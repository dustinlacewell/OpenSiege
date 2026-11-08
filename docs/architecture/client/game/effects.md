Source: apps/client/src/game/effects.ts, apps/client/src/game/explosions.ts, apps/client/src/game/lights.ts, apps/client/src/game/particles.ts, apps/client/src/game/shotTracker.ts, apps/client/src/game/muzzle.ts, apps/client/src/render/effects.ts

# Effects: explosions and muzzle flashes

Client-only eye candy. It reads the world after each step. It never writes it. It may use `Math.random` because the sim never sees it.

## Effects class

`Effects.update(world, prev, dt)` runs once per frame (from `app/frameLoop.ts`). `prev` is `Lockstep.prev`: each unit's pose before the last step (`client/game/interpolation.md`). Effects keeps no copy of it.

- A new `world` object (new `Lockstep`) resets the particle pool, the light pool and the tracker.
- When `world.tick` changed, `onTicks(world, prev, elapsed)` runs:
  - `ShotTracker.observe(world.projectiles, onGone)`: each shell id that was seen before and is gone now gets an explosion.
  - Each unit with `lastFired < elapsed` gets a muzzle flash. `elapsed` is the number of ticks since the last call, so a catch-up burst still flashes.
- Then `pool.advance(dt, terrain)` and `lights.advance(dt)`.

`Effects.lights` is a `LightPool` (`client/game/lights.md`).

## Explosion position

A vanished shell is placed at its last position plus one tick of velocity, `(s + v) / PROJ_FP`. Height is the larger of that and the ground. The ring and the sparks use `splash` for size.

## Death blasts

A dying unit leaves one entry in `world.blasts` for one tick. `DeathBlasts.take(world)` (`deathBlasts.ts`) turns each entry into an `explosion` request at `b / PROJ_FP`, not below the ground, with the blast `radius` as `splash`. It returns nothing the second time for the same tick. Sound needs no hook here: `audio/worldEvents.ts` already plays `destroyed` when a unit vanishes.

## ShotTracker

Remembers every shell in flight with a generation mark. `observe` is called once per new tick. It reports shells that were not seen in the new list. `SmokeField` has its own tracker (`client/game/smoke.md`).

## ParticlePool

`items[0..count)` are alive. Dead ones are swapped to the end and reused. Kinds: `GLOW` (soft camera-facing light), `RING` (flat ring on the ground), `SPARK` (small falling glow). Units are world units and seconds. Particles with `gravity` bounce on the ground.

## explosions.ts

`explosion(pool, lights, x, y, z, splash)`: two glows, a ring, `4 + splash/20` sparks, and a warm `"decay"` light of radius `3 · splash` that lives 0.45 s. `muzzleFlash(pool, lights, x, y, z, size)`: one short glow and a warm `"hold"` light of radius `4 · size` that lives 0.1 s.

## muzzle.ts

- `barrelOf(kind)`: the barrel geometry in turret space (+x forward) from the sim's `gun*` stats, or undefined when `gunLength` is 0. The unit meshes build from it (`client/render/unit-meshes.md`).
- `restElevation(kind)`: `gunRest` in radians, the elevation the mesh is modelled at (`client/game/gun-pitch.md`).
- `flashPoint(u, prev, terrain)`: the sim's `muzzleTip` out of fixed point. It uses the pose `prev` (x, y, facing, aim, elevation) and the unit's current `kind` and `mode`. The sim launches a shell from the pose the unit had at the start of the firing tick, so the flash shows where the shell starts, also for a moving or turning unit. With no `prev` (a unit that spawned this step) it uses the current pose. Size is `gunLength · 0.5`. Kinds with no gun do not flash.
- In a catch-up burst of several steps, `prev` is the pose before the last step only. A unit that fired in an earlier step of the burst flashes at that pose, not at its exact firing pose.

## Render side

`Frame.particles` is the pool. `Frame.lights` is the light pool (`client/render/lights.md`). `render/effects.ts` `EffectsPass` pushes each particle into one additive billboard batch (`client/render/billboards.md`).

## Recipe: add an effect

1. Add a spawn function in `explosions.ts` using `pool.spawn`.
2. Trigger it in `Effects.onTicks` from the data you need.
3. If it needs a new look, add a `kind` in `particles.ts` and a branch in `render/effects.ts` `push`.
