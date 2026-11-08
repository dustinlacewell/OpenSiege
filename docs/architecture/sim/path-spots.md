Source: packages/sim/src/pathSpots.ts, packages/sim/src/intents.ts

# Path spots

A move intent with a `path` of 2 or more points spreads its units along that line, not in a block. `intents.ts` `move` calls `assignAlongPath` then. Without a path it calls `assignSpots` (`sim/formation.md`).

## spreadAlong(path, n)

- Gives `n` points on the polyline, evenly spaced by arc length.
- Point `i` sits at arc length `floor((2i + 1) · total / (2n))`: the centre of the i-th of n equal pieces. So one point is the midpoint.
- Segment lengths use `isqrt`. Positions inside a segment use `floor`. Zero-length segments are skipped.
- Points are clamped to the map.
- The client imports it for the drag preview, so the preview marks match the sim (`client/input/actions.md`).

## assignAlongPath(from, path)

- `from` is a `Spot[]` of leg starts, as for `assignSpots`.
- Rank: the integer dot product of `(start - path[0])` with `(path[last] - path[0])`, low first, ties by id.
- Rank `i` takes point `i` of `spreadAlong(path, n)`. Units near the path's start go near its start, so paths do not cross.
- A path with no length (all points equal) falls back to `assignSpots` at that point.

## Path input

- `MAX_PATH_POINTS` (32, `stats.ts`) caps the path.
- `move` reads the path itself: an array of at most 32 points with numeric `x` and `y`, truncated and clamped. Anything else drops the whole intent.
- The intent still carries `x, y`. The client sets them to the last path point.

## Invariants

- Pure and deterministic. Integer math only. The sort has an id tiebreak.
- The intent carries only the path. Every client derives the same spots from it.
