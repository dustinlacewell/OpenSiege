Source: packages/sim/src/systems/separation.ts

# Separation

`separation(state, grid)` pushes overlapping units apart. It runs after `arrival`, with the `moved` grid. A push goes through `slide`, so it never moves a unit into a blocked nav cell of its class (`sim/nav/nav-grid.md`).

## Roles

`roleOf(u)`:

- `anchor`: any mode other than `mobile`. Never moves.
- `moving`: `mobile` with any entry in `orders`, whatever the head type (`move`, `attack`, `siege` or `guard`).
- `idle`: `mobile` with an empty `orders` queue.

## Share of the overlap

For a pair `(a, b)`, `shareOfB(roleA, roleB)` is the percent of the overlap that `b` takes. `a` takes the rest.

- Both anchors: nothing moves.
- One anchor: the other unit takes 100%.
- Same role: 50 each.
- Moving against idle: the idle unit takes `IDLE_SHARE` (80). The mover takes 20.

## Budget

Each unit has a push budget per tick: `max(4, floor(speed / 2))`. `spend` takes from it. Overlaps ease out over several ticks, not at once.

## Iteration

Units visit in index order `i`. For each, the grid query returns candidates and only pairs with `j > i` are handled. Each pair is handled once.

- `reach` = radius a + radius b. A pair overlaps when squared distance is less than `reach²`.
- Exactly stacked units (distance 0) split along `+x`. `b` goes right.
- `push` moves a unit along the line between centres by the spent amount, and only if it is `mobile`.

## Invariants

- Integer math only. `isqrt` for distance.
- The grid is stale after pushes. That is fine, because exact distance is checked per pair.
- Pair order is fixed by index and grid cell order. Do not change the query order.

## Design basis

- Soft push, not hard collision: hard collision jams groups. 0 A.D. (since A25) and Spring/Recoil push units apart instead. Both ship in lockstep or single-binary RTS engines.
- Moving units push idle ones. Spring skips avoidance for idle allies and lets collision handling push them aside. 0 A.D. first shipped without this and added it.
- Push is capped per tick (the budget above). Spring caps total push at max speed times a multiplier. 0 A.D. caps its push multiplier for stability.
- There is no pre-contact steering. Notes on adding it are in `docs/future-work/group-movement.md`.
