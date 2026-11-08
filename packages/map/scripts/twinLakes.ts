// maps/twin-lakes.json: two deep lakes, north and south, leave a dry land bridge between the bases.
// Each lake has an island with a field, reachable by wading. Half-turn symmetry. Run: node packages/map/scripts/twinLakes.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, assertDry, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, seaOf, smooth, turn2, wetAt, type Pt } from "./lib/gen.ts";

const SIZE = { W: 12000, H: 6000 }, { W, H } = SIZE, LAND = 320, FLOOR = 60;
const ts = turn2(SIZE);
const BASES = orbit([1900, 3000], ts);
const LAKE: Pt = [W / 2, 800];
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);

const map = emptyMap({ name: "Twin Lakes", width: W, height: H, cell: 125, baseHeight: LAND });

fillHeights(map, (x, y) => {
  const wob = (noise(x, y, 1200) - 0.5) * 400;
  const lakes = [LAKE, ts[1]!(LAKE)].map(([lx, ly]) => 1 - smooth((Math.hypot((x - lx) * 0.75, y - ly) + wob - 1100) / 1400));
  const bowl = Math.max(...lakes);
  const islands = [LAKE, ts[1]!(LAKE)].map(([lx, ly]) => 1 - smooth((Math.hypot(x - lx, y - ly) - 150) / 1100));
  const wet = bowl * (1 - Math.max(...islands));
  const rolling = (noise(x, y, 1000) - 0.5) * 120 + (noise(x, y, 320) - 0.5) * 40;
  const away = Math.min(...BASES.map(([bx, by]) => smooth((Math.hypot(x - bx, y - by) - 1000) / 600)));
  const dry = LAND + rolling * away * (1 - bowl);
  return dry + (FLOOR - dry) * wet;
}, ts);

addFields(map, [[900, 3000], [2800, 1500], [2800, 4500]], 500, 5000, ts);
addFields(map, [[W / 2, 3000]], 500, 7000, [ts[0]!]);
addFields(map, [LAKE], 300, 8000, ts);
assertDry(map, "base", BASES);
assertDry(map, "field", map.spec.fields.map((f): Pt => [f.x, f.y]));

const fieldPts = map.spec.fields.map((f): Pt => [f.x, f.y]);
scatterSymmetric(map, [
  { kind: "tree", x: 3600, y: 3000, radius: 900, density: 150 },
  { kind: "tree", x: 1200, y: 800, radius: 700, density: 150 },
  { kind: "tree", x: 1200, y: 5200, radius: 700, density: 150 },
  { kind: "tree", x: 4800, y: 3000, radius: 500, density: 140 },
  { kind: "rock", x: 4500, y: 3000, radius: 3600, density: 3 },
  { kind: "boulder", x: 6000, y: 3000, radius: 6500, density: 3 },
], ts, (f) => f.x < W / 2 - 100 && !wetAt(map, f.x, f.y, 40) && !near(f.x, f.y, fieldPts, 650) && !near(f.x, f.y, BASES, 750));

const sea = seaOf(map);
paintMaterials(map, (x, y, h) => {
  const sand = 1 - smooth((h - sea) / 50);
  const dirt = near(x, y, BASES, 600) || map.spec.fields.some((f) => Math.hypot(x - f.x, y - f.y) < f.radius + 150) ? 1 : 0;
  return [Math.max(0, 1 - sand - dirt), dirt * (1 - sand), 0, sand];
});

finish(map, { file: "twin-lakes", marks: BASES, preview: process.argv[2] });
