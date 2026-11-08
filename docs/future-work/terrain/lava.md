Not built. Proposal.

# Lava

Depends on the nav grid (`sim/nav/nav-grid.md`, built). Lava becomes a new input to `refreshCells` (`navGrid.ts`), which decides whether a cell is blocked.

## Lava is a stored mask

Lava cannot come from height, because it sits in places water would not (`sim/water.md`). Store it per terrain vertex: `terrain.lava: number[]` (0 or 1), set at generation in a few blobs.

- Passable, high nav cost, so routes avoid it.
- A unit whose centre is on lava takes `LAVA_DAMAGE` per tick. A new system, `systems/hazards.ts`, after movement.
- Lava does not move or spread in this proposal.
- Lava has no effect on shells.

## Rendering (client)

- Drawn in the terrain shader from the lava mask. Emissive, with a slow flowing noise. It lights the HDR scene, so the bloom picks it up.
- The minimap shows it.
