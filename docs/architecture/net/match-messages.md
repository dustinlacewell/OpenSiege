Source: packages/protocol/src/index.ts, packages/sim/src/mapSize.ts

# Match messages

`@mf/protocol` defines the messages between a match host and the client. It imports only the `Intent` and `Stamped` types from sim. It has no encoding. A host that sends messages over a network adds its own.

## Map size

Messages carry no map size and no version field. The world in `welcome` holds the terrain `{ cols, rows, cell, heights }`. The map can be any rectangle, so the client reads its width and height with `mapSize(world.terrain)` (`sim/map-spec.md`).

## Client to host (`MatchClientMsg`)

- `{ t: "intent", intent }`: one player command. `Intent` is the sim type (`sim/intents.md`).
- `{ t: "hash", tick, hash }`: the client's world hash at a check tick.

In code the client does not build these. It calls `host.intent(as, intent)` and `host.checkpoint(tick, hash)` (`client/app/match-host.md`).

## Host to client (`MatchMsg`)

- `{ t: "welcome", you, world }`: the round begins. `you` is the player id. `world` is `encodeWorld(world)`, a JSON string, after tick T (0 for a new match). A `join` for every player lands in turn T+1.
- `{ t: "turn", tick, intents }`: turn number and every `Stamped` intent for it, in arrival order. `tick` is the tick number the world reaches after the step.
- `{ t: "desync", tick }`: the client's hash at `tick` did not match the host's.
- `{ t: "ended", winners }`: the match is over. `winners` are the names of the players on the last team, or empty when no team won. No more turns follow.

The client takes these through `deliver(msg)` of its `MatchLink` (`client/app/match-host.md`) and `handleMatch` (`client/match/handler.md`).

## Constants

`HASH_EVERY` = 50. The client and the host use it to pick check ticks (`net/desync-check.md`).

## Trust

The client trusts the host. A host that takes intents from outside must check their shape before it queues them. The sim checks game rules: ownership, existence, credits (`sim/intents.md`). The host must never pass `join` or `leave` from a player.

## Recipe: add a message

1. Add a variant to `MatchClientMsg` or `MatchMsg`.
2. Host to client: add a `case` in `client/src/match/handler.ts`. The switch covers every variant.
3. Client to host: add a method to `MatchHost` and call it from `start.ts`.
4. If it carries game input, it must go through an `Intent` instead, so the sim sees it in a turn.
