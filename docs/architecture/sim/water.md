Source: packages/sim/src/terrain/water.ts, packages/sim/src/world.ts, packages/sim/src/systems/movement.ts, packages/sim/src/stats.ts

# Water

Water is every point where the ground is below the sea level. It is not a stored layer.

## Sea level

- `Terrain.seaLevel` is one integer height for the whole map.
- `seaLevelOf(heights)` is the lowest vertex plus `WATER_LEVEL` (60).
- `createWorld` sets it from the spec heights. `generateTerrain` sets it the same way.
- Nothing changes it after that. A crater lowers the ground, not the sea. A crater dug below the sea level fills with water.
- `hash.ts` hashes it (`sim/terrain.md`).

## inWater

`inWater(terrain, x, y)` is true when `heightAt(terrain, x, y) < seaLevel`. Ground at exactly the sea level is dry.

## Movement

- `waterSpeed` is a unit stat: the percent of speed a unit keeps with its centre in water. 1 to 100. Every unit has 50 today.
- `stepToward` applies it after the feature slow and before the slope factor: `max(1, floor(speed * waterSpeed / 100))` (`sim/systems/movement.md`).
- It reads the unit's centre only.
- Water does not block a cell, and routes do not avoid it (`future-work/terrain/water-pathing.md`).
