Source: packages/ai/src/assess/power.ts, packages/ai/src/assess/threat.ts, packages/ai/src/assess/groups.ts

# Power, threat and groups

Pure functions over ghosts and own units. They turn "what is where" into numbers the planners compare.

## Power

`unitPower(kind, mode, hp)` is `sqrt(damage per tick x effective hp)`.

- The weapon comes from the sim's `weaponOf` for the mode. A unit in transition counts as the mode it is heading for.
- Effective hp is hp divided by the siege armour share when sieged.
- Sieged artillery damage counts 1.5 times for splash.
- Unarmed kinds have power 0.

By Lanchester's square law, a sum of these is a fair measure of a group. So the planners add powers and compare sums.

- `ghostPower`: a ghost of unknown kind counts as 0.6 of a mobile tank. Many radar contacts are harvesters.
- `sumPower`, `powerWithin`: own units.
- `ghostsWithin`: ghosts within a radius of a point.
- `deployedPowerWithin`: own units as if deployed. Artillery that backs a squad counts this way.

## Threat map

`buildThreat(known, m)` stamps each armed ghost's power over every 400-unit cell it can hit. The map size `m` sets the grid: `ThreatMap` is `{ cols, rows, cells }` with `ceil(width / 400)` by `ceil(height / 400)` cells. `threatAt` reads `cols` and `rows` from the map it is given.

- Reach is `siegeRange` for a deployed ghost. A mobile ghost gets `range` plus 400 for driving. Unknown kind uses a tank's range.
- `threatAt(map, p)`: the summed power that can reach `p`.
- `safe(map, p, limit)`: `threatAt` is at most `limit`.

## Enemy groups

`groupGhosts(known)` makes single-link clusters. Ghosts closer than 800 to one another share a group. A group has a centre, radius, power, value and a factory flag.

Value says how much the bot wants the group dead. Factory 6, harvester 3, radar 2, artillery 1.5, engineer and tank 1, unknown 1. The army picks targets from groups (`ai/army.md`).
