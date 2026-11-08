Source: apps/client/src/game/commands.ts, apps/client/src/game/scrapPick.ts, apps/client/src/game/areaReclaim.ts, apps/client/src/game/hotkeys.ts, apps/client/src/game/idle.ts

# Commands and hotkeys

Pure rules that turn a player gesture into an `Intent`. No DOM. No sending.

## commands.ts

Each function returns an `Intent`, a list of intents, or `null` (nothing to send).

- `CommandMods` = `{ force, queue }`. `force` packs up sieged units for a move. `queue` appends to each unit's orders instead of replacing them (`sim/orders.md`).
- `commandAt(selected, enemy, x, y, mods)`: right-click. If an enemy is under the cursor, `attack`. Else `move` to the ground point (rounded), `attack: false`. Both carry `queue`. Only `move` carries `force`. `null` if nothing is selected.
- `attackMoveAt(selected, x, y, mods)`: attack-move mode left click. A `move` with `attack: true`, `force` and `queue` from `mods`. `null` with no selection.
- `pathMove(selected, path, mods)`: right-drag curve. A `move` with `path`, and `x, y` set to the last path point. `null` with no selection or under 2 points.
- `siegeToggle(world, selected, queue)`: `siege` with `on = true` if any selected unit is mobile, else `on = false`. `null` for no units. When `queue` is set, "mobile" means the mode the unit will have after its queued `siege` orders run (`projectedMode`: the last `siege` order in `orders`, else the current mode).
- `guard(selected, target, queue)`: `guard` for the selected units, the target left out. `null` when no other unit is selected.
- `reclaim(world, me, selected, target, queue)`: `reclaim` of the scrap `target` for the selected own engineers. Other units get nothing. `null` when no own engineer is selected.
- `areaReclaim(world, me, selected, x, y, radius, queue)`: right-drag area reclaim. One `reclaim` per scrap whose centre is in the circle, for the selected own engineers. The wrecks form a nearest-neighbour chain from the first selected own engineer, at most `MAX_ORDERS` long. The first intent carries `queue`. The rest carry `queue: true`. Empty when no own engineer is selected.
- `hasEngineer(world, me, selected)`: true when the selection holds an own engineer.
- `stop(selected)`.
- `build(world, me, selected, kind, count = 1)`: up to `count` `build` intents per selected own factory. Each factory gets as many as fit its queue (`MAX_QUEUE`) and the credits left after the factories before it. Shift asks for `BATCH` (5).
- `cancelJobs(world, me, factory, jobs, many)`: one `cancel` for the last id of `jobs` (a tile's job ids, queue order) of an own factory. With `many`, the last `BATCH` ids. Null for a foreign or unknown factory or an empty list. Ids name jobs, not positions, so a job that finished first never makes another job go.
- `quota(world, me, selected, kind, delta)`: one `quota` intent per selected own factory. The sim clamps.
- `rallyAt(world, me, selected, x, y)`: `rally` for the selected own factories. `null` if none.
- `ownFactories(world, me, selected)`: used by the HUD model as well.

Coordinates are rounded to integers here. `validate.ts` rejects non-integers.

## scrapPick.ts

`scrapAt(features, x, y, tolerance)` is pure. It returns the scrap (`kind` "scrap", `hp > 0`) whose circle, grown by `tolerance` world units, holds the ground point. The nearest centre wins. A tie goes to the lower id. `isScrap(f)` is the same test for one feature.

## areaReclaim.ts

Pure geometry for the area reclaim. `ReclaimArea` is `{ x, y, radius, press }`: the circle, and the id of the scrap under the press point.

- `scrapsInCircle(features, x, y, radius)`: the scrap whose centre is within `radius`, in input order.
- `chainFrom(scraps, x, y, max)`: at most `max` wrecks. Each step goes to the nearest wreck left. A tie goes to the lower id.

## hotkeys.ts

`hotkeyFor(code, { ctrl, alt, shift })` maps a `KeyboardEvent.code` to a `Hotkey`. Digits come first. Then, with Alt held, nothing else maps. With Ctrl held it reads only `CTRL_KEYS`, so Ctrl+A never reaches the grid's A.

| Key | Hotkey |
|---|---|
| F | siege toggle (Shift: queue it) |
| H | stop |
| G | guard mode: the next left click picks the unit to guard |
| R | attack-move mode: the next left click picks the ground point |
| Esc | leave the mode |
| Q W E / A S D / Z X C | `slot`: build the kind in that slot of the shown palette page (Shift: 5) (`client/ui/build-grid.md`) |
| Space | camera to home factory |
| 1 to 9 | `group`, op `recall`: select control group N. Twice fast centres the camera (`client/game/control-groups.md`) |
| Alt+1 to 9 | `group`, op `save`: the own selection becomes group N |
| Shift+1 to 9 | `group`, op `add`: the own selection joins group N |
| Ctrl+A | select all own |
| . (Period) | `idleBuilders`: select idle builders (Shift: add) |
| , (Comma) | `idleHarvesters`: select idle harvesters (Shift: add) |

Keys are physical positions (`e.code`), not letters. The grid keys come from `GRID_KEYS` in `game/buildGrid.ts`.

`Hotkey` is a tagged union. `Actions.hotkey(key, shift, at)` runs it (`client/input/actions.md`).

## idle.ts

Pure filters for the idle keys. World in, own unit ids out.

- `idleBuilders(world, me)`: own engineers with empty `orders`, and own factories with an empty `queue`.
- `idleHarvesters(world, me)`: own harvesters with empty `orders`. A harvester that is `sieged` inside a non-empty field is at work, so it drops out. The field test is the sim's `fieldUnder` (`systems/harvest.ts`).
- New units with no rally guard their factory (`sim/systems/production.md`), so a fresh engineer is not idle. A fresh harvester is.

## Recipes

Add a hotkey:
1. Add a variant to `Hotkey` if it needs a new action. Add the key to `KEYS` or `CTRL_KEYS`. Do not reuse a grid key.
2. Handle the variant in the `switch` in `input/actions/hotkey.ts`.
3. If a HUD button shows the key, update its letter in `index.html`.

Add a command: add a function here, an action in its group in `input/actions/` (`client/input/actions.md`), and an intent (`sim/intents.md`).
