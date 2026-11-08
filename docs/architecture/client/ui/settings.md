# Settings and the pause menu

Player settings, a tabbed modal to edit them, and a pause menu over the match.

## Parts

- `settings/settingsModel.ts` (pure): `SettingsValues`, `DEFAULT_SETTINGS`, and `SETTINGS_TABS`. Each tab lists fields (`toggle`, `choice` or `range`). Adding a setting is one value key, one default, one field entry.
- `settings/settingsStore.ts` (pure): `parseSettings` merges stored data over the defaults and drops unknown or invalid values. `SettingsStore` holds the values, saves on `set`, and calls subscribers. It takes a `StorageSlot` (`get`/`set` of one string).
- `settings/localStorageSlot.ts`: the localStorage `StorageSlot`. Every access is in try/catch. A storage that throws only loses persistence.
- `ui/settingsModal.ts`: draws the tabs and fields from the model. Reads and writes the store. The Controls tab shows the fixed `#settings-controls` list from `app/shell.html`.
- `ui/pauseOverlay.ts`: the Resume / Settings / Leave game menu. It is only an overlay. The sim keeps running. Its dim backdrop covers the page and takes the pointer events.
- `ui/pauseModel.ts` (pure): `escapeAction`.

## Buttons

`?` opens the modal on Controls. The gear under it opens Graphics. Both sit at top left on every screen.

## Esc

Esc is the `cancel` hotkey. `cancel()` in `input/actions/target.ts` returns true when it left a target mode (guard, attack-move). Then Esc is done. Otherwise `hotkeyActions` calls `onIdleEscape`, bound in `main.ts`, which applies `escapeAction`:

1. Settings modal open: close it.
2. Pause menu open: close it.
3. A match is running (`Screens.inMatch()`): open the pause menu.
4. Else nothing.

`Keys` ignores Esc while a text field has focus. Any screen change hides the pause menu. Leave game runs the same flow as the end card's button.

## Settings in use

- `renderScale` multiplies `devicePixelRatio` in `app/frameLoop.ts`, so the canvas buffer size changes.
