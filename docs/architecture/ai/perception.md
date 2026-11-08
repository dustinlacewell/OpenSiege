Source: packages/ai/src/perception/picture.ts, packages/ai/src/perception/sight.ts, packages/ai/src/memory/memory.ts, packages/ai/src/memory/ghosts.ts, packages/ai/src/memory/explored.ts

# Perception and memory

The bot sees only what a human player sees. Terrain and resource fields are public. Enemy units are not.

## Picture

`perceive(world, me)` builds a `Picture` each think. Nothing in it is remembered.

- `own`: living own units. `mine`: the same, by kind.
- `credits`, `alive`, `tick`.
- `fields`: every resource field with its `amount`.
- `map`: the map size (`mapSize(world.terrain)`, `sim/map-spec.md`). Planners read the map from here, not from a constant.
- `eyes`: each own unit's place and `sight`.
- `contacts`: the enemies known this tick.
- `allies`: the living units of the other players on my team (`sameTeam`), with id, owner, kind, place, hp and mode. The team view always shows them, so they need no detection.

An enemy is a contact in one of two ways:

- Seen: some own unit has it within `sight`, and `lineOfSight` is clear. The contact has kind, mode and hp.
- Radar: not seen, but within some own unit's `radarRange`. The contact has a place only. Kind, mode and hp are `null`.

`lineOfSight` (`sight.ts`) is the client fog rule (`client/game/vision.md`). It samples `heightAt` every half terrain cell (`terrain.cell / 2`) from the viewer's eye to the target's top. Any ground above the line blocks.

## Memory

`Memory` is everything the bot keeps between thinks. Planners never edit it. They return new slices, and `decide` spreads them in. The board owns four slices: `lastHp`, `pendingEvents`, `scar` and `scarTick` (`ai/board.md`, `ai/danger-map.md`). `scar` is null until the first think sizes it to the map.

## Ghosts

A ghost is a remembered enemy: last place, kind, mode, hp, first and last tick sensed. `updateGhosts` runs each think.

- A contact refreshes its ghost. A radar contact keeps the kind, mode and hp of an earlier sighting.
- An unsensed ghost stays at its last place.
- It expires after 600 ticks, 3000 if it was deployed, 6000 for a factory.
- It is dropped at once when its place is well inside an own unit's sight and nothing is sensed there.

`knownGhosts` keeps the ghosts first sensed at least `reactionDelay` ticks ago. Planners act on these only. This is the bot's reaction time.

## Explored cells

`explored.ts` keeps a grid of 1000-unit cells (`SCOUT_CELL`), sized by the map: `ceil(width / 1000)` columns by `ceil(height / 1000)` rows (16 by 16 on the default map). `Memory.explored` is `{ cols, rows, seen }`. Each `seen` entry holds the last tick an own unit saw the cell centre, or -1. A new bot starts with `cols = rows = 0`. `markExplored(explored, eyes, tick, m)` makes the grid on first use and again, all -1, if the map size differs. Scouting picks stale cells (`ai/army.md`).
