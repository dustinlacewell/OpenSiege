Source: apps/client/src/dev/tableEditor/, apps/client/src/dev/build.ts, apps/client/devJsonPlugin.ts, apps/client/test/tableEditorModel.test.ts, apps/client/test/tableEditorRemote.test.ts

# Table editor

The shared core of the dev-only table pages. The unit stat page (`client/dev/unit-editor.md`) and the sound page (`client/dev/sound-editor.md`) use it. A page gives the core an adapter and gets the whole editor: matrix, toolbar, status line, info strip, undo, drafts, save.

## Table shape

A table is columns (units) by fields (stats). `Table` is column id to `Row`. A `Row` is field key to `Value` (`number | boolean | string`). The `Schema` lists the `FieldSpec`s and `SectionSpec`s. Array order is row order and file order.

A column may leave out fields. The cell of a missing field is blank and cannot be edited. Edits, change lists, errors, bars and draft restore all skip it.

Field types:

- `number`: `min`, `max`, `decimals`, `step`. `decimals` 0 is a whole number and `step` 1.
- `bool`: a switch.
- `enum`: a select over `options`.

## Layout

One table: columns across, fields down in sections. The header row and label column stay in view when it scrolls.

- Toolbar: title, filter, changed-only switch, change count, undo, redo, revert all, save.
- Status line: the save result, and the save route's refusals as a list. A refusal that names a cell jumps to it.
- Info strip at the bottom: label, key, help, legal range and saved value of the focused cell. It follows the pointer when nothing has focus.

## Cells

A cell is built once and updated in place.

- `changed`: the draft differs from the saved file. It shows "was N" and a revert button.
- `invalid`: a field rule, a rule across fields, text that is not a number, or a refusal from the save route. The message is the cell title and the info strip text.
- `dim`: `Rules.relevant` is false.
- A number cell has a thin bar scaled to the largest value in its row.

Keys in a cell: Alt+Up and Alt+Down move focus without changing the value. Enter moves down, Shift+Enter up. Tab moves right. Page keys: Ctrl+S saves, Ctrl+Z undoes, Ctrl+Y or Ctrl+Shift+Z redoes, `/` focuses the filter, Esc clears the filter or leaves the box.

## Number cells

- Text commits to the draft when it is a number. A whole-number field takes `-?\d+`. A decimal field also takes `0.` and `.5`, so mid-typing text counts. Other text is kept as text, the cell is `invalid`, and the draft keeps the last legal value. The draft is never NaN. `-0` becomes `0`.
- Up and Down add `step`, Shift 10 steps, Ctrl 100 steps. The result is rounded to `decimals` (no 0.1 + 0.2 drift) and kept inside `min` and `max`.
- `specFieldError(spec, value)` checks the type, the range and the decimal places. A page's `Rules.field` can call it.
- `formatValue` shows `decimals` places for a decimal field. The input mode is `decimal` when `decimals` is above 0, else `numeric`.

## Page adapter

`new TableEditor(adapter, saved, draft, {toolbar, status, scroll, footer})`. `PageAdapter`:

| Field | Role |
|---|---|
| `schema` | Fields and sections. |
| `rules` | `field(column, key, value)`: what is wrong with one cell. `cross(column, row)`: rules across fields, run only when every field of the column passes. `relevant(row, key)`: false dims the cell. |
| `remote` | `load()` and `save(table)`. A save answers ok, `invalid` with `Refusal[]`, or `network`. |
| `store` | `loadDraft`, `saveDraft`, `loadPrefs`, `savePrefs`. |
| `labels` | Toolbar title, filter placeholder, saved message, and `columnLabel(id)`. |

The editor also offers `draft()` and `state()` for a page's own buttons, and `headerSlot(column)`: an empty box in the column header that the page fills (the unit page puts a headshot there). `onChange(listener)` calls the listener with the new draft on every edit, undo, redo, revert and save, before the views redraw. It does not fire for the draft the editor starts with.

## Structure

| File | Role |
|---|---|
| `schema.ts` | Pure. Value, Row, Table, FieldSpec, Schema, Rules, Refusal, number parsing and formatting, `specFieldError`. |
| `model.ts` | Pure. `EditorState` (spec, saved, draft, undo, redo, unparsed text, route refusals) and the operations on it. |
| `rows.ts` | Pure. Bar fractions, filter, visible rows, view settings. |
| `store.ts` | Edges. `createLocalStore(prefix, sectionIds)` and `createHttpRemote(route)`. |
| `feed.ts` | Pure. A list of listeners; the editor's `onChange`. |
| `editor.ts` | Owns the state. Applies each action, redraws the views, runs the save. |
| `matrixView.ts`, `rowView.ts`, `cellView.ts`, `sectionView.ts`, `columnHeaderView.ts` | The table. |
| `toolbarView.ts`, `statusView.ts`, `footerView.ts`, `keys.ts` | The rest of the page. |
| `editor.css` | Styles for all of it. |

`dev/build.ts` (`el`, `button`) is shared with the map editor.

## State rules

- Undo steps are `{column, field, before, after}`. Edits to one cell join one step until focus leaves it (`seal`). Revert cell, column and all are one step each.
- Save is off with nothing to save or with any invalid cell. A route refusal does not turn it off. It clears when the cell is edited.
- The page asks before it closes with unsaved changes, except while a save is in flight.

## Persistence

`createLocalStore(prefix, ids)` keeps the draft at `<prefix>.draft` and the view settings at `<prefix>.prefs`. `ids` are the section ids a stored fold may name. Each stored draft cell is `{kind, key, value}`, the shape the unit page always wrote. Every access is guarded. The page works without storage.

## Save route

`createHttpRemote(route)` talks to a route made by `devJsonPlugin` (`apps/client/devJsonPlugin.ts`). The plugin is dev server only.

- `GET`: the file's JSON.
- `PUT`: the whole file. The plugin runs the page's `parse`. On success it writes `serialize(value)` beside the file, renames it over the file, and answers 200 with the value. On failure it answers 422 with `{errors}` and writes nothing.

A file that is not stored as a table (the sound page's `SoundTuning`) gives `createHttpRemote` a `Codec`: `decode(json)` makes the table from a GET or a 200, `encode(table)` makes the PUT body. The default is the table itself. A `decode` that throws shows as a load or save message.

On 200 the editor takes the response as the new saved file and drops the draft and the history. On 422 it reads each error as a `Refusal` (`createHttpRemote` takes an optional function for routes that name them otherwise) and maps it onto cells. On a network error it keeps the draft.

## Add a page

Write a schema, rules, labels and a route (`devJsonPlugin` in the Vite config). Make the HTML shell with `toolbar`, `status`, `scroll` and `info` ids. Build the adapter and call `new TableEditor`. Import `tableEditor/editor.css`. Keep storage keys under the page's own prefix.
