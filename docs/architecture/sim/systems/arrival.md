Source: packages/sim/src/systems/arrival.ts, packages/sim/src/orders.ts, packages/sim/src/types.ts

# Arrival

`arrival(world, grid)` ends move orders so a crowd does not push forever at one spot. It runs after `movement`, with the `moved` grid.

## Rules

For each `mobile` unit whose head order is a `move`, in id order:

- Waypoint: if more orders follow the move, the move is done within two radii of its spot. The unit flows on. It gets no arrived mark.
- At spot (last order): within half a radius of the spot. The unit arrives.
- Contagion (last order): within `CONTAGION_RANGE` (600) of its own spot, and touching an own unit that already finished the same `group`. The unit arrives.

Touching means distance at most the two radii plus `TOUCH` (8). The finished unit must have `arrived === group` and no orders.

Units visit in id order, so an early arrival can make a later unit arrive in the same pass.

## arrive(u, group)

`movement` also calls it when a unit steps onto its exact point. It pops the head with `advance`. If that was the last order, the unit is idle and `arrived = group`.

A move followed by an `attack` or `siege` order counts as a waypoint. The unit hands over within two radii of the point, not at it.

## The group mark

`Unit.arrived` holds the group of the last move a unit finished as its final order. `give` and `stop` clear it. `advance` clears it when a `move` comes up next. Units from a rally share the factory id as group.

## Invariants

- Only a `mobile` unit with a `move` head is visited. An anchored unit with a `move` head waits for `modes` to pack it.
- Contagion needs a finished unit with an empty queue. A unit with orders left never spreads it.

## Design basis

- Contagion follows Spring/Recoil `GroundMoveType.cpp`: a unit that touches an already finished unit at its goal also counts as arrived. The `CONTAGION_RANGE` limit is added here, so a group does not stop at the start.
- The waypoint rule is simpler than Spring's. Spring skips a waypoint when the unit touches another unit standing on it. Here a radius test decides.
- Soft push instead of hard collision is in `sim/systems/separation.md`.

## Related

`sim/formation.md` gives each unit its own spot. `sim/orders.md` has the queue rules.
