Source: packages/sim/src/formation.ts, packages/sim/src/intents.ts

# Move formations

`assignSpots(from, x, y)` gives each unit of one move order its own destination. `intents.ts` `move` calls it when the intent has no `path`. A move with a path uses `assignAlongPath` instead (`sim/path-spots.md`).

## Input and output

- In: `from`, a `Spot[]`, and the click point `(x, y)`. Each `Spot` is `{ unit, x, y }`. The `x, y` is where that unit starts the leg. `move` supplies the unit's position, or its last queued move when the order is queued (`sim/orders.md` `lastMove`).
- Out: `Spot[]`, each `{ unit, x, y }` with the destination. Spots are clamped to the map.
- One unit: it gets the click point.
- Empty list: empty result.

## Algorithm

1. Forward axis: from the centroid of the `from` points to the click. If the click is on the centroid, forward is `+y`.
2. Columns: `ceil(sqrt(2n))`. The block is about twice as wide as deep.
3. Rank by forward distance of the `from` point, front first, ties by id. Cut into rows of `cols` units.
4. Inside each row, sort along the side axis, ties by id. Neighbours stay neighbours, so paths do not cross.
5. Spacing: `2 * widest radius + 40` (`GAP`).
6. Place each row centred on the click. Offsets are doubled so a centred grid stays on integers. Axis vectors use scale `AXIS` = 1024.

## Invariants

- Pure and deterministic. All sorts have an id tiebreak.
- The sort key uses integer dot products, not angles.
- `move` also creates the group id (`world.nextId++`) for the whole order. `arrival.ts` reads it.
- Every client derives the spots from the click and the unit ids. The intent carries only the click.

## Design basis

- Pairing: units and spots are matched by rank along and across the move direction. That is O(n log n), keeps neighbours together and avoids crossing paths. It is a design choice, not copied from a shipped game.
- Not Hungarian: it gives the lowest total travel, but costs O(n^3). That is too slow for hundreds of units in one tick.
- Not greedy nearest-slot: it is cheap but paths can cross.
- Shipped RTS games differ. StarCraft 2 and Spring send every unit to the click and let push spread them. Supreme Commander and Age of Empires 4 use formations. This game uses slots plus arrival rules (`sim/systems/arrival.md`) and soft push (`sim/systems/separation.md`).
