Source: packages/map/src/library.ts, packages/map/src/file.ts

# Map library

The hand-made maps of one folder. Pure: the folder reads happen at the edge and arrive as `LibraryFile`s. A map is `<stem>.json` in the map file format (`parseMap`, `client/dev/map-editor.md`). A `<stem>.jpg` beside it is its preview.

## Types

```
LibraryFile { stem, text, previewUrl }   // one map file, read. previewUrl null = no preview
LibraryMap  { stem, name, spec, preview } // a good map. preview is a URL or null
```

## Functions

- `MAP_STEM`: `^[a-z0-9-]+$`. A map file name is lower-case letters, digits and dashes.
- `mapStems(files)`: the stems of the `*.json` names whose stem matches `MAP_STEM`, sorted. Other files are ignored.
- `buildLibrary(files, log)`: sorts the files by stem and parses each with `parseMap`. A bad file is logged with its errors (`map <stem>.json skipped:` and one line per error) and skipped. The result is `LibraryMap[]` in stem order.

## Users

The client reads the repo `maps/` folder through the bundler and builds the library with these functions (`client/app/map-assets.md`). `drawMap` and its siblings pick from it (`map/draw.md`).
