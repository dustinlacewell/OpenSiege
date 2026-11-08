// maps/lagoon.json: four corner highlands around a deep lagoon. One island in the middle holds the richest field,
// reachable only by wading. Four shore fields sit on the axes. Quarter-turn symmetry. Run: node packages/map/scripts/lagoon.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, assertDry, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, seaOf, smooth, turn4, wetAt, type Pt } from "./lib/gen.ts";

const SIZE = { W: 8000, H: 8000 }, { W, H } = SIZE, C = W / 2, LAND = 300, FLOOR = 60;
const ts = turn4(SIZE);
const BASES = orbit([1400, 1400], ts);
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);

const map = emptyMap({ name: "Lagoon", width: W, height: H, cell: 125, baseHeight: LAND });

fillHeights(map, (x, y) => {
  const r = Math.hypot(x - C, y - C) + (noise(x, y, 1100) - 0.5) * 500;
  const bowl = 1 - smooth((r - 1600) / 1500);
  const island = 1 - smooth((r - 150) / 1400);
  const wet = bowl * (1 - island);
  const highland = 120 * smooth((Math.hypot(x - C, y - C) - 2800) / 1000);
  const rolling = (noise(x, y, 900) - 0.5) * 110 + (noise(x, y, 300) - 0.5) * 40;
  const away = Math.min(...BASES.map(([bx, by]) => smooth((Math.hypot(x - bx, y - by) - 900) / 600)));
  const dry = LAND + highland + rolling * away * (1 - bowl);
  return dry + (FLOOR - dry) * wet;
}, ts);

addFields(map, [[1000, 2600], [2600, 1000]], 500, 5000, ts);
addFields(map, [[4000, 1000]], 500, 5000, ts);
addFields(map, [[C, C]], 350, 9000, [ts[0]!]);
assertDry(map, "base", BASES);
assertDry(map, "field", map.spec.fields.map((f): Pt => [f.x, f.y]));

const fieldPts = map.spec.fields.map((f): Pt => [f.x, f.y]);
scatterSymmetric(map, [
  { kind: "tree", x: 1200, y: 3800, radius: 700, density: 150 },
  { kind: "tree", x: 3000, y: 2000, radius: 600, density: 150 },
  { kind: "tree", x: 700, y: 700, radius: 400, density: 120 },
  { kind: "rock", x: C, y: C, radius: 3800, density: 4 },
  { kind: "boulder", x: C, y: C, radius: 3800, density: 4 },
], ts, (f) => !wetAt(map, f.x, f.y, 40) && !near(f.x, f.y, fieldPts, 650) && !near(f.x, f.y, BASES, 750));

const sea = seaOf(map);
paintMaterials(map, (x, y, h) => {
  const rock = smooth((h - 480) / 150);
  const sand = 1 - smooth((h - sea) / 50);
  const dirt = near(x, y, BASES, 600) || map.spec.fields.some((f) => Math.hypot(x - f.x, y - f.y) < f.radius + 150) ? 1 : 0;
  return [Math.max(0, 1 - rock - dirt - sand), dirt * (1 - rock) * (1 - sand), rock, sand];
});

finish(map, { file: "lagoon", marks: BASES, preview: process.argv[2] });
