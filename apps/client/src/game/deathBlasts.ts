import { heightAt, PROJ_FP, type World } from "@mf/sim";

/** One explosion to spawn: position in world units, `splash` is the blast radius. */
export interface BlastRequest {
  x: number;
  y: number;
  z: number;
  splash: number;
}

/** Pure. One request per death blast, at the blast position but not below the ground. */
export function blastRequests(world: Pick<World, "blasts" | "terrain">): BlastRequest[] {
  return world.blasts.map((b) => {
    const x = b.x / PROJ_FP;
    const y = b.y / PROJ_FP;
    return { x, y, z: Math.max(heightAt(world.terrain, x, y), b.z / PROJ_FP), splash: b.radius };
  });
}

/** Hands out a tick's blasts once. `world.blasts` stays the same for the tick it was queued. */
export class DeathBlasts {
  private tick = -1;

  /** Mark `tick` as already seen, so the blasts of the current list are not replayed. */
  skip(tick: number): void {
    this.tick = tick;
  }

  take(world: Pick<World, "tick" | "blasts" | "terrain">): BlastRequest[] {
    if (world.tick === this.tick) return [];
    this.tick = world.tick;
    return blastRequests(world);
  }
}
