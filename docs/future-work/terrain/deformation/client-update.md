Not built. Proposal.

# Client update after craters

The client steps the sim, so it sees the same dents. Most client code reads `heightAt` every frame and follows on its own. Units sink into a crater with no extra work.

## What saves heights today

These read heights once and keep the result. Each must redo a box.

- Terrain mesh (`render/terrain.ts`). `updateMesh(terrain, rect)` exists for the map editor. Reuse it.
- Fog of war ground heights (`game/sightGrid.ts`).
- Ground cover mask and prop heights (`render/scatterMask.ts`, `render/scatterCells.ts`).
- Feature heights (`render/featureInstance.ts`, `render/featuresPass.ts`).
- Minimap height image (`ui/minimap.ts`, `ui/heightImage.ts`).

Each one only rebuilds today when the `Terrain` object changes.

## TerrainWatch

One small client module, in `game/terrainWatch.ts`.

- After each sim step, it adds that tick's `state.terrainDirty` boxes to its own list.
- Once per frame, it merges the list into one box and hands the box to each consumer above. Then it clears the list.
- A consumer takes the box in a `refresh(terrain, box)` method. It does not know about blasts or the sim step.

A new world is a new `Terrain` object. Consumers already rebuild in full then.

## Tests

- `TerrainWatch` merges boxes from several ticks into one box, and is empty after a frame.
- Each consumer's box refresh gives the same data as a full rebuild. Test the pure builders, not the GL upload.

The look in play is for the user to check.
