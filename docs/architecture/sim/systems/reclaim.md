Source: packages/sim/src/features/reclaim.ts, packages/sim/src/reclaim.ts, packages/sim/src/intents/reclaim.ts, packages/sim/src/features/findFeature.ts, packages/sim/src/systems/repair.ts, packages/sim/src/systems/movement.ts, packages/sim/src/stats.ts

# Reclaim

An engineer takes hp off a scrap feature (`sim/features/wreckage.md`). Its owner gets credits for the hp taken. Reclaim progress is the scrap's hp. A half-reclaimed scrap is easy to destroy.

## Order and intent

- Intent `reclaim {units, target, queue}`. `target` is a feature id. Feature ids come from `world.nextId`, as unit ids do, so the two never clash.
- The target must be reclaimable: kind `scrap`, `hp > 0`, and `unit` set. Otherwise the intent does nothing.
- Scrap has no owner. Any player can reclaim any scrap.
- Only the player's own engineers get the order `reclaim {target}`, through `give`. Other kinds are skipped.
- A host that checks intent shape parses it like `guard` (`sim/intents.md`).

## Value

`scrapValue(unit, hp)` = floor(`cost` · `RECLAIM_PERCENT` · `hp` / (100 · `scrapHp`)). `RECLAIM_PERCENT` is 50 (`stats.ts`). A full-hp scrap pays half the unit's cost.

`reclaimStep(f, rate)` takes min(`rate`, `hp`) off the scrap. It returns `scrapValue` before minus `scrapValue` after. The floors cancel over all steps, so the total paid is `scrapValue` of the start hp, exactly. A damaged scrap pays less.

## Reach

The gap from the engineer's centre to the scrap's edge (centre distance minus `radius`) must be within `workReachOf`: `MOBILE_REPAIR_REACH` when mobile, `workRange` when sieged.

## Movement

For a `reclaim` head (`movement.ts`):

- The scrap is gone or has no hp: the order pops, in any mode.
- In reach: the engineer stands still.
- Out of reach: an anchored engineer starts packing, as a guard does. A mobile one drives at the scrap centre with `stepToward`.

## Work

`repair` does the work (`sim/systems/repair.md`). For each engineer in id order, after the mode check:

- If its head is `reclaim` and the scrap is reclaimable and in reach, `work` is the scrap id. The engineer takes `workRateOf` hp and the owner's `credits` grow by the return of `reclaimStep`. This comes before heal and boost.
- Out of reach, the engineer heals and boosts as usual.

Several engineers on one scrap work in id order. A later one gets only the hp left. At 0 hp `reap` removes the scrap at the end of the tick and leaves no wreckage: `repair` returns the ids it reclaimed to 0 and `step` passes them to `reap`. A scrap that shells or crushing destroy still leaves wreckage. The next tick the order pops.
