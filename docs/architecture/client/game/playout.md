Source: apps/client/src/game/playout.ts

# Playout clock

A pure, jitter-buffered clock. It decides which turns are due and how far through the current turn the view is. `Lockstep` holds the state and calls it.

Every function takes a `Playout` and `now` (ms) and returns a new `Playout`. No timers, no DOM. Tests pass times by hand.

## State

- `time`: sim time in ms. Turn `t` is due once `time >= t * TICK_MS`.
- `lastNow`: the `now` of the last `advance`.
- `rate`: the speed of `time` against real time. 1 is exact.
- `arrivals`: recent `{ at, offset }` records. `offset = arrival now - tick * TICK_MS`.
- `jitter`: smoothed spread of arrival offsets, in ms.

## Functions

- `startPlayout(tick, now)`: `time = tick * TICK_MS`, no arrivals, `rate = 1`, `jitter = 0`.
- `noteArrival(p, tick, now)`: records an arrival. Drops records older than `WINDOW_MS` (2000). The spread is the offset minus the smallest offset in the window. The first spread sets `jitter`. After that `jitter` follows an EWMA with factor `JITTER_EWMA` (0.1).
- `advance(p, now, lastReceived)`: moves `time` toward its target (below).
- `dueTick(p)`: `floor(time / TICK_MS)`. The highest due turn.
- `progress(p, steppedTick)`: `(time - steppedTick * TICK_MS) / TICK_MS`, clamped to 0..1.
- `delayOf(p)`: `TICK_MS + clamp(2.5 * jitter, 20, 250)`. The playout delay.

## advance

The target is `now - base - delay`. `base` is the smallest offset in the window, the best latency seen. `error = target - time`.

- No arrivals yet: only `lastNow` changes. The clock waits.
- `error > RESET_MS` (4 turns): hard reset. `time` jumps to the target and `rate = 1`.
- Else: `rate = 1 + clamp(error * GAIN, -0.08, 0.08)`, with `GAIN` = 0.0005. `time` grows by `(now - lastNow) * rate`. A client that is behind speeds up by at most 8%. A client that is ahead slows by at most 8%.
- `time` never passes `(lastReceived + 1) * TICK_MS`, so it never runs past the last turn that arrived.
- `time` never goes backward.

## Behaviour

- Steady network: the delay settles near one tick plus 20 ms.
- Jittery network: the delay grows up to one tick plus 250 ms, so late turns still arrive before they are due.
- A stall that leaves the clock more than 4 turns behind: the clock jumps and `Lockstep.update` steps the turns that arrived in one frame.
- A gap in turn numbers never reaches the clock. `Lockstep` refuses the turn and the client restarts (`client/game/lockstep.md`).

## Tuning

Constants at the top of the file: `WINDOW_MS`, `JITTER_EWMA`, `MIN_PAD_MS`, `MAX_PAD_MS`, `MAX_RATE_DEV`, `GAIN`, `RESET_MS`.
