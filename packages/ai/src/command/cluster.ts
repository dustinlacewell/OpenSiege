import { within, type Point } from "../geometry.ts";

/** Single-link clusters: points closer than `link` to some member join its cluster. Input order is kept within each. */
export function cluster<T extends Point>(points: readonly T[], link: number): T[][] {
  const left = points.slice();
  const out: T[][] = [];
  while (left.length > 0) {
    const members = [left.shift()!];
    for (let n = 0; n < members.length; n++) {
      for (let i = 0; i < left.length; i++) {
        if (!within(left[i]!, members[n]!, link)) continue;
        members.push(left.splice(i, 1)[0]!);
        i--;
      }
    }
    out.push(members);
  }
  return out;
}

/** The plain mean of the points. */
export function meanOf(points: readonly Point[]): Point {
  const s = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
}
