Source: packages/sim/src/systems/deaths.ts, packages/sim/src/systems/elimination.ts, packages/sim/src/intents.ts

# Deaths and elimination

## deaths(state)

Queues each dead unit's death blast, leaves its scrap or wreckage (`sim/features/wreckage.md`), and removes every unit with `hp <= 0`. It filters only when some unit is dead. The array stays sorted by id. Orders and `target` ids that point at a dead unit are left alone. Systems check for a missing or dead target when they read it.

## elimination(world)

Builds the set of owners that have a `factory`. Every player with `alive: true` and no factory is set to `alive: false`, and `removeUnitsOf` drops all their units. Elimination is final for the match.

It runs every tick after `deaths`.

## Player lifecycle

- `join` intent (turn 1 of a match): the player is added with `alive: true`, `connected: true`, 600 credits, and a factory plus a harvester.
- `elimination`: `alive` becomes false. The player stays connected and watches. The client shows the eliminated banner (`client/ui/overlays.md`).
- `leave` intent (the player's connection closed, or the player left): `connected` false, `alive` false, all units removed. The player record stays in `world.players`.
- There is no respawn. The match ends when one team is left alive (`client/match/local-match.md`).

## Rules

- A factory is the life of a player. Keep `elimination` in sync with any new "building" kind.
- Nothing removes a player from `world.players`. Ids are never reused in a match: a host's player counter only grows.

## Client reads

`ui/model.ts` sets `dead` from `player.alive` and builds the leaderboard from `connected` players.
