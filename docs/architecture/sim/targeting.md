Source: packages/sim/src/targeting.ts, packages/sim/src/stats.ts, packages/sim/src/detection.ts

# Targeting

`targeting.ts` holds the one target query. It is pure. It reads the world, a grid and a `Detection` (`sim/detection.md`). It writes nothing.

`combat`, `engage` and `movement` all call it. So the sim has one definition of "in range", height included. There is no second range.

## Functions

- `rangeTo(world, t, base, ground)`: the effective range to `t` from a shooter standing on `ground`. It calls `effectiveRange` in `weapons.ts`: the base range plus the shooter's height advantage, capped at +50%.
- `reach(world, u, t, base, ground, extra, min)`: the effective range to `t` when `t` is within it plus `extra` and no nearer than `min`, else undefined. `min` is the weapon's `minRange` (default 0). Both tests use flat squared distance.
- `nearestEnemy(world, grid, seen, u, base, ground, near, extra, skip, accept?, min)`: the enemy nearest to `u` within effective range plus `extra`, and no nearer than `min`. The grid query radius is `maxRange(base) + extra` (`weapons.ts`). An enemy is a unit with `hp > 0` whose owner `isEnemy` of `u.owner` (`sim/teams.md`) and that `seen.detects` for `u.owner`. `skip` is one enemy id to ignore. 0 means none. `accept`, when given, must also pass. It runs only for an enemy nearer than the best so far. Nearest means smallest squared distance. A tie keeps the first found (grid cell order).
- `densestEnemy(world, grid, seen, ..., blast, extra, skip, min)`: the same filter, but picks the enemy with the most detected enemies within `blast` of it.
- `holdRange(range)`: `range - floor(range / 8)`. This is where an attack or engage unit stops (`sim/systems/movement.md`).

## Callers

Every caller passes `detectionFor(u, seen)`: the tick's `seen` for most units, `everything` for a mine (`sim/detection.md`).

- `combat` calls `reach` and `nearestEnemy` with `extra` 0, `skip` 0, `min` = `minRange` and `accept` = `canFire` (`sim/fireable.md`, `sim/systems/combat.md`).
- `engage` starts with `nearestEnemy` (a mine: `densestEnemy`), `extra` `ENGAGE_START`, the attack-move's `skip`, `min` = `minRange` and `accept` = `canFire`. It keeps the engage while `reach` with `extra` `ENGAGE_END` and the same `min` passes, and `canFire` does (`sim/systems/engage.md`).
- `movement` uses `rangeTo` and `holdBand` (built on `holdRange`) for the close-on-target rule.
- The guard's close-on-threat goal still uses the plain weapon range, with no height bonus (`sim/systems/guard.md`).

## Invariants

- Integer math only.
- No terrain test here. Line of sight lives in `seen` (`sim/detection.md`). The arc test is `canFire` (`sim/fireable.md`); callers pass it as `accept`.
- Distances are exact. The grid is a coarse filter.
