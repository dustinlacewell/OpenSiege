Not built. The rest of the level editor.

# Level editor: what is left

The editor is built as a dev page in the client, not as a separate `apps/editor`: `client/dev/map-editor.md`. It has height brushes, material paint, feature place/scatter/erase, resource zone place/erase, per-stroke undo, and save and load. The pure brush and file code is `packages/map`.

## Not built

- Resource zones: move and drag to resize on the map. `moveField` and `resizeField` exist in `packages/map`; the page has no tool for them.
- Spawn hints, if the game wants them.

## Checks

- Nav connectivity: warn when hand-placed rocks seal open ground (the `keepConnected` rule).
- Field count at the shader cap, shown as a warning. Today a place past the cap does nothing.
- Terrain too steep to cross where a path is expected.
