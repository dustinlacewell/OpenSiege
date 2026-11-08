Source: apps/client/src/game/buildGrid.ts, apps/client/src/ui/buildPalette.ts, apps/client/src/ui/commandCard.ts

# Build grid and command card

The right console box (`#command-card`): a 3 by 3 build grid, a 2 by 2 grid of Siege, Stop, Guard and Attack buttons, a tooltip box, and page tabs.

## buildGrid.ts (pure, in `game/`)

It lives in `game/` because `input/` (grid keys) and `ui/` (the grid) both read it.

- `BUILD_PAGES`: pages of exactly `GRID_SLOTS` (9) slots, row-major. A slot is a `UnitKind` or `null`.
- Page 0: top row harvester, engineer, factory (economy). Middle row tank, artillery (combat), radar truck (key D). Bottom row empty.
- `GRID_KEYS`: `KeyQ KeyW KeyE / KeyA KeyS KeyD / KeyZ KeyX KeyC`, by physical position. `GRID_LETTERS` are the printed letters.
- `gridSlotOf(code)`: slot index or -1. `slotKind(page, slot)`: the kind or null.
- `buildSlots(page, { credits, full, hasFactory, quotas })`: nine `GridSlot`s `{ kind, cost, seconds, key, enabled, quota }`. `seconds` is `buildTicks · TICK_MS / 1000`. `enabled` needs a kind, a queue that is not full, and enough credits. `quota` is `quotas[kind]`, else 0. With no factory selected every `kind` is null.
- `maxQuotas(factories)`: the highest `Unit.quota` per kind over the selected own factories. `ui/model.ts` passes it as `quotas`.
- At load, `checkPages` throws if a page is not 9 slots or holds a kind that is not in the sim's `BUILDABLE`. `BUILDABLE` stays the authority.

## BuildPalette

Nine 64 px `SlotTile`s in `#palette`, always drawn.

- A slot with a kind: headshot, cost bottom-left, key letter top-right. Class `off` (dimmed, cost red) when not enabled. Click calls `actions.build(kind, shift)` only when enabled. Shift+click builds 5 per factory, as many as fit and are affordable.
- Ctrl+click on a slot with a kind calls `actions.adjustQuota(kind, 1)`, enabled or not. Ctrl+right-click calls it with -1. The tile always suppresses the browser context menu. Quota mode: each selected factory keeps that many of the kind alive (`sim/systems/production.md`).
- Quota badge: the slot's `quota` top-left in blue, when above 0. It is a `span.slot-key.slot-quota`; inline style moves it from the key's corner, because the slot CSS lives in `index.html`.
- An empty slot: a dashed frame (`slot empty`).
- Guide flags from the model's `PaletteSlot` (`client/ui/model.md`): class `locked` dims the slot and it ignores build clicks. Class `quota-locked` dims the quota badge and the slot ignores Ctrl+click and Ctrl+right-click. Class `focus` pulses a gold outline.
- Tiles are `div`s, not disabled buttons, so a dimmed slot still gets hover.
- Hover shows the slot in the fixed tooltip `#tip`: name, `Cost`, `Build` time in seconds. Leaving clears it.
- `PageTabs` in `#palette-pages`: one button per page. Hidden when there is one page. Click calls `actions.showBuildPage(i)`.

## CommandCard

- `#cmd-siege`: label `Siege` or `Unsiege` from `siegeDeploys`. Click calls `actions.siege(shift)`; Shift queues it. Key F.
- `#cmd-stop`: calls `actions.stop()`. Key H.
- `#cmd-guard`: calls `actions.enterTarget("guard")`. Key G.
- `#cmd-attack`: calls `actions.enterTarget("attackMove")`. Key R.
- The button of the current target mode has class `on` (gold border).
- Each button takes `locked` and `focus` from `m.commands`, as the slots do. A locked button ignores its click.
- The whole card is hidden with nothing selected (`hasSelection` false). Leaving that state also ends the target mode (`Session.select`), so the hint never hides while a mode is on.
- `#tip-target`: the target-mode hint in `#tip`. `#tip-target-text` reads "Guard: click a unit" or "Attack: click ground", then "Esc to cancel". Shown while `targetMode` is not null in the model. It hides the slot tooltip while it shows.

## Grid keys

`hotkeyFor` maps a grid key to `{ t: "slot", index }` (`client/game/commands.md`). `Actions` builds `slotKind(session.buildPage, index)`. Shift with a grid key builds 5. `commands.build` sends nothing without a selected own factory, so the keys do nothing then.

## Recipe: add a page or a kind

1. A kind is buildable unless its `UNIT_STATS` row sets `buildable: false` (`sim/stats.md`).
2. Put it in a `null` slot of `BUILD_PAGES`, or add a page of 9 slots. Tabs appear by themselves.
