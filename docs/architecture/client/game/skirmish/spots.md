Source: apps/client/src/game/skirmish/spots.ts, packages/sim/src/mapSize.ts

# Skirmish start spots

Pure helpers. No clock and no randomness. The seed is an argument.

- `BOT_CLEARANCE` = 2500 world units. A bot spot with the human's spot closer than this is too close. That bot picks again.
- `clampSpot(map, x, y)`: rounds `x` and `y` and forces them into `[edge, side - edge]` on each axis. `edge` is `spawnEdge(map)` (`sim/map-spec.md`). A value that is not finite goes to the middle of that axis.
- `autoSpot(map, seed, index)`: a spot from the seed and the seat index alone. A small integer hash gives each axis. The spot is always inside the clamp. The same input gives the same spot.
- `botSeed(matchSeed, player)`: the bot's own seed. The match seed mixed with the player id, so the bots in one match differ.
