Source: apps/client/src/game/interp.ts, apps/client/src/game/poses.ts, apps/client/src/game/visiblePoses.ts

# Interpolation and unit poses

The sim moves in 100 ms steps. The view draws at display rate. `poses.ts` produces what to draw each frame.

## interp.ts

- `PrevPose` = `{ x, y, facing, aim, elevation }`: a unit before the last step. `PrevShot` = `{ x, y, z }` in fixed point.
- `lerp(a, b, t)`.
- `shotAt(out, shell, prev, alpha)`: the shell's drawn position in world units, lerped from `prev` (fixed point) at `alpha` clamped to 0..1. No `prev` gives the current position. `ProjectilesPass` and the shell lights both use it.
- `launchPoint(shell)`: where a shell launched this step left the barrel, fixed point. The sim launches a shell and flies it one tick in the same step (pos += v, then `vz -= GRAVITY`), so this is `pos - (vx, vy, vz + GRAVITY)`. `Lockstep` seeds `prevShots` with it (`client/game/lockstep.md`), so a new shell is drawn from the tip at `alpha` 0.
- `facingDelta(from, to)`: shortest signed turn in angle steps.
- `lerpAngle(from, to, t)`: interpolates angle steps the short way and returns **radians**.
- `facingToRadians(steps)`: `steps / ANGLE_STEPS * 2π`. Radian 0 is `+x`. π/2 is `+y` (`sim/coordinates.md`).

## UnitPose

One per unit per frame: `{ unit, x, y, z, yaw, aim, pitch, roll, siege, gun }`. Angles are radians.

- `fillPoses(table, world, prev, alpha)` fills a reusable `PoseTable`. `poses[0..count)` are valid. Slots are reused, so do not keep a `UnitPose` across frames.
- Pose order is `world.units` order, which is sorted by id. `orderLines.ts` binary-searches poses by id and relies on that.

## How a pose is made

1. `place`: `x`, `y`, `yaw`, `aim` blend `prev` to now by `alpha`. With no `prev`, use the current values.
2. `settle`: `z = heightAt(x, y)`. `pitch` and `roll` come from four height samples at 0.8 of the unit radius ahead, behind, left and right. `atan` of the rise over the run. Pitch follows the heading. Roll follows the side.
3. `siegeProgress`: 1 when sieged, 0 when mobile. While deploying or packing, `modeTimer` (minus `alpha`) over `siegeTicks`, running 0 to 1 when deploying and 1 to 0 when packing.
4. `gunPitch`: `elevation` blends `prev` to now by `alpha`, then becomes the barrel pitch in the tilted turret frame, measured from the kind's rest elevation (`client/game/gun-pitch.md`).

`z` is not interpolated. It is computed from the interpolated `x, y`, so a unit hugs the ground between steps.

## Readers

`Renderer.prepare` calls `keepVisible` right after `fillPoses`. It keeps only units the player sees and keeps id order (`client/game/vision.md`). All readers below see only shown units.

- `render/units.ts` and `render/contactShadows.ts` write poses into instance buffers.
- `render/overlay.ts` places rings and bars from poses.
- `game/orderLines.ts` draws lines from pose positions.

## Invariants

- Poses are read-only views of the sim plus the saved previous state. They never write the world.
- `alpha` is clamped to 0..1 in `fillPoses`.
- Interpolation is visual only. Picking uses the sim position `u.x, u.y`, not the pose (`client/game/picking.md`). At most one step of difference.
