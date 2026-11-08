Source: apps/client/src/ui/queueModel.ts, apps/client/src/ui/queueRow.ts, apps/client/src/ui/queueView.ts

# Build queue band

Shows the build queue of each selected own factory. It sits in the fixed 68 px band at the bottom of the unit panel (`#queue-band`, `client/ui/unit-panel.md`). A queue holds up to `MAX_QUEUE` (30) jobs, so the band groups them.

## queueModel.ts (pure)

`queueSummary(factories)` returns:

- `rows`: up to `MAX_ROWS` (2, what fits the band) `FactoryQueue` records.
- `more`: how many selected factories did not fit.
- `full`: every selected factory holds `MAX_QUEUE` jobs. The build grid uses it.

`FactoryQueue`:

- `head`: `{ job, kind, pct }` of the job in progress, or null when idle. `job` is its id. `pct` is `progress / buildTicks`, floored, at most 100.
- `next`: the jobs after the head as runs `{ kind, count, jobs }`. A run is a stretch of neighbours of one kind. `jobs` holds its job ids in queue order.
- `rest`: when there are more than `NEXT_TILES` (8) runs, `next` keeps the first 7 and `rest` counts the jobs of the others. Else 0.
- `mode`: the factory mode.
- `rate`: build progress per tick now. 1 mobile, 4 sieged, 0 in transition. It is the sim's `workRateOf` (`sim/units.md`).
- `slow`: `rate` is below the sieged rate.
- `secondsLeft`: `ceil(ticksLeft / rate · TICK_MS / 1000)`, or `null` when idle or paused.

`runsOf(queue, from)` is exported and pure.

## queueRow.ts

`QueueRow(portraits, cancel)` is one 30 px factory row, left to right:

1. Speed tag, 80 px. Text `mobile ×1`, `sieged ×4`, or `<mode> · paused`. Class `fast`, `slow` or `paused`.
2. Head tile, 30 px, gold border, the headshot with a progress fill. Dashed (`empty`) when idle.
3. Seconds left, 30 px.
4. `NEXT_TILES` run tiles, 24 px: the headshot and a `×N` badge (`q-count`) when the run has more than one job. When `rest` > 0 the tile after the last run is dashed (`more`) and reads `+N`. Unused tiles are hidden.

The fill animates with a CSS transition. When the head job restarts (percent falls), the transition is turned off for that update so it jumps back instead of sliding.

## Cancel

- Right-click a head or run tile: `actions.cancelJob(factory, jobs, false)`. The tile passes its job ids. The head cancels its job. A run cancels its last job.
- Shift+right-click: `many = true`. Up to 5 jobs of that run go, from its end, in one intent (`client/game/commands.md`).
- The `+N` and empty tiles do nothing. Job tiles show a pointer cursor and a red border on hover. The tile blocks the context menu.
- Locked (`HudModel.queueLocked`, `client/ui/model.md`): job tiles get class `locked`, which dims them, and the row drops their right-clicks.
- The refund is the full cost (`sim/systems/production.md`).

## queueView.ts

`QueueView(root, actions, portraits)` creates `MAX_ROWS` rows and a `+N more` badge (right side of the band) once. `update(summary, locked)` shows or hides rows and passes `locked` to each. It hides `#queue` when there are no rows. The band itself keeps its size.

## Rules

- All DOM writes use `setText`, `setClass`, `setWidthPct`, `setSrc` and friends.
- The model is read every `HUD_MS` (200 ms), so a quick second right-click may name a job that is already gone. The sim skips ids not in the queue, so no other job goes.

## Recipe: change what a row shows

Add the field to `FactoryQueue` in `queueModel.ts`. Render it in `QueueRow.update`. Add the element in the `QueueRow` constructor. Check that the row still fits the band width (426 px) and leaves room for `+N more`.
