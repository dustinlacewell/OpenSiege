Source: packages/sim/src/features/wreck.ts, packages/sim/src/systems/deaths.ts, packages/sim/src/systems/reap.ts, packages/sim/src/nav/closeFeatures.ts, packages/sim/src/features/featureStats.ts, packages/sim/data/unitStats.json

# Scrap and wreckage

A unit that dies leaves a feature (`sim/features/feature-stats.md`) at its spot. The feature has the unit's radius and a `unit` field: the kind of unit it came from. Map features have no `unit`.

## The two kinds

- `scrap`: blocks movement and shots. It takes damage from direct hits and splash. Nothing crushes it. It does not slow units. It stays until destroyed. Engineers can reclaim it for credits; that takes its hp (`sim/systems/reclaim.md`).
- `wreckage`: charred ground. It blocks nothing, slows nothing, and cannot be destroyed (`maxHp` 0). It stays for the whole match.

## Which one

The stat `scrapHp` (`UNIT_STATS`, `data/unitStats.json`) decides.

- Above 0: the unit leaves `scrap` with `hp = scrapHp`.
- 0: the unit leaves `wreckage`. The radar and the mine do this.

Scrap hp is per feature, not per kind. `FEATURE_STATS.scrap.maxHp` is a placeholder above 0. It only makes `isDestroyed` and `damageFeature` treat scrap as destroyable.

## Spawn

`wreckFor(unit, id)` (`features/wreck.ts`) is pure: unit kind and spot in, `Feature` out (`variant` 0). `deaths(state)` calls it for each dead unit, in unit id order. Each result gets an id from `world.nextId`, goes into `world.features` and the index, so the array stays sorted by id. If any new feature blocks movement, `closeFeatures` (`sim/nav/nav-grid.md`) closes its nav cells once, in the same tick.

The death blast is unchanged. It still detonates on the next tick and can hurt the scrap.

A unit that overlaps scrap is pushed off it by `featureContact`, like any blocking feature. Nothing else handles units that die on top of each other.

## Replacement

`reap` removes a destroyed scrap and calls `wreckageOf(scrap, id)` for it, except a scrap that engineers reclaimed to 0 hp this tick: `repair` returns those ids and `reap` leaves no wreckage for them (`sim/systems/reclaim.md`). The wreckage has the same spot, radius and `unit`, and a new id. `reap` goes in id order, so the ids are the same on every machine. The scrap's nav cells open through `openFeatures`. Wreckage needs no nav change.

## State

`unit` is in `hashFeature` and in the snapshot, which is plain JSON. Map specs (`MapSpec.features`) hold only `MapFeatureKind` (`rock`, `boulder`, `tree`). The map editor and `placeFeatures` never make scrap or wreckage.
