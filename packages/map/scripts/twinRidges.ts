// maps/twin-ridges.json: two bases, one central ridge, two passes. Run: node packages/map/scripts/twinRidges.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, finish, fillHeights, noise, paintMaterials, scatterSymmetric, smooth, turn2, type Pt } from "./lib/gen.ts";

const SIZE = { W: 10000, H: 6000 }, { W, H } = SIZE, BASE = 300;
const ts = turn2(SIZE);
const BASE_SPOT: Pt = [1700, 3000];
const BASES = [BASE_SPOT, ts[1]!(BASE_SPOT)];
const PASSES_Y = [1500, 4500];
const BASE_FIELDS: Pt[] = [[900, 3000], [2500, 1800], [2500, 4200]];
const CENTRE_FIELDS: Pt[] = [[5000, 1500], [5000, 4500]];

const map = emptyMap({ name: "Twin Ridges", width: W, height: H, cell: 125, baseHeight: BASE });

fillHeights(map, (x, y) => {
  const ridge = Math.exp(-(((x - W / 2) / 1100) ** 2)) * 500;
  const gate = Math.min(...PASSES_Y.map((py) => smooth(Math.abs(y - py) / 800)));
  const rolling = (noise(x, y, 900) - 0.5) * 120 + (noise(x, y, 300) - 0.5) * 40;
  const away = Math.min(...BASES.map(([bx, by]) => smooth((Math.hypot(x - bx, y - by) - 1000) / 600)));
  return BASE + ridge * (0.15 + 0.85 * gate) + rolling * away * (0.4 + gate * 0.6);
}, ts);

addFields(map, BASE_FIELDS, 500, 5000, ts);
for (const [x, y] of CENTRE_FIELDS) addFields(map, [[x, y]], 500, 5000, [ts[0]!]);

const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);
const fieldPts = map.spec.fields.map((f): Pt => [f.x, f.y]);
const forest = (x: number, y: number, radius: number) => ({ kind: "tree" as const, x, y, radius, density: 160 });
scatterSymmetric(map, [
  forest(3300, 700, 600), forest(3500, 5300, 600), forest(1000, 1100, 500), forest(1000, 4900, 500), forest(4000, 3000, 450),
  { kind: "rock", x: 4000, y: 3000, radius: 1600, density: 6 },
  { kind: "boulder", x: 3500, y: 3000, radius: 3200, density: 5 },
], ts, (f) => f.x < W / 2 - 150 && !near(f.x, f.y, fieldPts, 650) && !near(f.x, f.y, BASES, 750));

paintMaterials(map, (x, y, h) => {
  const rock = smooth((h - 480) / 150);
  const dirt = near(x, y, BASES, 600) || map.spec.fields.some((f) => Math.hypot(x - f.x, y - f.y) < f.radius + 150) ? 1 : 0;
  return [Math.max(0, 1 - rock - dirt), dirt * (1 - rock), rock, 0];
});

finish(map, { file: "twin-ridges", marks: BASES, preview: process.argv[2] });
