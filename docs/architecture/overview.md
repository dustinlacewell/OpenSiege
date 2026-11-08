Source: packages/sim/src/index.ts, packages/sim/src/step.ts, packages/protocol/src/index.ts, apps/client/src/app/start.ts, apps/client/src/app/matchHost.ts, apps/client/src/match/localMatch.ts

# OpenSiege overview

OpenSiege is a real-time strategy game. It runs as deterministic lockstep.

## The lockstep model

- The client holds a full copy of the game state (`World`).
- The only input to the game rules is a list of intents (player commands).
- A match host collects intents and orders them into numbered turns.
- The client calls `step(state, intents)` once per turn. `state` is the world plus the nav data derived from it (`sim/nav/nav-grid.md`).
- The same state plus the same intents gives the same new state, bit for bit.
- After the first `welcome` the host sends no game state. It sends only turns.
- One tick is `TICK_MS` = 100 ms. One turn is one tick.

The client does not care who the host is. It sees four messages: `welcome`, `turn`, `ended` and `desync` (`net/match-messages.md`). The host in this repo is `LocalHost`. It runs a match on this machine with a turn clock (`client/match/local-match.md`).

## The packages

- `packages/sim` (`@mf/sim`): game rules. Pure TypeScript. No DOM, no Node, no I/O. See `sim/`.
- `packages/map` (`@mf/map`): the map file format, the map editing logic, the map library and the map draw. Pure TypeScript, depends on sim only. See `map/`.
- `packages/protocol` (`@mf/protocol`): the match messages a host and a client exchange. Depends on sim types only. See `net/`.
- `packages/ai` (`@mf/ai`): computer players. Pure TypeScript, depends on sim only. A host runs a bot and sends its intents like a player's. See `ai/`.
- `apps/client` (`@mf/client`): Vite. Runs its own copy of the sim. Raw WebGL2 renderer, DOM HUD. Its start function takes the match host. See `client/`.

Import direction: the client imports sim, map, ai and protocol. Sim imports nothing from the workspace.

## A turn from end to end

1. A player acts. `client/input/` turns it into an `Intent`. `startClient` passes it to `host.intent(session.self, intent)`.
2. The host stamps it with the player id and queues it.
3. Every 100 ms the host calls `link.deliver({t:"turn", tick, intents})`.
4. `client/match/handler.ts` gives the turn to `game/lockstep.ts`. Lockstep steps its world once per turn.
5. Every 50 ticks the client calls `host.checkpoint(tick, hash)` with a hash of its world.
6. A host that holds a reference world compares the hash. On a mismatch it delivers `desync`. The client then calls `host.desync()`.
7. When one team is left alive, the host delivers `ended` and the client shows the end card.

Details: `net/turn-flow.md`, `net/desync-check.md`.

## What a rendered frame is

The sim moves in 100 ms steps. The renderer draws at display rate. `Lockstep` keeps each unit's pose from before the last step. `render/` blends that pose with the current one by `alpha`. The sim never sees this blend.

## Where the docs live

Each folder under `docs/architecture` mirrors a folder in the code. `sim/` is `packages/sim/src`. `map/` is `packages/map/src`. `ai/` is `packages/ai/src`. `net/` covers `packages/protocol`. `client/<name>/` is `apps/client/src/<name>`. `workspace/` covers commands and TypeScript setup.
