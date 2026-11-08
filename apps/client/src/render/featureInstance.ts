import { FEATURE_STATS, heightAt, UNIT_STATS, type Feature, type Terrain } from "@mf/sim";
import { hash01 } from "../game/hash01.ts";
import type { PropInstance } from "./propInstance.ts";
import { isWreck, type WreckForm } from "./wreckForm.ts";

/** A wreck's drawn height as a fraction of its unit's height. Wreckage is a low heap. */
export const WRECK_HEIGHT: Record<WreckForm, number> = { scrap: 1, wreckage: 0.3 };

/** How far from the centre, in radii, the ground is probed. The foot sits at the lowest probe. */
const PROBE = 0.6;
/** Height varies by up to this much either way between features of one kind. */
const HEIGHT_SPREAD = 0.1;
const TURN = Math.PI * 2;

/**
 * Writes where and how big feature `f` is drawn into `out`. Pure: the position alone picks the yaw, tint
 * and height spread, so every client draws the same forest, and a feature keeps its look when the
 * editor renumbers ids. The foot sits on the lowest ground under
 * the feature, so on a slope the uphill side is buried, never floating.
 */
export function featureInstance(f: Feature, terrain: Terrain, out: PropInstance): void {
  const r = f.radius * PROBE;
  out.x = f.x;
  out.y = f.y;
  out.z = Math.min(
    heightAt(terrain, f.x, f.y),
    heightAt(terrain, f.x + r, f.y), heightAt(terrain, f.x - r, f.y),
    heightAt(terrain, f.x, f.y + r), heightAt(terrain, f.x, f.y - r),
  );
  out.yaw = hash01(f.x, f.y, 1) * TURN;
  out.scaleXY = f.radius;
  out.scaleZ = baseHeight(f) * (1 + (hash01(f.x, f.y, 2) * 2 - 1) * HEIGHT_SPREAD);
  out.tint = hash01(f.x, f.y, 3);
}

/** A wreck is as tall as the unit it came from (wreckage a fraction of it); a map feature as its kind. */
function baseHeight(f: Feature): number {
  if (isWreck(f.kind) && f.unit !== undefined) return UNIT_STATS[f.unit].height * WRECK_HEIGHT[f.kind];
  return FEATURE_STATS[f.kind].height;
}
