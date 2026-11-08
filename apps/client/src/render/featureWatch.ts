import type { World } from "@mf/sim";

/**
 * Tells cheaply whether what features and scatter are built from has changed since the last call.
 * Exact for the sim's changes: features are kept sorted by id and new ids only grow. So a removal changes
 * the count, an addition (a death, or scrap turning to wreckage) changes the last id, and a new world
 * changes the terrain or the first id. Allocation-free, O(1) a call.
 */
export class FeatureWatch {
  private terrain: unknown = null;
  private count = -1;
  private first = 0;
  private last = 0;
  private fields = -1;

  /** True the first time, and whenever the terrain, the feature set or the field count differs. */
  changed(world: Pick<World, "terrain" | "features" | "fields">): boolean {
    const fs = world.features;
    const first = fs[0]?.id ?? 0;
    const last = fs[fs.length - 1]?.id ?? 0;
    const same = this.terrain === world.terrain && this.count === fs.length && this.first === first
      && this.last === last && this.fields === world.fields.length;
    this.terrain = world.terrain;
    this.count = fs.length;
    this.first = first;
    this.last = last;
    this.fields = world.fields.length;
    return !same;
  }
}
