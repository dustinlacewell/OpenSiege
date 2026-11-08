Source: packages/sim/src/systems/repair.ts, packages/sim/src/units.ts, packages/sim/src/patient.ts, packages/sim/src/boost.ts, packages/sim/src/guard.ts, packages/sim/src/stats.ts

# Repair

`repair(world, grid)` lets engineers work on friendly units. It runs before `combat`, with the `before` grid. It returns the ids of scrap that reclaim brought to 0 hp this tick; `step` gives them to `reap`, which leaves no wreckage for them. An engineer works on one target at a time. `Unit.work` holds the target id, 0 = none.

## Rules

For each `engineer` in id order, `work` is cleared, then:

- `deploying` or `packing`: nothing.
- Reach is `workReachOf`: `MOBILE_REPAIR_REACH` (200) when `mobile` and `workRange` (600) when `sieged`.
- A `reclaim` head with its scrap in reach comes first. The engineer reclaims and does nothing else this tick (`sim/systems/reclaim.md`). `work` is then the scrap's feature id.
- Else pick the target in this order:
  1. The guard pick, if there is one in reach.
  2. The nearest patient in reach.
  3. The nearest boostable factory in reach.
- A patient is healed by `workRateOf(engineer)`: `workRate` (3) when mobile, `siegeWorkRate` (2) when sieged. Healing is capped at `maxHp`.
- A factory is not changed here. `production` reads `work` (see below).

A patient (`isPatient`, `patient.ts`) is a unit that is not the engineer, has the same `owner`, has `hp > 0`, and has `hp < maxHp`. Engineers can heal factories, harvesters, and other engineers. They cannot heal themselves.

A boostable factory (`isBoostable`, `patient.ts`) has the same `owner`, `hp > 0`, a non-empty queue, and is not deploying or packing.

## Factory boost

`boostOf(world, factory)` (`boost.ts`) sums, over engineers whose `work` is the factory id, and `production` adds it to the head job each tick:

- mobile: 1 progress every `BOOST_MOBILE_EVERY` (4) ticks, when `world.tick % 4 == 0`. That is 0.25 per tick.
- sieged: `BOOST_SIEGED` (2) per tick.

`work` is the value from the last tick, because `production` runs before `repair`. Engineers stack on one factory.

## Guard pick

When the head order is `guard` and its target lives, `guardPatient` picks the most hurt patient within `GUARD_RANGE` of the target (`sim/systems/guard.md`). It is used only if it is within the engineer's reach. Movement brings the engineer into that reach.

## Details

- Nearest means smallest squared distance. The first found in grid cell order keeps a tie.
- Distance to a factory is centre to centre.

## Client reads

- `render/overlay.ts` draws a work-range circle for a selected sieged engineer.
- `render/workBeams.ts` draws a green laser from the light on each engineer's mast (`ENGINEER_EMITTER`, `meshSupport.ts`) to the middle of the unit named by `work`. It is a row of glow billboards with pulses running down it. It shows only when the engineer and its target are both seen. It also casts a green light along its length (`client/render/lights.md`).

## Change the numbers

Edit `workRate`, `siegeWorkRate` and `workRange` in `data/unitStats.json` or the stat editor (`sim/stats.md`). Edit `MOBILE_REPAIR_REACH`, `BOOST_MOBILE_EVERY` and `BOOST_SIEGED` in `stats.ts`.
