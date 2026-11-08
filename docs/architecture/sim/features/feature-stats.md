Source: packages/sim/src/features/featureStats.ts, packages/sim/src/types.ts

# Features: state and rules

Rocks, boulders, trees, scrap and wreckage are sim entities: `world.features`, sorted by id, plain data. They are in the snapshot and the hash.

```
Feature { id, kind, x, y, radius, hp, variant, unit? }
```

- `hp` starts at the kind's `maxHp`. It is 0 for a feature that cannot be destroyed. Scrap takes its hp from the dead unit's `scrapHp`.
- `variant` (0 to 3) is drawn at placement. It has no sim meaning. The client picks a model variant by it.
- `unit` is the kind of unit that died. Only scrap and wreckage have it (`sim/features/wreckage.md`).
- A feature leaves the array only through `reap` (`sim/features/effects.md`).

## FEATURE_STATS

`FEATURE_STATS` (`featureStats.ts`) gives the rules per kind, like `UNIT_STATS`:

| Field | Meaning |
|---|---|
| `blocksMove` | Marks the nav cells it covers as `BLOCKED` for every move class (`sim/nav/nav-grid.md`). |
| `blocksShot` | A direct shell that enters its cylinder hits it. |
| `height` | Cylinder height above the ground at its centre, for the shot test. |
| `slowPercent` | Speed a unit keeps with its centre inside the radius. 100 = no slow. |
| `crushedBy` | Move classes that destroy it by driving over it. Needs `maxHp` above 0. |
| `maxHp` | Splash and direct hits destroy it at 0. 0 = cannot be destroyed. |

Kinds:

- `rock`: blocks movement and shots. Cannot be destroyed.
- `boulder`: small. Blocks movement and shots. Shells destroy it (400 hp).
- `tree`: blocks nothing. Slows `light` units to 55%. Crushed by `heavy`. Splash destroys it (60 hp).
- `scrap`: what a dead unit leaves. Blocks movement and shots. Shells and splash destroy it. Its hp is per unit kind; `maxHp` 1 is a placeholder.
- `wreckage`: what destroyed scrap leaves, or a dead unit with no scrap. Blocks nothing. Cannot be destroyed.

Only `rock`, `boulder` and `tree` are `MapFeatureKind`: the kinds a map holds and `place.ts` makes.

`FEATURE_KINDS` lists the kinds in table order. `isDestroyed(f)` is true when `maxHp` is above 0 and `hp` is 0 or less. `MAX_FEATURE_RADIUS` (256) pads index queries; placement stays under it.

## Add a kind

Add the kind to `FeatureKind` in `types.ts` and a row to `FEATURE_STATS`. A kind a map holds also goes in `MapFeatureKind`, with a radius range and ground rule in `place.ts` (and the radius table in `packages/map`). A kind the sim spawns at run time needs a spawn point that adds it to `world.features` and the index, and calls `closeFeatures` if it blocks movement. No system has a switch on kind.
