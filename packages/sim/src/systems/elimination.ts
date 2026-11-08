import { removeUnitsOf } from "../units.ts";
import type { World } from "../types.ts";

/** A living player without a factory is out, and loses everything else. */
export function elimination(world: World): void {
  const hasFactory = new Set<number>();
  for (const u of world.units) if (u.kind === "factory") hasFactory.add(u.owner);
  for (const p of world.players) {
    if (!p.alive || hasFactory.has(p.id)) continue;
    p.alive = false;
    removeUnitsOf(world, p.id);
  }
}
