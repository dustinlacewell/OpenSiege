Source: packages/sim/src/detection.ts, packages/sim/src/units.ts, packages/sim/src/teams.ts

# Detection

`detect(world, grid)` returns a `Detection`: the one rule for what a team knows of a unit. The sim, the AI and the client fog all ask it, so a unit the player cannot see is one no unit of theirs can shoot. `grid` is `buildGrid(world.units, mapSize(world.terrain))`, built at the same moment.

## Levels

- `seen`: some living teammate's unit has the target within its `sight`, and `clearLine` from its eye to the target's top is clear (`sim/line-of-sight.md`). Eye and top are ground height plus the kind's `height`.
- `radar`: not seen, but within some living teammate's `radarRange` (`siegeRadar` when sieged, else `radar`, `sim/units.md`). Hills do not block radar.
- `none`: neither, or radar only and jammed.

## Jamming

A target is jammed when some living unit on its own team has it within that unit's `jamRange` (`siegeJam` when sieged, else `jam`, `sim/units.md`). A jammed target cannot be `radar`. It can still be `seen`. A jammer jams itself (distance 0). Only the jammer kind has a jam radius above 0. A jammer does not hide enemy units from its own team's radar.

Own and allied units are always `seen` (`sameTeam`, `sim/teams.md`). `detects(viewer, u)` is `level(viewer, u) !== "none"`.

## One answer per tick

At build time `detect` copies each unit's id, owner, kind, mode, `x`, `y` and `hp`. Classification reads only that copy, for the viewers and for the queried unit. A unit that moves or dies later in the tick does not change an answer. A mine that blows in `combat` still spots for the gun after it.

A unit not in the copy (spawned after the build) is `none`, unless own or allied. Terrain is read live; nothing before `projectiles` changes it.

The work is lazy. A unit is classified the first time a team asks for it, then memoised per (team, unit id). The grid query radius is the largest `sight`, `radar`, `siegeRadar`, `jam` or `siegeJam` of any kind, so it finds every viewer and every jammer.

## Mines

`detectionFor(u, seen)` is the detection a unit picks and keeps targets by. A mine gets `everything`, which detects every unit: it hits by contact. Every other unit gets `seen`.

## Callers

- `step` builds one `seen` per tick from the `before` grid and passes it to `lostTargets`, `engage`, `combat` and `movement` (`sim/tick-order.md`).
- The `attack` intent builds one per intent and ignores an undetected target (`sim/intents.md`).
- The AI picture (`ai/perception.md`) and the client fog (`client/game/vision.md`) build one per update.

## Invariants

- Pure: reads the world, writes nothing. Not part of the state hash.
- Integer math only (`sim/determinism.md`).
