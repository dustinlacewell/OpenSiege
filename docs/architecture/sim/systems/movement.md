Source: packages/sim/src/systems/movement.ts, packages/sim/src/fireable.ts, packages/sim/src/features/featureSlow.ts, packages/sim/src/nav/route.ts, packages/sim/src/nav/slide.ts, packages/sim/src/slope.ts, packages/sim/src/terrain/water.ts, packages/sim/src/trig.ts, packages/sim/src/orders.ts, packages/sim/src/guard.ts

# Movement

`movement(state, grid, seen, m)` runs for every unit in id order. `state` is the `SimState` (`sim/nav/nav-grid.md`). `m` is the map size. Only `mobile` units walk. Units in any other mode stay put. `grid` is the `before` grid. `seen` is the tick's detection (`sim/detection.md`). Only guards read them: a guard closes only on an enemy it detects (`detectionFor`, `sim/systems/guard.md`).

## Orders

The unit follows the head of `orders` (`sim/orders.md`). An empty list means idle.

- `move {x, y, group}`: a `mobile` unit plans a path on its first drive (`planPath`), then asks `routeAim` for the point to aim at (`sim/nav/pathfinding.md`) and walks to it with `stepToward`. The point is a look-ahead point on the planned waypoints, which drive around blocked ground. On reaching the last waypoint (the spot, or the nearest open cell to a blocked spot), or after a stall, the unit calls `arrive` (`sim/systems/arrival.md`), which pops the order. An anchored unit does not walk. `modes` packs it first (`sim/systems/siege-modes.md`).
- `move` with `attack` (attack-move): it drives its route like a plain move, always. Movement never reads the weapon result. Weapons fire on the way. The `engage` system puts an `engage` order in front when an enemy is near, and that order stops the unit (`sim/systems/engage.md`). Arrival rules do not change.
- `attack {target, hold}` and `engage {target, hold}`: one rule for both, "close on target". A `mobile` unit drives straight at the target (no path; the target moves) and obeys the block rule. A target that is missing or has `hp <= 0` pops the order. That happens in any mode, so a dead target never blocks the queue. The rule has a dead band:
  - `d` is the centre distance to the target. `range` is the effective range, height included (`sim/targeting.md`).
  - The hold band is `holdBand(range, minRange)` (`holdBand.ts`): `far = holdRange(range) = range - floor(range / 8)`; `near = minRange + floor(minRange / 8)`, capped at `far`. `minRange` 0 gives `near` 0.
  - Stop: when `d <= far`, set `hold = true`.
  - Start: when `d > range`, set `hold = false`.
  - Between the two, `hold` keeps its value. A target on the edge of range does not make the unit flicker. A target that keeps leaving range is followed at pace.
  - Back off: when `d < near`, the unit drives straight away from the target, aiming at the point `near` from it, with `stepToward`. This wins over `hold`. It stops at `near`, inside the band, so it never flips with the closing rule. The order keeps running. No path: a blocked step slides as any step does. A sieged unit does not back off.
  - Else the unit drives only while `hold` is false.
  - Close for an arc (`attack` only): a holding unit with no firing solution (`canFire` false, `sim/systems/combat.md`) keeps driving straight at the target. It aims at the point `gap` from the target, `gap = max(near, own radius + target radius)`, with the same `backOff` step. It stops when `canFire` is true or at `gap`. `canFire` runs only for a holding attack. Once it can fire it holds. If it loses the arc later it closes again. `engage` and `guard` do not close: they drop a target with no arc and pick another.
  - An unarmed unit has no range. It keeps the contact rule: it drives until `d <= own radius + target radius`.
