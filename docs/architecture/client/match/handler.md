Source: apps/client/src/match/handler.ts, apps/client/src/app/clientLink.ts

# Match handler

`handleMatch(msg, session, deps)` applies one `MatchMsg` (`net/match-messages.md`) to the `Session` and the screens. `ClientLink.deliver` calls it (`client/app/client-link.md`).

## Cases

- `welcome` (`startMatch`): builds the sim state from `decodeWorld(world)` with `createSimState`, calls `setCameraMap(deps.cam, mapSize(world.terrain))` so the camera knows the map and centres on it, then `session.start(you, new Lockstep(sim, deps.lockstep, now()))` and `screens.match()`.
- `turn`: `session.lockstep?.receive(msg, now())`. The arrival time feeds the playout clock (`client/game/playout.md`). A turn out of sequence (`receive` returns false) is a desync: it logs `turn out of sequence: expected E, got G`, then takes the `desync` path (`client/game/lockstep.md`). With no lockstep the turn is dropped.
- `ended`: `screens.ended(msg.winners)`. The session keeps its last world, so the frozen match shows behind the end card.
- `desync`: `session.stop()` and `deps.restart()`.

## HandlerDeps

`HandlerDeps` holds the game camera `cam`, the lockstep deps (`step`, `hash`, `onHash`), a `ScreenEvents` (`match`, `ended`), a `now()` clock and `restart()`. They are injected so the handler is testable without the DOM.

## Invariants

- This folder knows the messages and the `Session`. It does not touch the DOM or GL.
- Each match gives a new player id (`net/turn-flow.md`).
