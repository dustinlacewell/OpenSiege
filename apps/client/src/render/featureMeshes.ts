import type { MapFeatureKind } from "@mf/sim";
import { boulderLow, boulderMossy, boulderPair, boulderRound, rockCluster, rockDome, rockSlab, rockSpire } from "./rockMeshes.ts";
import { broadleaf, oak, pine, spruce } from "./treeMeshes.ts";

/**
 * Model builders of each map feature kind, one per variant. A feature's `variant` picks one, wrapped
 * if it is out of range. A new map kind needs an entry here. Scrap and wreckage come from `wreckMeshes.ts`.
 */
export const FEATURE_MESHES: Record<MapFeatureKind, readonly (() => Float32Array)[]> = {
  rock: [rockDome, rockSpire, rockSlab, rockCluster],
  boulder: [boulderRound, boulderLow, boulderPair, boulderMossy],
  tree: [spruce, pine, oak, broadleaf],
};

/** Every map feature kind, in table order. */
export const MAP_FEATURE_KINDS = Object.keys(FEATURE_MESHES) as MapFeatureKind[];

/** Which of `count` models a variant number picks. */
export function variantIndex(variant: number, count: number): number {
  return ((variant % count) + count) % count;
}
