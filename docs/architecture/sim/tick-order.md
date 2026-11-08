Source: packages/sim/src/step.ts, packages/sim/src/mapSize.ts, packages/sim/src/simState.ts, packages/sim/src/grid.ts, packages/sim/src/detection.ts, packages/sim/src/systems/*.ts

# step(): the system order

`step(state, intents)` advances a `SimState` `{ world, nav, features }` by one tick (`sim/nav/nav-grid.md`). It mutates `state.world`. `nav` and `features` are derived from the world. They are read until `reap` (row 18) removes destroyed features from the world, the index and the nav. The order is fixed. Later systems read what earlier systems wrote.

| Order | Call | Reads or writes |
|---|---|---|
| 1 | `applyIntents` | Orders, modes, build queues, players. See `sim/intents.md`. |
| 2 | `modes` | Starts deploy or pack from the head order, then counts down the timers. May pop a finished `siege` order. |
| 3 | `production(state)` | Factories advance the head job, plus the boost of engineers whose `work` names them (set last tick). May spawn a unit, at an open cell of its move class. |
| 4 | `harvest` | Harvesters move credits from fields to players. |
| 5 | `buildGrid(units, m)` (`before`) | Snapshot of unit positions. `step` reads the map size `m` once per tick. |
| 6 | `detect(world, before)` (`seen`) | The tick's one detection (`sim/detection.md`). Copies every unit's position, mode and hp now; answers lazily from that copy. |
| 7 | `lostTargets(seen)` | A head `attack` or `engage` whose living target the team no longer detects ends; a mobile unit's attack becomes a move to the last detected spot. A detected attack target refreshes that spot. See `sim/orders.md`. |
| 8 | `repair(before)` | Engineers pick one target, write `work`, and heal it if it is a unit. A `reclaim` head in reach takes scrap hp for credits instead. Returns the ids of scrap reclaimed to 0 hp. |
| 9 | `engage(before, seen)` | Puts an `engage` order in front of an attack-move, or ends one. Writes `skip`. See `sim/systems/engage.md`. |
| 10 | `combat(before, seen)` | Targets, turret aim, fire. May push shells. |
| 11 | `movement(state, before, seen)` | Units walk. Sets `facing`. May finish a move, or end an attack, engage or guard whose target is gone. Guards query `before` and `seen`. Reads `nav`. |
| 12 | `buildGrid(units, m)` (`moved`) | Snapshot after movement. |
| 13 | `arrival(moved)` | Ends move orders near the spot or by contact. Hands over a waypoint within two radii. |
| 14 | `separation(state, moved)` | Pushes overlapping units apart, never into a blocked cell. |
| 15 | `featureContact(state)` | Puts any mobile unit whose hull overlaps a rock or boulder back on its edge. See `sim/features/effects.md`. |
| 16 | `crush(state)` | Units of a crushing move class zero the `hp` of the features their hull overlaps. See `sim/features/effects.md`. |
| 17 | `projectiles(state, new grid)` | Flies every shell one tick. Applies damage to units and features. A direct shell stops at a rock or boulder. |
| 18 | `reap(state, reclaimed)` | The one point where features leave. Removes features with no hp left; if one blocked movement, opens its nav cells in this tick. Destroyed scrap leaves wreckage, except scrap in `reclaimed`. |
| 19 | `deaths(state)` | Removes units with `hp <= 0`. Each leaves scrap or wreckage (`sim/features/wreckage.md`); scrap closes its nav cells in this tick. |
| 20 | `elimination` | A player with no factory is out. |
| 21 | `fieldRegen` | Fields refill. |
| 22 | `world.tick++` | |

## Invariants

- A `Grid` holds indices into `world.units` at build time. Do not add or remove units between building a grid and its last use. `production` runs before the first grid. `deaths` and `elimination` run after the last.
- `separation` moves units but uses the grid built before the push. Queries are a coarse filter. Each system checks exact distance itself.
- A shell fired by `combat` is flown by `projectiles` in the same tick.
- Crush and splash only lower feature `hp`. Nothing but `reap` removes a feature or touches the nav grids, so every system sees one nav for the whole tick, and a removal shows in the next tick's `movement`.
- A unit with `hp <= 0` stays in the array until `deaths`. Systems that pick targets skip `hp <= 0`. `combat` skips a shooter with `hp <= 0`, so a mine that blew earlier in the tick, or a unit killed last tick, does not fire.
- `seen` answers once per tick. It classifies against the copy taken at row 6, so a unit that moves or dies later in the tick (a mine blowing in `combat`) does not change what its team detects this tick.
- Only a detected enemy can be picked or kept as a target. `engage`, `combat` and `movement` take `seen` and pass it through `detectionFor`: a mine detects everything (`sim/detection.md`).
- Systems take `(world)` or `(world, grid)`, plus `seen` where they pick targets. `production`, `crush`, `projectiles` and `reap` take `(state)` or `(state, grid)`, and `movement` takes `(state, grid, seen, m)` and `separation` takes `(state, grid)`, because they read `nav` or the feature index. They do not call each other, except `movement` calls `arrive` from `arrival.ts`.

## Add a system

1. Create `packages/sim/src/systems/<name>.ts` that exports `function name(world: World, grid?: Grid): void`.
2. Call it in `step.ts` at the right place. Say why in a comment if the position matters.
3. If it adds state, add the field to `types.ts`, `units.ts` (`spawnUnit`) or `world.ts`, and to `hash.ts`.
4. Keep it deterministic (`sim/determinism.md`).
