Source: apps/client/src/app/mapAssets.ts, apps/client/src/game/skirmish/mapLibrary.ts, packages/map/src/library.ts

# Map assets

`loadLibrary()` reads the hand-made maps of the repo `maps/` folder through the bundler and returns the library.

- `import.meta.glob` collects `maps/*.json` as raw text (loaded on demand) and `maps/*.jpg` as URLs (eager). The tutorial map lives in a subfolder and is not matched.
- `libraryFiles(texts, previews)` (`game/skirmish/mapLibrary.ts`, pure) pairs each map text with the preview that has the same file stem. It gives `LibraryFile[]` (`map/library.md`).
- `buildLibrary(files, log)` parses them. A bad file is logged with `console.warn` and skipped.

The result is `LibraryMap[]`, sorted by stem. `main.ts` hands it to `skirmishDraws` to make the maps the setup card offers (`client/game/skirmish/map-library.md`).
