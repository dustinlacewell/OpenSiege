Source: apps/client/src/game/skirmish/world.ts, apps/client/src/game/skirmish/plan.ts, apps/client/src/game/skirmish/spots.ts, packages/ai/src/start/botStartSpot.ts

# Skirmish world

The skirmish's starting world: the map with every seat joined. Pure. The seed is an argument.

## skirmishSeats(spec, plan, seed)

The bots' spots, before the human picks. Returns a `Seating`: `spots[i]` is seat i's spot (null while it has none, the human's before the pick) and `marks`, one `PlacementMark` per seat that has a spot. Throws when the plan cannot be played (`planErrors`, `client/game/skirmish/plan.md`).

## skirmishWorld(spec, plan, seed, humanSpot)

Tick 1 of the match. Returns a `SkirmishStart`: `world`, `you` (the human's player id), `bots` (`LocalBot[]`) and `marks`.

1. Take the bots' spots from `skirmishSeats`.
2. The human's spot is `humanSpot` forced into the map (`clampSpot`), or `autoSpot(spec, seed, you)` when `humanSpot` is null.
3. Run `placeBots` again with the human's spot set.
4. Make the world: `createSimState(createWorld(spec))`, then `step` once with every `join`. The human's join comes first, then the bots' in seat order. Each join carries `name`, `x`, `y` and `team`.
5. Make the bots: `createBot({ difficulty, seed: botSeed(seed, player) })`, each wrapped as a `LocalBot`.

## placeBots

Each bot in seat order keeps its spot unless it has none, or the human's spot is within `BOT_CLEARANCE` of it. Otherwise it picks against every other current spot with `botStartSpot` (`ai/start-spot.md`), with its team, its difficulty and its own seed. The result goes through `clampSpot`.

So the bots pick one by one in seat order, against the earlier bots only. Then the human's spot moves any bot that stands too close.

## Invariants

- The same arguments give the same world.
- Every seat joins in one turn, so the rng state at each join is the same on every run (`sim/world-creation.md`).
