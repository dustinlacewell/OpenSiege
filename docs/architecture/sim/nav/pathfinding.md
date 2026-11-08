Source: packages/sim/src/nav/ (navGrid.ts, plan.ts, astar.ts, stringPull.ts, route.ts, pursuit.ts, clearLine.ts, nearest.ts, regions.ts), packages/sim/src/systems/movement.ts, packages/sim/src/orders.ts

# Path finding

Depends on `sim/nav/nav-grid.md`.

A move order plans one path, once. The unit then follows it.

- Plan: A* over the nav grid, then string pulling. Result: a short list of waypoints.
- Follow: pure pursuit. The unit aims at a point a little way ahead on the path.

Attack chase and guard follow do not path. They drive straight at a moving target and obey only the block rule.

## The order carries the path

`Order.move` is `{ x, y, group, attack, path, best, stall }`.

- `x, y` is the unit's own spot.
- `path` is the waypoints still to pass. The last one is where the unit stops. `[]` means not planned yet.
- `best`, `stall` drive the stall rule (below).
- All three are sim state. They are in `hashWorld` and in the snapshot (plain JSON).
- `moveOrder(x, y, group, attack)` in `orders.ts` builds one. Every place that makes a move order calls it: the `move` intent and a factory's rally (`production`).

## When it plans

The intent handlers get the `World`, not the nav, so planning is lazy. The order plans the first tick `moveOrder` in `movement.ts` drives it (`routeAim`, `route.ts`): from where the unit stands that tick, to the order's spot.

- A queued move plans when it comes up as the head order, from where the unit then is. Not at apply time, from the previous leg's end. A unit that had to leave its line meanwhile plans from its true place.
- A sieged unit plans after it packs up.
- Attack-move uses the same order, so it paths too.

The order tick of a group is where the A* cost lands: 30 tanks whose straight line is blocked took 1 to 6 ms in total (about 0.15 to 0.3 ms per search). Later ticks cost about 0.3 ms for the group.

## planPath(nav, class, from, goal)

Pure (`plan.ts`). Returns the waypoints, the last the spot.

1. Start. A start in a blocked cell is moved to the centre of the nearest open cell (`openPoint`). The unit walks out first (`nav-grid.md`, "Leaving blocked ground").
2. Reachable goal. A goal in a blocked cell moves to the nearest open cell. If that cell is in another region than the start (`regions`), the goal moves to the cell of the start's region nearest to it. So an unreachable spot becomes the nearest cell the unit can reach, and the order ends there.
3. Straight when clear. `clearLine` from start to goal touches no blocked cell: the path is `[goal]`. `clearLine` is an exact integer grid walk (a supercover). Where the line runs through a cell corner, both cells beside it count. The grid already holds the class's clearance (`nav-grid.md`), so a line has no width to test.
4. Else `findCells`, then `stringPull`, then `capPath`.

### findCells (`astar.ts`)

- A* over the 8-neighbour grid. Integer costs: 10 straight, 14 diagonal. Heuristic: octile distance in the same units.
- A diagonal step needs both cells beside it open. No cutting a blocked corner. So its regions are the 4-neighbour regions.
- Neighbours scan in one fixed order (clockwise from north). A binary heap pops the lowest f, then the lowest h, then the lowest cell index. The heap is two parallel arrays: the key (`f * 65536 + h`) and the cell. The cell index is the last tie-break, so a plain compare gives the same order on every machine. The key stays under 2^53 because a map has at most 2^18 vertices and 2048 cells a side (`sim/map-spec.md`). Every machine finds the same path.
- Scratch arrays are module level and marked by a search stamp. Nothing is cleared between searches. They grow to the largest map seen and never shrink.
- Returns the cells from start to goal, or null.

### stringPull (`stringPull.ts`)

