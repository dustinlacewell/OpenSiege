// maps/archipelago.json: a shallow sea with a big island at each end and a scatter of small islands between.
// Wading is slow, so the route across is a choice. Half-turn symmetry. Run: node packages/map/scripts/archipelago.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, assertDry, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, seaOf, smooth, turn2, wetAt, type Pt } from "./lib/gen.ts";

const SIZE = { W: 14000, H: 6000 }, { W, H } = SIZE, LAND = 300, FLOOR = 60;
const ts = turn2(SIZE);
const BASES = orbit([2000, 3000], ts);
const BASE_FIELDS: Pt[] = [[1000, 3000], [2800, 1500], [2800, 4500]];
const MID_FIELDS: Pt[] = [[5200, 1400], [5000, 3000]];
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);

const map = emptyMap({ name: "Archipelago", width: W, height: H, cell: 125, baseHeight: LAND });

const forced: [Pt, number][] = [
  ...BASES.map((b): [Pt, number] => [b, 1500]),
  ...[...BASE_FIELDS, ...MID_FIELDS].flatMap((p) => orbit(p, ts)).map((p): [Pt, number] => [p, 650]),
  [[W / 2, H / 2], 700],
];

/** Land bridges: base island to the middle islands to the centre. A narrow strip, a few cells wide. */
const SPINE: [Pt, Pt][] = [[[2000, 3000], [5000, 3000]], [[5000, 3000], [W / 2, H / 2]], [[5200, 1400], [W / 2, H / 2]], [[2800, 1500], [5200, 1400]]];
const bridges = SPINE.flatMap(([a, b]) => ts.map((t): [Pt, Pt] => [t(a), t(b)]));

function segmentDistance(x: number, y: number, [[ax, ay], [bx, by]]: [Pt, Pt]): number {
  const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

fillHeights(map, (x, y) => {
  const n = noise(x, y, 1500) * 0.65 + noise(x, y, 520) * 0.35;
  const sea = smooth((n - 0.57) / 0.08);
  const pinned = Math.max(...forced.map(([[px, py], r]) => 1 - smooth((Math.hypot(x - px, y - py) - r) / 500)));
  const bridge = Math.max(...bridges.map((s) => 1 - smooth((segmentDistance(x, y, s) - 180) / 260)));
  const land = Math.max(sea, pinned, bridge);
  const rolling = (noise(x, y, 800) - 0.5) * 100 + (noise(x, y, 300) - 0.5) * 36;
  return FLOOR + (LAND + rolling * land - FLOOR) * land;
}, ts);

addFields(map, [...BASE_FIELDS, ...MID_FIELDS], 500, 5000, ts);
addFields(map, [[W / 2, H / 2]], 500, 8000, [ts[0]!]);
assertDry(map, "base", BASES);
assertDry(map, "field", map.spec.fields.map((f): Pt => [f.x, f.y]));

const fieldPts = map.spec.fields.map((f): Pt => [f.x, f.y]);
scatterSymmetric(map, [
  { kind: "tree", x: 3500, y: 3000, radius: 2200, density: 60 },
  { kind: "tree", x: 1500, y: 1000, radius: 800, density: 150 },
  { kind: "tree", x: 1500, y: 5000, radius: 800, density: 150 },
  { kind: "rock", x: 4000, y: 3000, radius: 4500, density: 3 },
  { kind: "boulder", x: 7000, y: 3000, radius: 7800, density: 2 },
], ts, (f) => f.x < W / 2 - 100 && !wetAt(map, f.x, f.y, 40) && !near(f.x, f.y, fieldPts, 650) && !near(f.x, f.y, BASES, 750));

const sea = seaOf(map);
paintMaterials(map, (x, y, h) => {
  const sand = 1 - smooth((h - sea) / 50);
  const dirt = near(x, y, BASES, 600) || map.spec.fields.some((f) => Math.hypot(x - f.x, y - f.y) < f.radius + 150) ? 1 : 0;
  return [Math.max(0, 1 - sand - dirt), dirt * (1 - sand), 0, sand];
});

finish(map, { file: "archipelago", marks: BASES, preview: process.argv[2] });
