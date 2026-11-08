Not built. Proposal.

# Water pathing

Water slows a unit to `waterSpeed` percent (`sim/water.md`). The planner does not know this.

- The nav grid ignores water. No cell is blocked for water (`sim/nav/nav-grid.md`).
- A* does not cost water. A route crosses a lake when that is shorter in distance, even when a dry way round is faster (`sim/nav/pathfinding.md`).
- Proposal: A* adds a cost to steps through water cells, scaled by the class's `waterSpeed`. Deep water can later block a cell.
