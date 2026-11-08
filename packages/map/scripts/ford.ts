// maps/ford.json: a winding north-south river between two bases, crossed by three shallow fords.
// Half-turn symmetry. Run: node packages/map/scripts/ford.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, smooth, turn2, type Pt } from "./lib/gen.ts";

const SIZE = { W: 12000, H: 6000 }, { W, H } = SIZE, BASE = 350;
const ts = turn2(SIZE);
const BASES = orbit([2000, 3000], ts);
const FORDS_Y = [H / 2 - 1800, H / 2, H / 2 + 1800];
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);
const riverX = (y: number) => W / 2 + 700 * Math.sin((2 * Math.PI * (y - H / 2)) / 3600);

const map = emptyMap({ name: "Ford", width: W, height: H, cell: 125, baseHeight: BASE });

fillHeights(map, (x, y) => {
  const d = Math.abs(x - riverX(y));
  const ford = Math.max(...FORDS_Y.map((fy) => 1 - smooth(Math.abs(y - fy) / 450)));
  const bed = Math.exp(-((d / 500) ** 2)) * 230 * (1 - 0.8 * ford);
  const bankRise = smooth((d - 500) / 900) * 60;
  const rolling = (noise(x, y, 1000) - 0.5) * 130 + (noise(x, y, 320) - 0.5) * 40;
  const away = Math.min(...BASES.map(([bx, by]) => smooth((Math.hypot(x - bx, y - by) - 1000) / 600)));
  return BASE - bed + bankRise + rolling * away * (0.5 + 0.5 * smooth(d / 800));
}, ts);

addFields(map, [[1000, 3000], [3000, 1500], [3000, 4500]], 500, 5000, ts);
addFields(map, [[4800, 3000]], 500, 5000, ts);

const fieldPts = map.spec.fields.map((f): Pt => [f.x, f.y]);
scatterSymmetric(map, [
  { kind: "tree", x: 3300, y: 3000, radius: 900, density: 150 },
  { kind: "tree", x: 1200, y: 800, radius: 700, density: 150 },
  { kind: "tree", x: 4300, y: 800, radius: 700, density: 150 },
  { kind: "tree", x: 4300, y: 5200, radius: 700, density: 150 },
  { kind: "rock", x: 4500, y: 3000, radius: 3600, density: 3 },
  { kind: "boulder", x: 6000, y: 3000, radius: 6500, density: 3 },
], ts, (f) => f.x < W / 2 - 100 && !near(f.x, f.y, fieldPts, 650) && !near(f.x, f.y, BASES, 750) && Math.abs(f.x - riverX(f.y)) > 500);

paintMaterials(map, (x, y, h) => {
  const d = Math.abs(x - riverX(y));
  const sand = 1 - smooth((d - 450) / 500);
  const dirt = near(x, y, BASES, 600) || map.spec.fields.some((f) => Math.hypot(x - f.x, y - f.y) < f.radius + 150) ? 1 : 0;
  const rock = smooth((h - 520) / 150);
  return [Math.max(0, 1 - sand - dirt - rock), dirt * (1 - sand), rock, sand];
});

finish(map, { file: "ford", marks: BASES, preview: process.argv[2] });
