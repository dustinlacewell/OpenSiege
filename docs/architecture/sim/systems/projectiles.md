Source: packages/sim/src/launch.ts, packages/sim/src/muzzle.ts, packages/sim/src/arc.ts, packages/sim/src/systems/projectiles.ts, packages/sim/src/impact.ts, packages/sim/src/damage.ts, packages/sim/src/features/featureHit.ts, packages/sim/src/features/featureDamage.ts

# Projectiles

## Launch (`launch.ts`)

`aim(world, shooter, target)` returns the plan: a `Firing` `{ arc, from }` with the barrel on the bearing, or undefined when the gun cannot reach. `arc` is an `Arc` (velocity, flight time `T`, elevation). `from` is the barrel tip it starts from. Target choice (`canFire`) and `u.elevation` use the plan.

`aimFrom(world, shooter, target, bearing, slope)` returns the shot from the barrel as it stands: one solve from the tip at `bearing` and `slope`. Combat fires with it, from the barrel at the start of the tick (`sim/systems/combat.md`). The plan and the shot can disagree: the plan has an arc and the shot has none. Then the gun holds fire.

`launch(world, shooter, firing, damage)` pushes one `Projectile` at `from` on `arc`. All fixed point (`sim/coordinates.md`).

- Barrel tip (`muzzle.ts`): `muzzleTip(u, terrain, aim, slope)`, with `u` the unit's kind, position, facing and mode. It places the breech pivot the way the client's unit shader does:
  1. Pivot in the hull frame: `(gunX · cos t, gunX · sin t, gunZ − sink)` with `t = aim − facing`. `sink` applies only when `mode` is `sieged`; weapons fire only mobile or sieged.
  2. Tilt by the hull slopes (`sim/hull-slope.md`): roll by `side`, then pitch by `fwd`. Each rotation uses `cos = 1000 / hyp`, `sin = slope / hyp` with `hyp = isqrt(1000² + slope²)`. No trig.
  3. Turn by the hull `facing` (`cosStep`/`sinStep`, `trig.ts`), then add the unit position and its ground height.

  The tip is the pivot plus the barrel: `gunLength` along `aim` at `slope` permille in the world. Integer math, truncated. A kind with `gunLength` 0 fires from its centre at ground + 70% of `height`.
- Repeated passes: the tip depends on the elevation, and the elevation on the arc from the tip. `aim` solves from the tip at rest (`pitchSlope(gunRest)`), then re-solves from the tip raised to the last arc's elevation. It stops when the arc's elevation is within `AIM_SETTLE` (2 permille) of the tip's, or after `AIM_PASSES` (8) solves. The last arc and its tip are the plan. A direct plan blocked at any pass has no arc. The plan's barrel bears on the target (`angleOf`), not on the current `u.aim`. `aimFrom` does not iterate: its tip is fixed by the barrel it is given.
- Every arc: `vx, vy` cover the distance in `T` ticks. `vz` is solved so the shell reaches the aim point after `T` ticks under gravity. The formula is exact for the flight loop below.
- `weapon: "direct"`: aims at the target's ground height plus half its `height`. `solveArc` picks `T` from the tip (below). `ttl` = `T + 5`.
- `weapon: "ballistic"`: aims at the target's ground point. `T` = `max(12, flat distance from the tip / shotSpeed)` ticks. No terrain check. `ttl` = `T + 20`.
- The shell takes its `splash` and `dig` from the shooter's stats.

## Direct arc (`arc.ts`)

`solveArc(terrain, from, to, shotSpeed, maxSlope)` returns the lowest arc that clears the terrain, or undefined.

1. The fastest flight: `T0 = max(1, ceil(flat distance / shotSpeed))`.
2. Try `T0`, then `ceil(T0 * (4 + i) / 4)` for `i` = 1..8, up to 3 × `T0`. Duplicates are skipped.
3. Reject a flight whose elevation (`vz * 1000 / ground speed`, permille) is above `maxSlope`. A downward shot always passes.
4. Reject a flight that touches the ground (`arcClear`). It replays the flight loop substep by substep with the same ground test as contact. It skips only the last substep, which is the aim point. Units and features are ignored.

`maxSlope` = `pitchSlope(maxPitch)`. `pitchSlope` reads a table of whole degrees 0..89, built once at module load, so the sim never calls trig per tick.

## Flight (`systems/projectiles.ts`)

For each shell in id order, once per tick:

1. Split the move into `n` substeps so none is longer than 25 world units on the ground (`substeps` and `MAX_SUBSTEP` in `arc.ts`).
2. After each substep, test contact (below).
3. After all substeps, `vz -= GRAVITY`. This applies to every shell, direct ones too. The arc solve accounts for it.
4. `ttl` decreases. At 0 the shell explodes where it is.

Contact, in this order:

- Off the map: the shell is removed with no impact.
- Ground: `z <= heightAt * PROJ_FP`. Impact with no direct hit.
- Unit: the first unit (index order, `hp > 0`) whose body holds the shell, any owner but the shooter unit itself (`Projectile.shooter`, a unit id). Horizontal distance within `radius`, and `z` between the unit's ground and ground + `height`. Allies and the shooter's other units block.
- Feature (direct shells only): `featureHit` finds a rock or boulder the substep enters (`sim/features/effects.md`). Impact with `struck` set.

Removed shells leave `world.projectiles`. The list is rebuilt each tick, so it stays sorted.

## Impact (`impact.ts`)

`impact` builds a `Blast` from the shell and calls `detonate` (`blast.ts`). At the start of each tick `projectiles` also detonates the death blasts that `deaths` queued in `world.blasts`, then clears the list. Every blast hurts every unit in its radius. The rules below are those of `detonate`.

- The unit hit takes full `damage`. A feature struck takes full `damage` too (nothing if it cannot be destroyed).
- Every other unit within `splash` takes `damage * (splash - d) / splash`, where `d = isqrt(dist2)` from the impact point. It must be `d < splash`.
- Every feature within `splash` of its edge takes the same falloff (`splashFeatures`).
- No unit is spared: the shooter's own units and allies take the falloff too.
- `applyDamage` multiplies by `siegeArmor / 100` for a sieged target.

## Client reads

`prevShots` and `ShotTracker` follow shell ids. A shell that vanishes becomes an explosion (`client/game/effects.md`). `render/projectiles.ts` draws shells with `source` picking the look.
