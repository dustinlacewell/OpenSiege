Source: packages/sim/src/lineOfSight.ts

# Line of sight

`clearLine(terrain, x0, y0, z0, x1, y1, z1)` is true when no terrain rises above the straight line from `(x0, y0, z0)` to `(x1, y1, z1)`. Detection uses it for the `seen` level (`sim/detection.md`).

## Sampling

- The line is cut into `n` segments of at most half a terrain cell (`terrain.cell / 2`), so no ridge of the height map slips between samples.
- Samples `1..n-1` are tested. The two ends are not: they stand on the ground they start from.
- Sample `k` sits at `x0 + floor(dx * k / n)`, `y0 + floor(dy * k / n)`, with height `heightAt` there.

## Invariants

- Integer only. The length is `isqrt`. A sample blocks when `h * n > z0 * n + dz * k`: heights compare cross-multiplied by `n`, with no division.
- Pure: reads terrain, writes nothing.
