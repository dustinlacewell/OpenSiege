Source: packages/sim/src/types.ts, packages/sim/src/units.ts, packages/sim/src/weapons.ts, packages/sim/src/orders.ts

# Units

## Unit fields

- `id`, `owner` (player id), `kind` (`UnitKind`).
- `x`, `y`: ground position, world units.
- `facing`, `aim`: hull and turret heading in angle steps. `aim` follows `target`, else `facing`.
- `hp`: removed by `deaths` at 0 or less.
- `mode`, `modeTimer`: siege state. See `sim/systems/siege-modes.md`.
- `orders`: a queue of `Order`. The head runs now. Empty means idle. There is no `idle` order. At most `MAX_ORDERS` entries. See `sim/orders.md`.
- `cooldown`: ticks until the weapon may fire. `lastFired`: ticks since the last shot (cap 255).
- `target`: unit id the weapon is aimed at. 0 is none. Written by `combat` every tick.
- `elevation`: gun elevation as slope in permille (rise per 1000 run). Written by `combat` every tick. It is the elevation of the arc `combat` solved, `direct` or `ballistic`. 0 when no shot is solved, and always 0 for mines and the unarmed. The client barrel draws it.
- `arrived`: group id of the last move this unit finished as its final order. 0 is none. `give` and `stop` clear it. `advance` clears it when a `move` comes up next.
- `queue`: factory build jobs `{ id, kind, progress }`. Head is in progress. `cancel` names jobs by `id` (`sim/systems/production.md`).
- `rally`: factory only. Where new units drive. `null` is none.
- `quota`: factory only. Kind → count, 1..`MAX_QUOTA` (20). A missing kind is 0; the `quota` intent deletes a key that reaches 0 (`sim/systems/production.md`).

## Orders and group

`Order` is `move {x, y, group, attack, path, best, stall}`, `attack {target}` or `siege {on}`. The queue rules and done rules are in `sim/orders.md`.

`move` carries a `group`. Units that got one move intent share the group. Units from a factory with a rally point use the factory id as group. `arrival.ts` uses the group to stop crowds (`sim/systems/arrival.md`).

## Helpers (`units.ts`)

- `findUnit(world, id)`: binary search. Relies on the id sort.
- `spawnUnit(world, owner, kind, x, y)`: pushes a unit with a new id. Position is clamped to the map.
- `removeUnitsOf(world, owner)`: drops all units of a player.
- `workRateOf(unit)`: `workRate` when mobile, `siegeWorkRate` when sieged, 0 while deploying or packing. Used by production and harvest. Exported from `index.ts` for the client UI (`ui/queueModel.ts`, `ui/unitReadouts.ts`). Takes only `kind` and `mode`.
- `radarRange(unit)`: `siegeRadar` when sieged, else `radar` (also while deploying or packing). Takes only `kind` and `mode`. `detection.ts` reads it to decide radar detection. Also exported for `ui/unitReadouts.ts`.
- `jamRange(unit)`: `siegeJam` when sieged, else `jam` (also while deploying or packing). Takes only `kind` and `mode`. Read by `detection.ts` (`sim/detection.md`).
- `MAX_RADIUS`: the largest unit radius. Pads grid queries that test unit bodies.

## Weapons (`weapons.ts`)

- `weaponOf(unit)`: `{damage, range, minRange, reload}` by mode. `minRange` is the same stat in both modes. Undefined when unarmed (damage 0) or in transition. Takes only `kind` and `mode`. Exported from `index.ts` for `ui/unitReadouts.ts` and the range rings in `render/overlay.ts`.
- `effectiveRange(base, shooterGround, targetGround)`: base plus the height advantage, capped at +50%.
- `maxRange(base)`: base + 50%. Used as the grid query radius.

## Kinds

`UNIT_KINDS` lists them: `factory`, `harvester`, `engineer`, `radar`, `tank`, `artillery`, `mine`. Numbers per kind live in `UNIT_STATS` (`sim/stats.md`).
