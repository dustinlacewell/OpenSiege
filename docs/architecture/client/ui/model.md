Source: apps/client/src/ui/model.ts, apps/client/src/ui/guideModel.ts

# HUD model

`hudModel(world, view)` is a pure function. `view` is a `HudView`: `{ me, self, selected, page, targetMode, groupOf, guide, guideView }`. It turns the world into the plain data the HUD shows. It has no DOM.

`guide` is `Pick<Guide, "admit" | "mayIssue">` (`client/game/tutorial/core.md`). `guideView` is `guide.view()`, or null.

## HudModel

- `credits`: the local player's credits, or 0.
- `unitCount`: units owned by `me`.
- `selection`: a `SelectionView` (`client/ui/unit-panel.md`): one unit's details, or the tile list.
- `hasSelection`: `selected.length > 0`.
- `hasFactory`: the selection holds at least one own factory.
- `siegeDeploys`: true when pressing siege would deploy. It is `siegeToggle(...).on`, and true when there is no unit.
- `targetMode`: `"guard"`, `"attackMove"` or null. The command card shows its hint and marks its button.
- `queues`: a `QueueSummary` for the selected own factories (`client/ui/queue.md`).
- `queueLocked`: the guide forbids cancelling a queued job.
- `palette`: the nine `PaletteSlot`s of `page`. Each is a `GridSlot` from `buildSlots` (`client/ui/build-grid.md`) plus `locked`, `quotaLocked` and `focus`.
- `commands`: `{ locked, focus }` for `siege`, `stop`, `guard` and `attack`.
- `guide`: `{ prompt, index, count, note }` from `guideView`, or null. `index` is 0-based. `note` shows Continue.
- `page`, `pages`: the shown page and the page count.
- `dead`: the local player exists and is not `alive`.
- `leaders`: up to 8 rows `{ name, color, score, me }`.

`Hud` passes `session.buildPage` as `page`, `session.targetMode` as `targetMode`, and `groupOf` over `session.groups` (`client/game/control-groups.md`). The hint can lag the mode by up to one HUD refresh (200 ms).

## Leaderboard score

Score is the total `cost` of all units a player owns. Only `connected` players are listed. Sorted by score, highest first.

## Guide flags (guideModel.ts)

The HUD knows no lesson. It reads two flags per control, plus `quotaLocked` on a slot.

- `locked`: the guide forbids the control. The panel dims it and drops its clicks. Input also blocks.
- `focus`: `guideView.controls` names the control. The panel pulses a gold outline on it.

Lock rules:

- A note (`guideView.note`) locks every slot, every quota, every command and the queue.
- A slot: a factory is selected, and some intent of `commands.build(world, me, selected, kind)` is not admitted. That is what one click sends. Empty slots and no factory: not locked.
- A slot's quota (Ctrl+click): `!mayIssue("quota")`. Empty slots: not locked.
- `siege`: `admit` drops the `siegeToggle` intent. `stop`: `admit` drops the `commands.stop` intent. No intent: not locked, because the button does nothing then. A stop that only loses some units is not locked.
- `guard`: `!mayIssue("guard")`. `attack`: `!mayIssue("move")`.
- The queue (`queueLocked`): `!mayIssue("cancel")`.

With `NO_GUIDE` nothing is locked and nothing has focus.

## Reuse of game rules

The model calls `ownFactories`, `siegeToggle`, `stop` and `build` from `game/commands.ts`. The HUD button text, the locks and the real intents therefore agree.

## Invariants

- The model holds every value the HUD shows. Add a field to show a new value. Panels do not compute from the `World`.
- Units are read with `unitById` (binary search by id).
- It allocates new objects each call. It runs at 5 Hz, not per frame.

## Tests

Pure: pass a hand-built `World`. No DOM needed. `test/hudGuide.test.ts` covers the guide flags with a fake guide.
