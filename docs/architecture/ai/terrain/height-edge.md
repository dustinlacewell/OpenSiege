Source: packages/ai/src/terrain/edge.ts

# Height edge

`heightEdge(study, cell, dir, range)` is the range a shooter on the cell gains over targets ahead along `dir`.

The sim adds the shooter's height above the target to the range, up to half the base range (`weapons.ts` `effectiveRange`). The study does not know where the target stands. It takes the mean height of the passable cells in a band ahead:

- along `dir`, from `range` to `range * 1.5`;
- across `dir`, within `range / 2` each side.

The edge is the cell's height minus that mean, kept in 0..`range / 2`. With no passable cell in the band, the edge is 0.

A ridge crest has an edge facing down either slope. A cell on a slope facing uphill has none.