Greedy. From the current point, jump to the farthest later path cell it sees along a `clearLine`. The walk stops at the first cell out of sight, so the cost is one line per path cell. The next cell is always taken, so it always moves on. The waypoints are cell centres; the last is the goal point itself.

### capPath

At most 32 waypoints. A longer path keeps its first 31 and its last. The unit that reaches the gap cannot see the last point, so it plans again from there.

## Following (`route.ts`, `pursuit.ts`)

`routeAim(nav, unit, order)` gives the point to aim at. `stepToward` in `movement.ts` drives to it.

1. Plan if `path` is empty. Plan again if the unit stands on open ground and cannot see the first waypoint, say after a shove past a corner.
2. Drop waypoints (`dropPassed`). The first goes when the unit is within its `speed` of it, or within the look distance of it and sees the second. The last waypoint stays.
3. Aim at the point `look` units ahead along the polyline from the unit through the waypoints (`aimAlong`). The polyline starts at the unit, so the closest point to the unit on it is the unit. If the whole polyline is shorter, aim at the last point. That aim has `end` set.
4. If the line to that point is blocked, aim at the first waypoint instead. A look-ahead past a corner would cut it.

`look = max(2 * radius, turn radius)`. Turn radius is `speed * ANGLE_STEPS / (2 * pi * turnRate)`, with 2 pi as 44/7, in integers. About 180 for a factory, 150 for a tank.

`moveOrder` calls `arrive` when `stepToward` reached an aim that has `end`. That is the order's end. A unit also ends a last move within half its radius of its spot, and next to a finished unit of its group (`sim/systems/arrival.md`). A waypoint of a queue ends within two radii of its spot.

`stepToward` is unchanged: it turns by `turnRate`, slows for the angle left (`systems/movement.md`, "Turn speed"), for features, for water and for slope, and drives the exact line when it faces the point.

## Stall

A unit that stops getting nearer ends its order.

- Progress is a fall in the length of the polyline left (`pathLength`). `best` is the least so far. `stall` counts the ticks since it fell.
- The order ends (`arrive`) when `stall` reaches 30 plus the ticks to turn half way round (`128 / turnRate`). A hull turning in place crawls and gets nowhere, so a factory gets about 73 ticks, a tank 46.
- A unit in a blocked cell is walking out. Its `stall` stays 0.
- A new plan after lost sight keeps `best` and `stall`, so planning again cannot hide a stall.

## Unreachable goals

A spot the unit cannot reach (blocked ground, or a closed pocket) is replaced by the nearest cell it can reach (step 2). The unit drives there and the order completes. It does not press on a wall.

## Measurements

Scratch runs, seeds 11 / 22 / 33:

- Factory moves of 1500 and 3000 units in 8 directions: driven length over straight length, mean 1.03, worst 1.69. No order unfinished in 3000 ticks.
- Groups of 10 to 30 mixed units with plain, drawn-path and attack-move orders, half to points near a tree or rock: every unit landed. No unit spent more than 39 ticks within 4 cells of its spot.
- Four-factory groups: every unit landed.

## Known limits

- A spot in a blocked cell ends at the nearest open cell. Units of a group then crowd one point and separation spreads them.
- The grid holds a feature's clearance by cell centre. An open cell can lie up to half a cell nearer the rock than the clearance. A line along the edge of an open cell can graze the rock. `featureContact` pushes the hull off (`sim/features/effects.md`).
- Units do not avoid each other before contact. That is still the soft push (`sim/systems/separation.md`). Two units that meet head-on in a corridor one cell wide can hold each other still. The stall rule ends their orders.
- A unit that leaves a blocked cell toward a rock that lies exactly between it and the nearest open cell can press on the rock. `featureContact` puts it back each tick and the aim is nearly radial, so it makes no progress. The stall rule does not count a unit in a blocked cell, so it stays there.

## Not in scope

Hierarchical search (HPA*): add only if profiling says whole-map A* is too slow. Pre-contact steering: `future-work/group-movement.md`.
