// maps/stairway.json: four bases on a low rim, a mid plateau and a high central plateau, all with cliff edges.
// Ramps up to the mid plateau are on the axes; ramps up to the centre are on the diagonals, so a climb winds round.
// Quarter-turn symmetry. Run: node packages/map/scripts/stairway.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, assertDry, assertFlat, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, sinkCorners, slopeAt, smooth, turn4, wetAt, type Pt } from "./lib/gen.ts";
import { calmNear, forestBrushes, plateau, polar, ramp } from "./lib/terrain.ts";

const SIZE = { W: 20000, H: 20000 }, { W, H } = SIZE, C: Pt = [W / 2, H / 2], LAND = 300, MID = 520, HIGH = 760;
const ts = turn4(SIZE);
const BASES = orbit([2400, 2400], ts);
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);

const midAt = polar(C, 4900, 20), midAt2 = polar(C, 4900, 70);
const FIELDS: [Pt[], number, number][] = [
  [[[1000, 4800], [4800, 1000]], 500, 5000],
  [[midAt, midAt2], 500, 6000],
  [[polar(C, 1900, 0)], 450, 7000],
];
const spots = FIELDS.flatMap(([pts]) => pts.flatMap((p) => orbit(p, ts))).concat([C], BASES);

const map = emptyMap({ name: "Stairway", width: W, height: H, cell: 125, baseHeight: LAND });

const midRamps = [0, 90, 180, 270].map((a) => [polar(C, 7700, a), polar(C, 6450, a)] as [Pt, Pt]);
const highRamps = [45, 135, 225, 315].map((a) => [polar(C, 4900, a), polar(C, 3150, a)] as [Pt, Pt]);

fillHeights(map, (x, y) => {
  const mid = plateau(x, y, C, 6500, MID), high = plateau(x, y, C, 3200, HIGH);
  const rolling = (noise(x, y, 1100) - 0.5) * 120 + (noise(x, y, 340) - 0.5) * 40;
  const ground = LAND + rolling * calmNear(x, y, spots, 600, 1000);
  const ramps = [...midRamps.map(([a, b]) => ramp(x, y, a, b, LAND, MID, 450)), ...highRamps.map(([a, b]) => ramp(x, y, a, b, MID, HIGH, 400))];
  return Math.max(ground, mid, high, ...ramps);
}, ts);
sinkCorners(map, ts);

for (const [pts, radius, amount] of FIELDS) addFields(map, pts, radius, amount, ts);
addFields(map, [C], 600, 12000, [ts[0]!]);
const fields = map.spec.fields.map((f) => ({ x: f.x, y: f.y, radius: f.radius }));
assertDry(map, "base", BASES);
assertDry(map, "field", fields.map((f): Pt => [f.x, f.y]));
assertFlat(map, "field", fields);

const fieldPts = fields.map((f): Pt => [f.x, f.y]);
const ok = (x: number, y: number, pad: number) => !wetAt(map, x, y, 40) && slopeAt(map, x, y) < 22 && !near(x, y, fieldPts, pad) && !near(x, y, BASES, 800);
scatterSymmetric(map, [
  ...forestBrushes(SIZE, 1400, 2600, 0.58, 700, 140),
  { kind: "rock", x: W / 2, y: H / 2, radius: 14200, density: 1.4 },
  { kind: "boulder", x: W / 2, y: H / 2, radius: 14200, density: 1.4 },
], ts, (f) => ok(f.x, f.y, f.radius + 600) && (f.kind !== "tree" || Math.hypot(f.x - C[0], f.y - C[1]) > 3400));

paintMaterials(map, (x, y, h) => {
  const steep = smooth((slopeAt(map, x, y) - 20) / 25);
  const high = smooth((h - 450) / 200);
  const dirt = near(x, y, BASES, 600) || fieldPts.some(([px, py]) => Math.hypot(x - px, y - py) < 650) ? 1 : 0;
  const rock = Math.max(steep, high * 0.6);
  return [Math.max(0, 1 - rock - dirt), dirt * (1 - rock), rock, 0];
});

finish(map, { file: "stairway", marks: BASES, preview: process.argv[2] });
