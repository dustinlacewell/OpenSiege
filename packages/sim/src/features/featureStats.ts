import type { MoveClass } from "../stats.ts";
import type { Feature, FeatureKind } from "../types.ts";

export interface FeatureStats {
  /** Marks the nav cells it covers as blocked for every move class. */
  blocksMove: boolean;
  /** A direct shell that passes through its cylinder hits it. */
  blocksShot: boolean;
  /** Model height, for the shot test. */
  height: number;
  /** Speed a unit keeps while inside it, in percent. 100 = no slow. */
  slowPercent: number;
  /** Move classes that destroy it by driving over it. */
  crushedBy: readonly MoveClass[];
  /** Splash damage destroys it. 0 = cannot be destroyed. */
  maxHp: number;
}

export const FEATURE_STATS: Record<FeatureKind, FeatureStats> = {
  rock: { blocksMove: true, blocksShot: true, height: 160, slowPercent: 100, crushedBy: [], maxHp: 0 },
  boulder: { blocksMove: true, blocksShot: true, height: 70, slowPercent: 100, crushedBy: [], maxHp: 400 },
  tree: { blocksMove: false, blocksShot: false, height: 260, slowPercent: 55, crushedBy: ["heavy"], maxHp: 60 },
  // Scrap hp is per instance (`UNIT_STATS[unit].scrapHp`, set in `wreck.ts`). Its maxHp here is a placeholder above 0
  // so that `isDestroyed` and `damageFeature` treat it as destroyable.
  scrap: { blocksMove: true, blocksShot: true, height: 40, slowPercent: 100, crushedBy: [], maxHp: 1 },
  wreckage: { blocksMove: false, blocksShot: false, height: 0, slowPercent: 100, crushedBy: [], maxHp: 0 },
};

/** Every feature kind, in table order. Iterate this, never a hand-written list. */
export const FEATURE_KINDS = Object.keys(FEATURE_STATS) as FeatureKind[];

/** Largest feature radius. Pads index queries; `place.ts` stays under it. */
export const MAX_FEATURE_RADIUS = 256;

/** Hit points gone: it is removed at the end of the tick (`systems/reap.ts`). A feature that cannot be destroyed never is. */
export function isDestroyed(f: Feature): boolean {
  return FEATURE_STATS[f.kind].maxHp > 0 && f.hp <= 0;
}
