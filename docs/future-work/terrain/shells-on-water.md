Not built. Proposal.

# Shells on water

Today a shell hits the ground when `z <= heightAt * PROJ_FP`, also under water (`sim/water.md`).

- A shell that reaches water bursts at the water surface, not the lake bed. It hits when `z <= max(heightAt, seaLevel) * PROJ_FP`.
- Splash damage is unchanged.
- A burst on water digs no crater, because the blast is above the ground.
