Source: apps/client/units.html, apps/client/src/dev/unitEditor/, apps/client/devStatsPlugin.ts, apps/client/test/unitEditorModel.test.ts

# Unit stat editor

A dev-only page at `/units.html`. It edits `packages/sim/data/unitStats.json`, the file the game loads. A save is real. The page is not in the production build: Vite builds `index.html` only, and `main.ts` throws unless `import.meta.env.DEV`. The start screen's dev strip has a "unit stats" link to it, shown in dev builds only (`client/ui/start-screen.md`).

The page is a table editor (`client/dev/table-editor.md`) with a unit adapter. This file covers what the adapter adds.

## Layout

One table. Columns are units in `UNIT_KINDS` order. Rows are stats in `STAT_KEYS` order, grouped by `STAT_SECTIONS`. All units show at once.

- A unit header shows its game headshot (`headshots.ts`, drawn by a `Renderer` on a canvas that is never shown) over a kind letter, and a reset button while the unit has edits. Without WebGL2 the header shows the letter. `portraits.ts` fills the header slot.
- Info strip: label, key, help, legal range and saved value of the focused cell.
- A number cell has a thin bar scaled to the largest value in its row.

## Adapter

| File | Role |
|---|---|
| `unitSchema.ts` | `STAT_FIELDS`, `STAT_KEYS` and `STAT_SECTIONS` as a `Schema`. The sim's `int` is a number field with `decimals` 0 and `step` 1. |
| `unitRules.ts` | `field` is the sim's `fieldErrors`. `cross` is `crossErrors`. `relevant` is `isRelevant`. Also `unitLabel`. |
| `api.ts` | `createHttpRemote("/__dev/unit-stats")`. It reads the sim's `StatError.kind` as the refusal's `column`. |
| `persist.ts` | `createLocalStore("mf.unitEditor", ...)`. |
| `portraits.ts`, `headshots.ts` | The headshots. |
| `main.ts` | Builds the adapter, loads the table, starts `TableEditor`. |

## Dim cells

`isRelevant` dims a cell when the unit's other stats make it do nothing. The cell is not hidden.

- Weapon stats when the weapon is `none`.
- Siege weapon stats also when `siegeTicks` is 0.
- Siege armor, sink, siege work rate, siege radar and siege jam when `siegeTicks` is 0.

## Save route

`devStatsPlugin.ts` registers `/__dev/unit-stats` with `devJsonPlugin` (`client/dev/table-editor.md`). `parse` is `parseUnitStats`. `serialize` is `serializeUnitStats`. 422 returns `{errors: StatError[]}`. The write makes Vite reload the pages.

## Persistence

- `mf.unitEditor.draft` holds the changed cells. On load they are applied again, checked, and dropped when they equal the saved value.
- `mf.unitEditor.prefs` holds folded sections, the filter text and the changed-only switch.

## Add a field

Add it to `UnitStats` and to `STAT_FIELDS` in `packages/sim/src/statFields.ts`, and to the JSON. The schema reads `STAT_FIELDS`, so the row, the range check and the info text appear with no editor change. A new relevance rule goes in `isRelevant` (`unitRules.ts`) with a test in `unitEditorModel.test.ts`.
