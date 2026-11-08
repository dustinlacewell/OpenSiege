Source: apps/client/src/render/overlay.ts, apps/client/src/game/guideMarks.ts, apps/client/src/render/marks.ts, apps/client/src/render/overlayShader.ts, apps/client/src/render/lines.ts, apps/client/src/render/rangeLines.ts

# Overlay: marks, bars and lines

`OverlayPass` draws selection rings, range circles, order lines, the curve move preview, the area reclaim preview and bars. It draws in two places in the frame.

## Ground marks: `drawGround(frame, poses)`

Runs inside the HDR scene, after contact shadows and before units. So units cover the marks.

For each selected unit (`frame.selected`):

- A ring at the pose, radius `1.35 · UNIT_STATS.radius`, 2 px, green.
- An own armed unit (`weaponOf` defined): both weapon ranges, in any mode. `weaponOf({ kind, mode: "mobile" }).range` as a solid pale-yellow ground ring (`ring`, 96 sides). `weaponOf({ kind, mode: "sieged" }).range` as a dashed orange `rangeCircle`. These are base ranges, without the height bonus.
- An own unit whose kind has `siegeRadar` above `radar` (the radar truck): a solid teal ring at `radar` and a dashed teal circle at `siegeRadar`. Every kind has some radar, so only kinds whose siege extends it get rings, the same rule as the unit panel's Radar readout.
- An own unit whose kind has `jam` or `siegeJam` above 0 (the jammer): a solid violet ring at `jam` and a dashed violet circle at `siegeJam`. The dashed circle is skipped when it equals the solid ring.
- If `sieged` and the kind has `workRange` above 0: a dashed blue circle at `workRange`. The stats decide, not the kind name.

For the unit with id `frame.guardHover` (guard mode, `client/input/actions.md`): a violet ring, radius `1.6 · UNIT_STATS.radius`, 3 px. It shows which unit a click would guard.

Then `buildOrderLines(lines, poses, view)` adds order lines and guard arcs (`client/game/order-lines.md`). Arcs are plain 3D segments in the same `LineBatch`.

If `frame.curve` is set (a right-drag curve move, `client/input/actions.md`), `pushCurve` drapes its `path` into the line batch, green, 2 px. It puts a ring of radius `SPOT_RADIUS` (14) at each of its `spots` into the ground marks batch. The spots come from the sim's `spreadAlong`, so they are where the units will go.

If `frame.area` is set (a right-drag area reclaim), `pushArea` drapes its circle into the line batch (`ring`, 96 sides). It uses `RECLAIM_SELECTED` from `game/orderLines.ts`, the lime of reclaim lines. Each scrap whose centre is in the circle (`scrapsInCircle`) gets a lime ring of `1.2 ·` its radius in the ground marks batch. These are the wrecks the release will reclaim.

If `frame.guide` is set (a tutorial, `client/game/tutorial/core.md`), `pushGuide` draws its highlights in gold:

- Each id in `guide.units` with a pose gets a ring in the ground marks batch, radius `1.8 · UNIT_STATS.radius`. Its thickness (2 to 4 px) and alpha pulse once every 1.2 s.
- Each zone in `guide.zones` gets a ground circle at its radius in the line batch (`ring`, 96 sides), like `pushArea`. Its opacity pulses once every 2.4 s.
- A gold arrow bobs above each ringed unit, at the unit's height, pointing down. With no ringed unit, it bobs above each zone centre instead. It faces the camera (`cam.right`), and its size scales with `cam.dist`, so it reads the same at any zoom.
- `guide.gesture` is acted out on a 2.6 s loop: a press ring at `from` and a cursor ring moving to `to`, then a fade. A `line` uses the right-drag curve's green: the line grows behind the cursor, then the three slots the units take show. A `circle` uses the area reclaim's lime: a circle centred on `from` grows to the cursor, then each scrap inside it gets a ring. It hides while the player makes the same drag in the right place (`gestureTaken`): a curve move pressed within half the line's length plus 150 of its middle, or an area reclaim centred within the shown circle plus 150.
- The pose table holds only seen units (`keepVisible`). So a unit the player cannot see gets no ring.
- The pulse, the ring list, the arrow and the gesture are pure, in `game/guideMarks.ts`. The ring list and the arrow reuse their objects.

Draw order: lines in the decal state, then rings in the overlay state (no depth test). Both use a gain of 2.4 so they match nominal colour after tone mapping (`client/render/hdr-and-post.md`).

## Screen bars: `drawScreen(frame, poses)`

Runs after `post`, on the final image.

- Health bar: for selected or damaged units. Colour from green through yellow to red.
- Build bar: for own factories with a job, above the health bar, gold. Fill is head `progress / buildTicks`.
- Position: a world point `ground + height + 14` above the unit. Width and height are in CSS pixels, scaled by `dpr`.

## MarksBatch and MarksProgram (`marks.ts`)

One shader, two batch instances (ground with gain 2.4, screen with gain 0).

- Kind 0 `ring`: `ring(x, y, z, radius, thickPx, rgba)`. Lies flat. Edge width in pixels from `fwidth`.
- Kind 1 `bar`: `bar(x, y, z, widthPx, heightPx, fill, liftPx, rgba)`. Anchored to a world point, sized in pixels.
- Stride 12: `x, y, z, kind | four params | rgba`.

## LineBatch (`lines.ts`)

Implements `LineSink` (`client/game/ground-lines.md`). Each `segment` becomes one instanced quad, widened in screen space to `widthPx · dpr` with an antialiased edge. Stride 12: `a xyz | b xyz | rgb, width | opacity a, opacity b`. The caller sets the blend state before `draw`.

## Invariants

- Pose order is unit id order. The pass relies on it only through `buildOrderLines`.
- Bars and rings read `UNIT_STATS` for size. A new kind works with no change here.
- Reuse the hp colour array. Do not allocate per unit.

## Recipe: add a mark

Add a `MarksBatch` method that writes a new `kind`, a branch in `overlayShader.ts`, and a call in `pushSelected` or `pushBars`.
