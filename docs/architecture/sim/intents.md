Source: packages/sim/src/types.ts, packages/sim/src/intents.ts, packages/sim/src/intents/, packages/sim/src/orders.ts, packages/sim/src/siege.ts, apps/client/src/game/commands.ts

# Intents

An `Intent` is the only input to the sim. A `Stamped` is `{ player, intent }`. The match host sets `player`. The sim trusts it.

## Intent list

| `t` | Fields | Effect |
|---|---|---|
| `join` | `name`, optional `x`, `y`, `team` | Host only, once per match player in turn 1. Adds the player and spawns a factory and a harvester. With `x`, `y` (the spot the player picked) the factory goes there. Without them the sim picks a spot. |
| `leave` | | Host only. Player becomes `connected: false`, `alive: false`. Units removed. |
| `move` | `units, x, y, force, queue, attack`, optional `path` | Own units each get a `move` order to their own spot (`sim/formation.md`, or `sim/path-spots.md` with a path). `attack` makes it an attack-move (`sim/orders.md`). |
| `attack` | `units, target, queue` | Own units get an `attack` order. Target must be an enemy unit. |
| `stop` | `units` | Clears the order queue of own units. |
| `siege` | `units, on, queue` | Gives a `siege {on}` order: deploy, or pack up. |
| `guard` | `units, target, queue` | Own units get a `guard` order. Target must be a living own unit. |
| `reclaim` | `units, target, queue` | Own engineers get a `reclaim` order. Target must be a scrap feature with hp left (`sim/systems/reclaim.md`). |
| `build` | `factory, kind` | Queue a job. Needs credits and a free slot. |
| `cancel` | `factory, jobs` | Drop the listed job ids of an own factory and refund each one's full cost. |
| `rally` | `units, x, y` | Sets the rally point of own factories. Other kinds are skipped. |
| `quota` | `factory, kind, delta` | Adds `delta` to an own factory's quota for `kind`, clamped to 0..`MAX_QUOTA`. |

## Dispatch table

`intents.ts` holds `applyIntents` and one table, `HANDLERS`. The table has one row per `Intent["t"]`. Each row is a handler in its own file in `intents/` (`move.ts`, `attack.ts`, and so on).

- `intents/handler.ts`: `IntentHandler<K>` is `(world, player, intent: IntentOf<K>) => void`. `IntentTable` maps every tag to its handler. A new `Intent` variant with no row is a type error.
- `intents/lookup.ts`: the shared lookups. `findPlayer`, `ownUnits`, `unitAt` (a unit by raw id), `ownFactory`.
- A tag that is not an own key of the table does nothing. `Object.hasOwn` keeps `"toString"` and other prototype keys out.

## How `applyIntents` behaves

- Intents apply in array order. The order is the host's arrival order.
- Each handler checks everything itself. Unknown ids, foreign units, bad numbers and non-arrays are dropped. Nothing throws.
- `ownUnits` keeps only units the player owns. It caps one order at 500 units (`MAX_UNITS_PER_ORDER`).
- `move`, `attack`, `siege`, `guard` and `reclaim` give the order through `give` (`sim/orders.md`). `queue: true` appends to each unit's `orders`. `queue: false` replaces them. An append past `MAX_ORDERS` (32) is dropped. Every `give` sets `arrived = 0`.
- `stop` sets `orders = []` and `arrived = 0`. It does not change `mode`.
- `attack`: the target must exist and belong to another player. Otherwise nothing happens.
- `guard`: the target must exist, belong to the player and have `hp > 0`. Otherwise nothing happens. A listed unit that is the target is skipped. The order starts with `chase: false`. No mode check here (`sim/systems/guard.md`).
- `siege`: no mode check here. `modes` starts the deploy or pack when the order is the head (`sim/systems/siege-modes.md`).
- `move`, who takes it: every own unit. An anchored unit (`sieged` or `deploying`) packs up first, then drives. `force` no longer changes anything.
- `move`, packing: a replacing move on an anchored unit starts `packing` at once. A queued move leaves the mode alone. `modes` packs the unit when the move reaches the head.
- `move`, groups and spots: the units that take the order share one group id (`world.nextId++`). Spots come from `assignSpots`, or from `assignAlongPath` when `path` has 2 or more points. A malformed `path` drops the intent. Each unit's start point is the destination of its last queued move when `queue` is set and it has one, else where it stands.
- `move` clears `rally` on every unit that takes it, a factory included, whether queued or forced. A factory that ignores the move keeps its rally. No other intent clears it.
- `rally`: only factories. Clamped to the map. Works in any mode.
- `move` copies `attack` (missing = false) into every order it gives. It changes nothing else here.
- `build` calls `enqueueJob` (`jobs.ts`): it charges `cost` at once and pushes `{id, kind, progress: 0}`. `id` is `world.nextId++`, taken in intent order.
- `quota`: the factory must be an own factory, `kind` in `BUILDABLE` and `delta` a number (`toInt`). Otherwise nothing happens. The result is clamped to 0..20; at 0 the key is deleted (`sim/systems/production.md`).
- `cancel`: the factory must be an own factory and `jobs` an array of at most `MAX_QUEUE` ids. Otherwise nothing happens. In list order, each id still in that queue is removed and `UNIT_STATS[kind].cost` goes back to the player's credits. Other ids are skipped (`sim/systems/production.md`).

## Two checks, on purpose

A host that takes intents from outside the process checks their shape before it queues them: types, safe integers, array length 500, `path` length and range, `kind` in `BUILDABLE` (`build`, `quota`), `cancel` `jobs` length at most `MAX_QUEUE`. It rejects `join` and `leave` from players. The sim checks game rules. Both are needed: the sim must not trust the host's shape.

## Recipe: add an intent

1. `types.ts`: add a variant to `Intent`.
2. `intents/<name>.ts`: export an `IntentHandler<"name">`. Validate every field. Use `toInt` and the lookups in `intents/lookup.ts`.
3. `intents.ts`: add the row to `HANDLERS`. `tsc` fails until you do.
4. A host that checks intent shape from outside: add a `case` for the new intent in its parser.
5. Client: add a builder in `game/commands.ts`, an action in the matching group in `input/actions/` (`client/input/actions.md`), and a trigger (hotkey in `game/hotkeys.ts`, button in `ui/`).
6. A host needs no change. It forwards any parsed intent.
7. If the intent changes new state, hash it (`sim/hash.md`).
