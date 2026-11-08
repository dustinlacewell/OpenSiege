Source: packages/sim/src/guard.ts, packages/sim/src/holdBand.ts, packages/sim/src/patient.ts, packages/sim/src/systems/movement.ts, packages/sim/src/systems/combat.ts, packages/sim/src/systems/repair.ts, packages/sim/src/stats.ts

# Guard

A `guard {target, chase}` order keeps a unit near an own unit and makes it help that unit. There is no guard system. `guard.ts` holds the rules. `movement`, `combat` and `repair` call it when the head order is `guard`.

## Tunables (`stats.ts`)

- `GUARD_LEASH` (250): the guard drives back when the gap to the target is more than this.
- `GUARD_RETURN` (120): a following guard stops when the gap is this or less.
- `GUARD_MARGIN` (200): how far past the leash a guard may go to engage or repair.
- `GUARD_RANGE` (700): guards help against enemies and heal friendlies within this distance of the target.

A gap is a centre distance minus both radii. So the leash is `GUARD_LEASH + both radii` as a centre distance. The cap is the leash plus `GUARD_MARGIN`.

## Picks (`guard.ts`)

- `guardedUnit(world, u)`: the target of the head guard order, if it exists and has `hp > 0`.
- `guardEnemy`: the enemy of the guard, one its team detects (`seen`, `sim/detection.md`), nearest to the target, within `GUARD_RANGE` of the target. A tie goes to the lower id. An optional `accept` must pass too; combat passes "in reach and `canFire`" (`sim/fireable.md`). The close-on-threat goal passes none.
- `guardPatient`: the most hurt patient of the engineer within `GUARD_RANGE` of the target, the target included. Most hurt means the lowest `hp / maxHp`, compared by cross-multiplying. A tie goes to the lower id. Patient means `isPatient` (`patient.ts`), the same rule `repair` uses.

## Where the guard drives: `guardGoal`

`movement` calls it once per tick for a guard head. It returns a point, a back-off, or nothing to stand still.

1. The job. An engineer's job is its patient. Its reach is `MOBILE_REPAIR_REACH` (200), or `workRange` when sieged. An armed unit's job is its enemy (`guardEnemy`, no `accept`). Its reach is its current weapon range. Its `near` is `holdBand(weapon range, minRange).near` (`holdBand.ts`), the same near edge attack uses, from the flat weapon range. Factories and harvesters have no job, and engineers have `near` 0.
2. With a job:
   - Nearer the enemy than `near`: back off `{away: enemy, gap: near}`. This wins over the leash. `movement` drives a mobile guard straight away to `near` (`sim/systems/movement.md`). A sieged guard does not move.
   - Else stand when the job is in reach and the guard is inside the cap.
   - Else drive to the job, pulled in to the cap circle around the target. When that point is nearer the job than `near`, it moves out to `near` from the job, toward the target. That point is inside the cap, because the enemy is within `GUARD_RANGE` of the target. So the leash pull never drives back inside `near`, and back-off and pull do not alternate. Stand once within one own radius of the point.
   - `minRange` 0 gives `near` 0, so nothing changes for those units.
3. Without a job: follow. Past the leash, `chase` becomes true. Inside `GUARD_RETURN`, it becomes false.
   - Past the leash: the guard drives at the target at its full speed.
   - Inside the leash, target drives: the guard drives at the target with its speed capped at the target's stat `speed`. At or inside `GUARD_RETURN` it stands. So it keeps pace instead of stop-go.
   - Inside the leash, target does not drive: the guard drives at full speed while `chase` is true, else stands. The gap between the two limits stops stutter.

The target drives when it is `mobile` and its head is one of these:

- a `move`.
- a `guard` with `chase` true.
- an `attack` or `engage` with `hold` false.

An `engage` or `attack` with `hold` true stands, so its guards stand too. A guard that follows inside its leash does not count. This reads only the head order and mode, so it is the same on every peer and survives a snapshot. It does not read this tick's weapon result. The sim keeps no last-tick motion, so the stat speed stands in for it.

The cap feeds `stepToward` as its base speed. Turn and slope rules apply on top (`sim/systems/movement.md`).

Separation spreads a crowd of guards, which count as movers (`sim/systems/separation.md`).

## Movement (`movement.ts`)

- A dead or gone target pops the order, in any mode. The queue then advances.
- When there is a point goal and the guard is sieged or deploying, it starts packing (`sim/systems/siege-modes.md`). A mobile guard drives with `stepToward`, at the goal's speed cap if it has one.
- A back-off goal moves only a mobile guard, with `backOff`. An anchored guard ignores it and does not pack, as for attack.
- Guards never deploy on their own. A guard that stays in reach stays sieged.

## Combat and repair

- `combat`: target choice is the `attack` or `engage` head, else the guard's enemy in weapon reach that it can fire on, else the nearest such enemy (`sim/systems/combat.md`).
- Guards only fire. A guard never starts an engagement. Its weapon never stops its hull. The close-on-threat goal in `guardGoal` is the only way a guard moves toward an enemy. A guard whose charge is in an engage keeps near the charge, because it reads the charge's head order.
- `repair`: a mobile engineer heals the guard's patient if it is within `MOBILE_REPAIR_REACH`, else the nearest patient as before. A sieged engineer heals all in `workRange` as before (`sim/systems/repair.md`).

## Invariants

- The order is done only when the target dies or goes. Nothing else ends it.
- `chase` is part of the order, so it is hashed and snapshotted with it.
- All picks use the `before` grid and check exact distance.