- `guard {target}`: a missing or dead target pops the order, in any mode. Else `guardGoal` gives a point, a back-off, or nothing (`sim/systems/guard.md`). With a point, an anchored unit starts packing and a `mobile` unit walks to it with `stepToward`, straight, obeying the block rule. The point may carry a speed cap. A back-off names an enemy and a gap: a `mobile` unit runs the same `backOff` as attack. An anchored unit stays put and does not pack.
- `reclaim {target}`: a gone scrap, or one with no hp, pops the order, in any mode. In reach it stands still. Out of reach an anchored unit starts packing and a `mobile` one walks at the scrap centre with `stepToward` (`sim/systems/reclaim.md`).
- `siege {on}`: movement does nothing. `modes` runs it.

## stepToward

The hull turns at a limited rate. The unit drives along its facing, not straight at the goal. So it moves in arcs.

1. `d = isqrt(dx² + dy²)`. `bearing = angleOf(dx, dy, facing)`.
2. `facing = turnToward(facing, bearing, turnRate)`: the short way, at most `turnRate` steps.
3. `error = |angleDelta(facing, bearing)|`: the angle still left to turn.
4. Turn speed: the base speed times a percent of `error` (below). At least 1. The base speed is the unit's `speed`, or `min(speed, cap)` when the caller gives a cap. Only a following guard gives one (`sim/systems/guard.md`).
5. Feature slow: the turn speed times `slowPercentAt` for the unit's centre, percent, at least 1 (`sim/features/effects.md`). A tree slows `light` units to 55%. 100 in the open.
6. Water slow: if the unit's centre is in water (`inWater`), the speed times `waterSpeed`, percent, at least 1 (`sim/water.md`).
7. `speed = slopeSpeed(...)` on that speed, along the facing.
8. If `d <= speed`: the new position is the point. Else, if `error` is 0, step along the exact line: add `trunc(dx * speed / d)` and `trunc(dy * speed / d)`. Driving the quantised facing drifted off the line, the bearing slipped a step, and the hull flipped between two steps (a left-right wiggle). Else add `trunc(cos(facing) * speed / 2^14)` and the same with `sin` for `y`. Clamp to the map.
9. `slide` the step against the nav grid of the unit's move class (`sim/nav/nav-grid.md`, "The block rule"). A unit on open ground never ends in a blocked cell. Return true when `d <= speed` and the slide did not change the point.

Before step 1, a unit inside a blocked cell swaps the point for the centre of the nearest open cell (`escapeAim`). That holds for every order that calls `stepToward`. Such a step never returns true.

## Turn speed

- `error` 0 gives 100%. The percent falls linearly to 50% at 43 steps (about 60°).
- Above 43 steps: 12%. The unit turns nearly in place.
- Near the goal, `error` above 21 steps also gives 12%. Near means `d * turnRate < speed * 128` (about half a turn's travel). A look-ahead aim sits one turn radius ahead, inside that range, so a sharp corner slows the hull. This stops a unit from circling a goal it cannot turn into.

## Trig (`trig.ts`)

- `sinStep` and `cosStep` take any angle in steps. They return a value scaled to `TRIG_ONE` (2^14).
- They read a literal table of 65 quarter-wave sine values. The table is not computed at runtime, because `Math.sin` differs across engines.

## Slope speed (`slope.ts`)

- `run` = `min(d, speed)`. `rise` = height at the end of the step minus height here.
- `grade` = `rise * 100 / run`, floored.
- Uphill: speed percent falls from 100 to 45 as grade rises to 40.
- Downhill: speed percent rises from 100 to 115 as grade falls to -40.
- The result is at least 1.

## Invariants

- Only integer math. `slopeSpeed` returns `speed` when `d` is 0.
- `facing` changes only while stepping. It turns at most `turnRate` steps per tick. A unit that does not move keeps its facing. Separation pushes do not change it.
- Movement does not avoid other units. `separation` pushes them apart afterwards (`sim/systems/separation.md`).

## Change walking speed

Edit `speed`, `turnRate` and `waterSpeed` in `data/unitStats.json` or the stat editor (`sim/stats.md`). For the turn slowdown, edit the constants in `movement.ts`. For slope effects, edit `slope.ts`.
