Not built. Proposal.

# Craters

Every blast that reaches the ground dents it. A dent lowers height-map vertices. No caves, no overhangs.

## Reach

A blast at height `h` above the ground, with radius `r`, reaches the ground when `h < r`. The dent scales by `(r - h) / r`. A ground hit dents fully. A hit on a tall unit dents less.

A blast with `radius` 0 (most direct shells) still dents. It uses one terrain cell as its radius.

## stampCrater(terrain, blast)

Pure, in `sim/src/terrain/crater.ts`. Returns the box of vertices it changed, or null.

- `depth = blast.dig`, times the reach scale. Integer, floored. `dig` is a unit stat (`dig` for shells, `deathDig` for the death blast), set by hand, independent of damage.
- Each vertex within the crater radius drops by `depth * (r² - d²) / r²`. A bowl, deepest at the centre.
- Vertices change in index order. All integer math.
- No rim in the first build. A rim raises heights and makes the dig limit two-sided.

## Dig limit

`World` gets `dug`: a `number[]`, one entry per terrain vertex. It counts how far the vertex went below its start. It is match state, so `Terrain`, the map files and the map editor do not change.

- A vertex never goes deeper than `MAX_DIG` below its start, and never below 0.
- `dug` is in the snapshot and in `hashWorld`, like `heights`.
- No refilling over time.

## Slope blocks driving

No new rule. A crater changes heights. The nav cells it touches are rebuilt with `cellGrade` (`nav-update.md`). A wall steeper than a class's `maxGrade` blocks that class. A shallow dent blocks nothing.

## Known limit: coarse height map

Vertices are `terrain.cell` apart (125 on the default map). A dent can be no narrower than one cell. A small shell lowers the one nearest vertex a little. Many hits wear the ground down. Finer craters need finer cells (`future-work/editor/finer-cells.md`).

## Constants

`MAX_DIG` lives in `terrain/crater.ts`. Tune it in play. Each shot's depth is the unit stat `dig` or `deathDig`. The minimum radius is one terrain cell, not a constant.

## Tests

- A ground blast lowers the centre vertex most. Vertices outside the radius do not change.
- A blast high above the ground dents nothing.
- Repeated blasts stop at `MAX_DIG` and at 0.
- The returned box holds every changed vertex and no more.
