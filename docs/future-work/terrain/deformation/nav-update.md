Not built. Proposal.

# Nav update after craters

Heights are the source. The nav grid is derived from them. After a crater, the nav cells it touches must follow.

## Dirty list

`SimState` gets `terrainDirty`: the vertex boxes `stampCrater` changed this tick. `step` clears it at the start of each tick.

- It is not in `World`. It is not hashed or sent.
- A client that joins from a snapshot builds its nav fresh, so it needs no list.

## One fixed point

`reap` already runs right after `projectiles` and is the only writer of the nav (`sim/tick-order.md`). It now also calls `reshapeTerrain(nav, terrain, boxes)`, in a new `nav/reshapeTerrain.ts`:

1. Turn each vertex box into a cell box. A vertex touches the four cells around it.
2. For each move class, `refreshCells` each box. Count the cells that flip between open and blocked.
3. If any cell flipped for a class, relabel that class's regions once.

Every system still sees one nav per tick. The result equals a nav built fresh from the dented world.

## Paths

- A unit plans again when it cannot see its next waypoint (`sim/nav/pathfinding.md`). A crater wall on its path triggers that. No new code.
- A unit inside a newly blocked cell walks out (`escapeAim`). No new code.
- Ground that opens leaves old paths a bit long. Accept it.

## Cost

`refreshCells` reads only the box. A crater touches a few cells. The region relabel floods the whole grid (16k cells on the default map, per class). It runs only on a tick where a cell flipped.

## Tests

- After a crater, the nav equals `createSimState` on the same world.
- A shallow dent flips no cell and does not relabel.
- A crater wall that blocks a path makes the unit plan again and still arrive.
