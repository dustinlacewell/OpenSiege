import { createWorld, seaLevelOf, type MapSpec, type Terrain, type World } from "@mf/sim";

/**
 * A throwaway world the render passes read: the spec's fields and features, on a terrain that shares the spec's
 * `heights` array, so height edits show in `heightAt` and picking at once. No players.
 */
export class MapScene {
  world: World;

  constructor(private readonly spec: MapSpec) {
    this.world = worldOf(spec, terrainOf(spec));
  }

  get terrain(): Terrain {
    return this.world.terrain;
  }

  /** A new terrain object on the same heights: the mesh, the features' ground heights and the scatter all rebuild. */
  renewTerrain(): void {
    this.world = worldOf(this.spec, terrainOf(this.spec));
  }

  /** Fields and features again from the spec, on the same terrain. The feature passes see the count change. */
  syncPlacements(): void {
    this.world = worldOf(this.spec, this.world.terrain);
  }
}

function terrainOf(spec: MapSpec): Terrain {
  const { width, height, cell, heights } = spec;
  return { cols: width / cell + 1, rows: height / cell + 1, cell, heights, seaLevel: seaLevelOf(heights) };
}

/** `createWorld` copies the heights; the copy is skipped and the shared terrain put in its place. */
function worldOf(spec: MapSpec, terrain: Terrain): World {
  const world = createWorld({ ...spec, heights: [] });
  world.terrain = terrain;
  return world;
}
