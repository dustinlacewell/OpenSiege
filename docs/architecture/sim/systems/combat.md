Source: packages/sim/src/systems/combat.ts, packages/sim/src/weapons.ts, packages/sim/src/launch.ts, packages/sim/src/fireable.ts, packages/sim/src/orders.ts, packages/sim/src/guard.ts, packages/sim/src/detection.ts

# Combat

`combat(world, grid, seen)` runs once per tick, for every unit in id order. The grid is the `before` grid. `seen` is the tick's detection (`sim/tick-order.md`, `sim/detection.md`). Each unit picks by `detectionFor(u, seen)`: `everything` for a mine, else `seen`.

## Per unit

A unit with `hp <= 0` is skipped whole: no timers, no target, no shot. It waits for `deaths`.

1. `tickTimers`: `cooldown` counts down to 0. `lastFired` counts up to 255.
2. Save the barrel as the tick found it: `was = { aim, elevation }`.
3. `weaponOf(u)`: the weapon for the current mode, or none.
4. `pickTarget`: only if there is a weapon.
5. `aim` (`launch.ts`): the plan. The ideal arc to the target with the barrel on the bearing, or none (`sim/systems/projectiles.md`).
6. `u.target = target.id`, or 0. `u.elevation` = the plan's elevation, `direct` or `ballistic`, else 0.
7. Bearing: `angleOf` toward the target, else `u.facing`.
8. `u.aim = turnToward(aim, bearing, TURN_RATE)`. `TURN_RATE` = 12 steps per tick. Even unarmed units and units in transition run this.
9. Fire when there is a weapon, a target, a plan, `cooldown === 0`, `|angleDelta(was.aim, bearing)| <= AIM_TOL` (`TURN_RATE`, 12 steps: what the turret turns in one tick) and `|was.elevation − plan elevation| <= ELEV_TOL` (60 permille).

`fireFrom` solves the shot from the tip of the barrel `was` (`aimFrom`, `launch.ts`), at the unit's current `x`, `y`, `facing` and `mode`. If that tip has no arc, the unit holds fire this tick and keeps the target. Else it calls `launch`, sets `cooldown = reload` and `lastFired = 0`.

Why `was`: the client draws the first frame after a step at the state before the step (`client/game/interpolation.md`). Combat runs before movement, so the position, facing and mode are already that state. Only the aim and the elevation change in combat. A shell from the `was` tip leaves the barrel the player sees. The tolerances keep that barrel close to the plan. A new target costs at most one tick before the first shot.

## Target choice

- Every pick needs a target the shooter's team detects (`seen.detects`). An enemy in weapon range but out of every teammate's sight and radar is not a target. Sieged artillery outranges its own sight and radar, so it needs a spotter.
- If the head of `orders` is an `attack` or `engage` and that unit exists, has `hp > 0`, is detected and is in reach, it is the target. Only the head counts. An `attack` further back in the queue does not steer the weapon.
- Else, if the head is a `guard`: `guardEnemy`, the detected enemy nearest the guarded unit within `GUARD_RANGE` of it that is in reach and passes `canFire` (`sim/systems/guard.md`, `sim/fireable.md`). A blocked one is skipped for the next nearest.
- Else the nearest detected enemy in reach that passes `canFire` (`accept` of `nearestEnemy`). Enemy means a unit with `hp > 0` whose owner `isEnemy` of the shooter's owner (a different team, `sim/teams.md`). An enemy behind a hill that blocks every direct arc is skipped for the next one.
- Nearest means smallest squared distance. A tie keeps the first found (grid cell order).
- Reach and the nearest-enemy query come from `targeting.ts`, the same code that `engage` and `movement` use (`sim/targeting.md`). There is no second range.
- An `attack` target with no arc stays the target. The turret turns to it and the gun holds fire. Movement closes in until an arc exists (`sim/systems/movement.md`). An `engage` with no arc ends before combat runs (`sim/systems/engage.md`).
- Ballistic weapons have no terrain test. A hill blocks their shell only in flight.
- Target choice never picks an ally. Blasts still hurt allies and the shooter's own units (`systems/projectiles.md`).
- Every pick and reach test skips a target nearer than the weapon's `minRange` (flat distance). Artillery has 300.
- An attack or engage order on a target inside `minRange` makes `movement` back off to open the distance (`sim/systems/movement.md`). A guard order backs off the same way from its enemy (`sim/systems/guard.md`).

## Mines

A kind with `weapon: "mine"` has no shell. It hits by contact, so it needs no detection: it picks with `everything`. When `pickTarget` finds an enemy in reach (`range` mobile, `siegeRange` sieged), `combat` sets `hp = 0`. It skips the cooldown and the barrel tolerances. `deaths` then queues the unit's death blast, which is the damage (`deathDamage`, `deathRadius`). A mine that blows still counts as a viewer for the rest of the tick: `seen` was copied before combat. The blast hurts every team, the mine's own included. `damage` and `siegeDamage` only need to be above 0 to arm the unit. A sieged mine is a landmine.

## Notes

- Weapons are always on. They fire on any order, moving or not. Combat never stops the hull. Only an order can, through the goal it gives steering.
- An attack order does not make the unit stop. `movement` closes the distance (`sim/systems/movement.md`).
- An attack-move head (`move` with `attack`) picks like an idle unit: the nearest enemy in reach. `movement` does not read the `target` written here. The `engage` system, which runs just before combat, does the stopping (`sim/systems/engage.md`).
- `Unit.target` is written every tick for every unit. The client draws attack lines from it (`client/game/order-lines.md`).
- `lastFired < elapsed ticks` is how the client finds units that just fired (`client/game/effects.md`).

## Change a weapon

Edit the numbers in `data/unitStats.json` or the stat editor (`sim/stats.md`). For new weapon logic, extend `weaponOf` and `launch`. Keep `combat` as the orchestrator.
