Source: apps/client/src/render/lightTiles.ts

# Light tiles

`LightTiles.bin(data, count, viewProj, width, height)` sorts the packed lights into screen tiles of `LIGHT_TILE` (32) pixels. It is pure: no GL. The upload is in `LightTextures` (`client/render/lights.md`).

## Pixel space

The space is the one of `gl_FragCoord` in the target: x from the left, y from the bottom. Tile `(0, 0)` is the bottom left. `tilesX = ceil(width / 32)`, `tilesY = ceil(height / 32)`. A pixel is `(ndc · 0.5 + 0.5) · size`, with no y flip.

## Screen rect of a light

1. Bounding sphere of the capsule: centre is the midpoint of A-B, radius is `radius + |AB| / 2`.
2. Project the 8 corners of the sphere's world box with `viewProj`.
3. If any corner has clip `w <= 0.001`, the light covers every tile.
4. Else take the pixel min and max. A rect fully off screen covers no tile. Otherwise clamp it to the tile grid.

The rect is conservative: a tile may get a light that adds 0 there, but never misses one.

## Output

- `tiles`: per tile, row by row from the bottom, `(offset, count)` into `indices`.
- `indices`: light numbers. Each tile's run is in light order.
- `indexCount`: entries used.

Lights come in strongest first (`LightPool.pack`), so each run is strongest first.

## Caps

- `MAX_PER_TILE` (64): a tile keeps its first 64 lights, the strongest.
- `LIGHT_INDEX_CAPACITY` (32768): when the offsets reach it, the tile at the edge keeps what fits and later tiles keep none. Offsets and counts stay consistent.

## No per-frame allocation

`indices` has a fixed size. `tiles` and the per-tile cursor are made again only when the tile count changes.
