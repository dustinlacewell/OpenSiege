Source: packages/sim/src/grid.ts, packages/sim/src/mapSize.ts

# Spatial grid

`buildGrid(units, m)` takes the units and the map size `m` (`MapSize`, `sim/map-spec.md`). It makes a spatial hash over unit indices. Systems use it to find nearby units without an O(n squared) scan.

## Shape

- Cell size 1000 world units. `ceil(width / 1000)` cells on `x` and `ceil(height / 1000)` cells on `y`. A cell index is `cy * sideX + cx`.
- Built by counting sort. Each cell keeps units in index order.
- `grid.query(x, y, r, out)` clears `out`, fills it with the indices in the square `(x, y) ± r`, and returns it.
- Cells are walked row by row (`y` then `x`). The result order is fixed.
- Positions outside the map clamp to the edge cells.

## Rules

- The result is a coarse filter. The caller must test exact distance.
- Indices point into the `units` array the grid was built from. They go stale when units are added, removed or reordered (`sim/tick-order.md`).
- The caller owns `out` and reuses it between queries to avoid allocation. Do not hold the returned array across another query on the same buffer.
- To find bodies, pad the radius with `MAX_RADIUS` (`units.ts`).
- Iteration order of results is cell order, not id order. If a rule depends on order (for example "nearest wins, ties first"), it must say so itself. `combat` uses strict `<` on distance, so the first found keeps a tie.

## Users

`repair`, `combat`, `arrival`, `separation`, `projectiles` and `impact`.
