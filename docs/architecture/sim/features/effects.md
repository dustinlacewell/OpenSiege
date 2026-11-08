Source: packages/sim/src/features/featureSlow.ts, packages/sim/src/features/wreck.ts, packages/sim/src/features/featureHit.ts, packages/sim/src/features/featureDamage.ts, packages/sim/src/systems/crush.ts, packages/sim/src/systems/featureContact.ts, packages/sim/src/systems/reap.ts, packages/sim/src/impact.ts, packages/sim/src/systems/projectiles.ts, packages/sim/src/systems/movement.ts

# What features do

All tests read the `FeatureIndex` (`sim/features/spatial-index.md`) and `FEATURE_STATS` (`sim/features/feature-stats.md`). Each function is pure on plain data.

## Blocking movement

`blocksMove` features mark nav cells `BLOCKED` for every class. See `sim/nav/nav-grid.md`, "Features". Those cells only plan routes, in steps of one terrain cell (`terrain.cell`, 125 on the default map).

The body is kept off the rock by `featureContact` (`systems/featureContact.ts`), after `separation`. A mobile unit whose hull overlaps a blocking feature's circle is put back on its edge (radius + unit radius), through `slide`. So a unit slides around a rock at its true radius, and a crowd cannot push it in.

## Slow

`slowPercentAt(index, x, y, cls, near)` returns the lowest `slowPercent` among features whose circle holds the point, 100 in the open. A feature the class crushes does not slow it. Today that means trees slow `light` units and not `heavy` ones.

`stepToward` in `movement.ts` applies it to the turn-scaled speed (`max(1, speed * pct / 100)`) before the slope factor. It reads the unit's centre only. Several trees do not stack.

## Crush

`crush(state)` runs after movement and separation. For each live unit whose move class crushes some feature kind, every feature of such a kind whose circle overlaps the hull (`dist < unit radius + feature radius`) gets `hp = 0`. Moving or idle makes no difference. It does not remove anything.

## Shots

A direct shell (`UNIT_STATS[source].weapon === "direct"`) tests features after each substep, when no unit or ground was hit. `featureHit(index, terrain, prev, cur, near)` returns the first feature (index order) with `blocksShot` and not destroyed, where:

- `prev`, the shell before this substep, is outside the circle. A unit beside a rock can still fire.
- The substep segment `prev` to `cur` comes within the radius. The closest point on the segment decides.
- The shell height at that point is no higher than ground at the feature centre plus `height`.

All fixed point and integer. A ballistic shell never tests features: it passes over.

## Impact

`impact(state, grid, p, hit, struck, near)`:

- A unit hit takes full damage, as before.
- A struck feature takes full `damage` (`damageFeature`: nothing if `maxHp` is 0). A rock stops the shell and stays.
- Splash reaches every feature (`splashFeatures`), measured from the impact point to the feature edge: `damage * (splash - d) / splash`, for `d < splash`. The struck feature is skipped. Features have no owner, so there is no friendly fire.

## Reap

Crush and splash only set `hp` down. `reap(state, reclaimed)` runs once per tick, after `projectiles` and before `deaths`. It takes every `isDestroyed` feature out of `world.features` and the index. Each destroyed `scrap` is replaced by `wreckage` with a new id, except scrap whose id is in `reclaimed` (engineers took its last hp): that leaves nothing (`sim/features/wreckage.md`). If any removed feature blocked movement, it calls `openFeatures` (`sim/nav/nav-grid.md`) in the same tick. Trees and wreckage change no nav.

Later systems and the next tick see the removal. Shells flown later in the same tick skip a destroyed feature (`featureHit` checks `isDestroyed`).

## Hash

`features` is hashed (`sim/hash.md`), so a missed crush or splash shows as a desync. The index and the nav are derived and not hashed.
