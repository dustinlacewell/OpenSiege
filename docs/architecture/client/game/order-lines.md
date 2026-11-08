Source: apps/client/src/game/orderLines.ts, apps/client/src/game/arcLines.ts, apps/client/src/game/groundLines.ts, apps/client/src/render/rangeLines.ts

# Order lines

Lines that show what own units are doing. The logic is in `game/`. The GL batch is in `render/`.

## Seam

`buildOrderLines(sink, poses, view)` pushes segments into any `LineSink` (`client/game/ground-lines.md`). `view` = `{ me, selected, terrain }`. A test can pass any sink. Do not import `render/` here.

## What is drawn

Only own units get lines. Positions come from poses.

Unselected own units show their first leg, faint:
- Violet guard arc to the guarded unit, when the head is a `guard`. The lines below still draw.
- Red line to the pose of the target. The target is the head `attack` order, else `Unit.target` (what the weapon is aimed at).
- Else, green line to the head `move` point. Orange for an attack-move.
- Else, lime line and ring to the scrap of a head `reclaim`.

Selected own units show the whole queue (`orderChain`), brighter and wider:
- Weapon line, red and faint, to `Unit.target`. Only when the head is not an `attack`.
- A line from the unit to the first order, then from each order to the next.
- `move`: green line to the point and a small ring there (a waypoint). An attack-move (`attack: true`) draws both in orange, between move green and attack red.
- `attack`: red line to the target pose. The next leg starts at the target. A target that is gone is skipped.
- `engage`: drawn as an `attack`. Its anchor is not drawn. The same rule applies to the head checks above.
- `guard`: violet arc to the top of the guarded unit. The next leg starts there. A target that is gone is skipped.
- `reclaim`: lime ground line to the scrap and a ring at its radius. The next leg starts there. The scrap comes from `OrderView.features`. A feature that is gone, or is no longer scrap, is skipped.
- `siege`: a blue square at the place it happens. That is the last `move` or `reclaim` point before it, or the unit if none.

Each leg fades to `LEG_FADE` (0.6) at its end. Unselected lines fade to `FAR_FADE` (0.15). Unselected guard arcs use a faint style and fade to `LEG_FADE`.

## Guard arcs

`game/arcLines.ts` `arc(sink, a xyz, b xyz, rise, style, fadeEnd)` emits a parabola of 16 straight segments into the `LineSink`. Its middle sits `rise` above the chord. It is pure and needs no new GL program: `LineBatch` already draws any 3D segment.

An arc runs from the top of the unit (`pose z + UNIT_STATS.height`) to the top of the guarded unit, from interpolated poses, so it tracks motion. A queued guard after a move starts at the ground at the move point. `rise` = `min(400, 30 + 0.25 · length)`.

A selected factory with a `rally` also gets: a gold line, a ground circle at the point, and a pennant on a pole that points away from the factory.

## Range circles

`render/rangeLines.ts` `rangeCircle(sink, terrain, x, y, radius, style)` draws a dashed circle (96 sides, every other one) draped on the ground. `OverlayPass` calls it for the siege range of a selected own armed unit, in any mode, and for a sieged unit with a `workRange` (the engineer). The mobile range uses the solid `ring` (`client/render/overlay.md`). It uses the same `LineSink`.

## Invariants

- Poses are looked up by id with binary search, so `PoseTable` must follow the sorted unit order.
- Enemy orders are not shown.

## Recipe: add a line

For a new order type, add a branch in `orderChain`. For a new shape, add it to `groundLines.ts`.
