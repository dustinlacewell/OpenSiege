Source: apps/client/src/ui/mapTile.ts, apps/client/src/ui/mapTileView.ts

# Map tile

A square picture of a map with its name. Pages use it to show the map of a match.

## mapTile.ts (pure)

`mapTile(map)` gives a `MapTile`:

- `{ kind: "preview", name, url }` when the map has a preview image.
- `{ kind: "named", name }` when it has none.
- `{ kind: "random" }` for null (a generated map).

`TileMap` is `{ name, preview }`. A `MapInfo` from `@mf/map` fits it by shape.

## MapTileView

`new MapTileView(root)` draws a tile into a `.map-frame` element. `root` holds a `.map-preview` image, a `.map-random` mark and a `.map-name` chip. `draw(tile)` sets them:

- `preview`: the image shows and fills the frame (`object-fit: cover`). The name sits in a dark chip at the top left.
- `named`: no image, a large "?" and the name in the chip.
- `random`: the "?" and the chip "Random map".

The skirmish card uses it (`client/ui/skirmish/setup-card.md`).
