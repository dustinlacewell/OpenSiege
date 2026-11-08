Source: packages/ai/src/terrain/flow.ts

# Flow

Flow says how much traffic crosses a cell. It is weighted betweenness on the passable 8-neighbour study grid (`study.md`).

Each ordered pair of terminals sends traffic equal to the product of their weights. The traffic splits evenly over all shortest roads between the pair. A cell's flow is the traffic through it. The two end cells of a pair do not count it.

The layer is normalised: the busiest cell is 1.

## Method

Brandes' algorithm, one pass per terminal cell:

1. Dijkstra from the terminal counts the shortest roads to each cell. Step costs are integers (10 and 14), so equal roads tie exactly.
2. In reverse settle order, each cell passes its traffic back to its predecessors, in proportion to their road counts.

Terminals that snap to one cell add their weights. A pair with no road sends nothing.

## What it shows

A gap in a wall carries all the traffic across the wall, so it gets the top flow. Open ground spreads traffic over many roads, so each cell gets less.
