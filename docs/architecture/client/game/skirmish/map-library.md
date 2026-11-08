Source: apps/client/src/game/skirmish/mapLibrary.ts, packages/map/src/draw.ts, packages/map/src/library.ts

# Skirmish map library

The maps a skirmish can play: every hand-made map, then a generated one. Pure. The files are read at the edge (`client/app/map-assets.md`).

- `libraryFiles(texts, previews)`: pairs each map text with the preview URL that has the same file stem. A stem is the file name without folder and extension. A map with no preview gets null. Gives `LibraryFile[]` (`map/library.md`).
- `skirmishDraws(library)`: one `MapDraw` per library map in stem order (`drawById`), then the generated map last (`drawById` with null). The generated draw has `info` null. It uses `DEFAULT_MAP_PARAMS`. See `map/draw.md`.

The setup card steps through these draws (`client/ui/skirmish/model.md`).
