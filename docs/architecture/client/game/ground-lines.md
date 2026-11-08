Source: apps/client/src/game/groundLines.ts, apps/client/src/render/lines.ts, apps/client/src/render/rangeLines.ts

# Ground lines

Shapes that follow the terrain. They write into a `LineSink`, so `game/` code never imports `render/`.

## Types

- `LineStyle` = `{ r, g, b, a, widthPx }`.
- `LineSink` = `segment(ax, ay, az, bx, by, bz, style, fadeA, fadeB)`. `fadeA` and `fadeB` scale the opacity at each end.

`render/lines.ts` `LineBatch` implements `LineSink`. A test can pass any other sink.

## Shapes

All shapes lie `LIFT` (6) units above `heightAt`.

- `drape(sink, terrain, ax, ay, bx, by, style, fadeEnd)`: a ground-hugging line. It splits every `STEP` (75) units, into at most `MAX_STEPS` (48) pieces. Opacity falls from 1 at `a` to `fadeEnd` at `b`. A line shorter than 1 unit is skipped.
- `ring(sink, terrain, x, y, radius, segments, style, fade)`: a ground circle of straight pieces.
- `square(sink, terrain, x, y, half, style, fade)`: an axis-aligned ground square centred on the point.

`render/rangeLines.ts` `rangeCircle` builds on the same sink for range circles (`client/render/overlay.md`).

## Used by

`game/orderLines.ts` (`client/game/order-lines.md`). `render/overlay.ts` imports `LineStyle` for its range colours.

## Invariants

- Pure: no state, no GL, no DOM.
- Only `heightAt` from the sim is read.
