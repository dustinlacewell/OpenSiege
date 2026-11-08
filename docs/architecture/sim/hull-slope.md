Source: packages/sim/src/hullSlope.ts

# Hull slope

`hullSlope(terrain, x, y, facing, radius)` gives how a hull tilts on the ground under it, as two slopes in permille (rise per 1000 run):

- `fwd`: front minus back. Positive means the nose is up.
- `side`: left (+90° from the facing) minus right. Positive means the left side is up.

It samples `heightAt` at `d = floor(radius · 0.8)` ahead, behind, left and right along the hull facing. The offsets are `cosStep`/`sinStep` of `facing` times `d`, rounded to whole units. Each slope is `(h1 − h2) · 1000 / (2d)`, truncated. Integer math only.

The client draws the same tilt with its own float version (`fillPoses` in `client/game/poses.ts`), because it interpolates the yaw between ticks. `apps/client/test/hullSlope.test.ts` checks the two agree at integer facings. They can differ by up to 2 / (2d) radians, because heights are whole units.

`muzzleTip` (`systems/projectiles.md`) uses it to tilt the barrel's breech pivot.
