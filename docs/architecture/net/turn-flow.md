Source: packages/protocol/src/index.ts, apps/client/src/match/handler.ts, apps/client/src/match/localMatch.ts, apps/client/src/game/lockstep.ts, apps/client/src/game/playout.ts, apps/client/src/app/clientLink.ts

# Turn flow: welcome, turn, ended

A match host feeds a `MatchLink` (`client/app/match-host.md`). This file follows one match from the host's side.

## Start

1. The host builds the starting world. `LocalHost` steps every `join` itself, so the world already holds all players (`client/game/skirmish/world.md`, `client/game/tutorial/core.md`). Its tick T is 1 for a skirmish.
2. The host delivers `{t:"welcome", you, world}`. `world` is the state after tick T.
3. The client decodes the world and starts `Lockstep` with `lastQueued = T`.
4. The first turn carries tick T+1.

A host that sends a world with no players must queue a `{join, name, x, y, team}` for every player. Turn T+1 then carries them all, and the client steps it and sees all spawns. `welcome` and the first queue must happen in one synchronous call, so no turn reaches the client between them.

## Each tick (every 100 ms)

The host clock (`LocalMatch.turn`):

1. If the client is paused (`link.paused()`), do nothing.
2. Take the intents queued since the last tick and reset the queue.
3. Deliver `{t:"turn", tick: tick + 1, intents}`.
4. Check the end rule. When it holds, stop and deliver `{t:"ended", winners}`.
5. Else let each bot think on the stepped world. Its intents wait for the next turn.

A turn is sent even when it has no intents. The client needs it to advance.

## Client side

- `handleMatch` passes `turn` and the arrival time to `Lockstep.receive(turn, now)`. It accepts only `tick === lastQueued + 1`. Anything else is a desync (`net/desync-check.md`).
- `Lockstep.update(now)` runs once per frame. A playout clock decides which queued turns are due and steps all of them (`client/game/playout.md`). The clock adds a delay of one tick plus 20 to 250 ms, sized from the measured arrival jitter.
- On a step it saves unit and shell poses first, then calls `step()`. If `turn.tick % 50 === 0` it calls `host.checkpoint(tick, hash)`.

## Latency

A command has no local prediction. It shows up after: the intent reaches the host, up to one tick, one turn delivery, and the playout delay (one tick plus the jitter pad, 20 to 250 ms).

## Intent order

The order in a turn is the order the host received them. The sim applies them in that order.

## Leave

The player leaves through `host.leave()`: the pause menu's Leave or the end card's button. `LocalHost` stops the match and calls its `onHome`. It sends no `leave` intent.

## End

After each turn the host checks the end rule (`client/match/local-match.md`). When it holds, the host delivers `{t:"ended", winners}`. The client shows the end card. Its button calls `host.leave()`.
