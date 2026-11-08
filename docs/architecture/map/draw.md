Source: packages/map/src/draw.ts, packages/map/src/library.ts, packages/sim/src/generateMap.ts

# Map draw

Which map a match plays. Pure: randomness is injected. The pool is every library map (`map/library.md`) plus one generated slot.

## Types

```
MapInfo    { id, name, preview }        // what a screen shows of a map. id is the library map's file stem
MapDraw    { info: MapInfo | null, spec(seed) -> MapSpec }
MapChoices { maps: MapInfo[], randomMap: boolean }
```

`info` null means a generated map. A screen shows it as "random".

## Functions

- `drawMap(library, params, random)`: one uniform pick from the pool with `random()`. `params` null drops the generated slot. An empty library always gives the generated slot. No slot at all throws.
  - A library map: `info` is `{ id: stem, name, preview }`. `spec(seed)` gives its spec and ignores the seed.
  - The generated slot: `info` is null. `spec(seed)` is `generateMap(seed, params)` (`sim/map-spec.md`).
- `drawById(library, params, id)`: the draw for the library map with this stem, or the generated draw for a null id. Null when the pool has no such slot.
- `mapChoices(library, params)`: every library map as `MapInfo`, and whether a generated slot exists.
- `mapLabel(draw)`: the name in quotes, or `random`, for a log line.

## Users

The skirmish setup makes one draw per library map plus the generated one with `drawById` (`client/game/skirmish/map-library.md`). The setup card steps through them. `LocalHost.skirmish` calls `draw.spec(seed)` once per match.
