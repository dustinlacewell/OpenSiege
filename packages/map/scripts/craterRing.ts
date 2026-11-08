// maps/crater-ring.json: four bases in the corners, a low crater in the middle, a ridge ring with four gaps.
// Four-fold symmetry. Run: node packages/map/scripts/craterRing.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, smooth, turn4, type Pt } from "./lib/gen.ts";

const SIZE = { W: 8000, H: 8000 }, { W, H } = SIZE, C = W / 2, BASE = 300;
const ts = turn4(SIZE);
const BASES = orbit([1400, 1400], ts);
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);

const map = emptyMap({ name: "Crater Ring", width: W, height: H, cell: 125, baseHeight: BASE });

fillHeights(map, (x, y) => {
  const r = Math.hypot(x - C, y - C);
  const gate = smooth(Math.min(Math.abs(x - C), Math.abs(y - C)) / 700);
  const ring = Math.exp(-(((r - 2300) / 450) ** 2)) * 500 * (0.15 + 0.85 * gate);
  const crater = -70 * (1 - smooth((r - 900) / 700));
  const rolling = (noise(x, y, 900) - 0.5) * 110 + (noise(x, y, 300) - 0.5) * 40;
  const away = Math.min(...BASES.map(([bx, by]) => smooth((Math.hypot(x - bx, y - by) - 900) / 600)));
  return BASE + ring + crater + rolling * away;
}, ts);

addFields(map, [[1000, 2600], [2600, 1000]], 500, 5000, ts);
addFields(map, [[4000, 3000]], 500, 5000, ts);

const fieldPts = map.spec.fields.map((f): Pt => [f.x, f.y]);
scatterSymmetric(map, [
  { kind: "tree", x: 1200, y: 3800, radius: 700, density: 150 },
  { kind: "tree", x: 3000, y: 2000, radius: 600, density: 150 },
  { kind: "tree", x: 700, y: 700, radius: 400, density: 120 },
  { kind: "rock", x: C, y: C, radius: 3800, density: 4 },
  { kind: "boulder", x: C, y: C, radius: 3800, density: 4 },
], ts, (f) => !near(f.x, f.y, fieldPts, 650) && !near(f.x, f.y, BASES, 750));

paintMaterials(map, (x, y, h) => {
  const rock = smooth((h - 480) / 150);
  const sand = 1 - smooth((Math.hypot(x - C, y - C) - 700) / 500);
  const dirt = near(x, y, BASES, 600) || map.spec.fields.some((f) => Math.hypot(x - f.x, y - f.y) < f.radius + 150) ? 1 : 0;
  return [Math.max(0, 1 - rock - dirt - sand), dirt * (1 - rock), rock, sand * (1 - rock)];
});

finish(map, { file: "crater-ring", marks: BASES, preview: process.argv[2] });
