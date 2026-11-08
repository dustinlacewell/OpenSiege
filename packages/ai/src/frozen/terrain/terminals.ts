import type { Point } from "../geometry.ts";

/** Fields this close to each other merge into one cluster (single linkage). */
export const CLUSTER_GAP = 1500;

/** A place traffic starts or ends at, and how much it weighs. */
export interface Terminal extends Point {
  weight: number;
}

/** A field as the study reads it. */
export interface FieldSpot extends Point {
  amount: number;
}

/**
 * The flow terminals: one per field cluster, at the clusters' mean place, weighing the credits in it, and one
 * per spawn, weighing the mean cluster wealth. With no fields a spawn weighs 1.
 */
export function terminalsOf(fields: readonly FieldSpot[], spawns: readonly Point[]): Terminal[] {
  const clusters = clusterFields(fields);
  const mean = clusters.length > 0 ? clusters.reduce((s, c) => s + c.weight, 0) / clusters.length : 1;
  return [...clusters, ...spawns.map((s) => ({ x: s.x, y: s.y, weight: mean || 1 }))];
}

function clusterFields(fields: readonly FieldSpot[]): Terminal[] {
  const root = fields.map((_, n) => n);
  const find = (n: number): number => (root[n] === n ? n : (root[n] = find(root[n]!)));
  for (let a = 0; a < fields.length; a++) {
    for (let b = a + 1; b < fields.length; b++) {
      const dx = fields[a]!.x - fields[b]!.x, dy = fields[a]!.y - fields[b]!.y;
      if (dx * dx + dy * dy <= CLUSTER_GAP * CLUSTER_GAP) root[find(a)] = find(b);
    }
  }
  const groups = new Map<number, FieldSpot[]>();
  fields.forEach((f, n) => groups.set(find(n), [...(groups.get(find(n)) ?? []), f]));
  return [...groups.values()].map((g) => ({
    x: g.reduce((s, f) => s + f.x, 0) / g.length,
    y: g.reduce((s, f) => s + f.y, 0) / g.length,
    weight: g.reduce((s, f) => s + f.amount, 0),
  }));
}
