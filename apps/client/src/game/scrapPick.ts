import type { Feature } from "@mf/sim";

/** True for scrap an engineer can still reclaim. */
export function isScrap(f: Feature): boolean {
  return f.kind === "scrap" && f.hp > 0;
}

/**
 * Pure. The scrap whose circle, grown by `tolerance` world units, holds the ground point (x, y).
 * The nearest centre wins; a tie goes to the lower id. Undefined when none does.
 */
export function scrapAt(features: readonly Feature[], x: number, y: number, tolerance: number): Feature | undefined {
  let best: Feature | undefined;
  let bestD = Infinity;
  for (const f of features) {
    if (!isScrap(f)) continue;
    const d = (f.x - x) ** 2 + (f.y - y) ** 2;
    const r = f.radius + tolerance;
    if (d <= r * r && (d < bestD || (d === bestD && best !== undefined && f.id < best.id))) {
      best = f;
      bestD = d;
    }
  }
  return best;
}
