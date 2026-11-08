// maps/tutorial/tutorial.json: the tutorial map. One player base in the west, a crystal field beside it,
// a hill with one ramp in the middle north, an enemy base and field in the south-east. No symmetry.
// The subfolder keeps it out of the random map pool. Run: node packages/map/scripts/tutorial.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, assertDry, assertFlat, finish, fillHeights, noise, paintMaterials, scatterSymmetric, sinkCorners, slopeAt, smooth, type Pt, type Transform } from "./lib/gen.ts";
import { calmNear, plateau, ramp } from "./lib/terrain.ts";

const SIZE = { W: 7000, H: 4000 }, { W, H } = SIZE, LAND = 300, TOP = 520;
const ts: Transform[] = [(p) => p];

const PLAYER: Pt = [1200, 2000], ENEMY: Pt = [6000, 2800];
const BASES = [PLAYER, ENEMY];
const FIELD: Pt = [2600, 2000], ENEMY_FIELD: Pt = [5200, 3200];
const HILL: Pt = [3900, 1100], HILL_RADIUS = 600;
/** The ramp runs west from the hill top down to the land north of the field. */
const RAMP_TOP: Pt = [3400, 1050], RAMP_FOOT: Pt = [2150, 1200], RAMP_HALF = 250;

const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);
const toSegment = (x: number, y: number, [ax, ay]: Pt, [bx, by]: Pt): number => {
  const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
};
const ROUTE: [Pt, Pt][] = [[PLAYER, FIELD], [FIELD, RAMP_FOOT], [RAMP_FOOT, RAMP_TOP]];

const map = emptyMap({ name: "Tutorial", width: W, height: H, cell: 125, baseHeight: LAND });

fillHeights(map, (x, y) => {
  const rolling = (noise(x, y, 1100) - 0.5) * 100 + (noise(x, y, 350) - 0.5) * 30;
  const calm = calmNear(x, y, [...BASES, FIELD, ENEMY_FIELD], 750, 1150) * calmNear(x, y, [HILL], 800, 1200);
  const land = LAND + rolling * calm;
  return Math.max(land, plateau(x, y, HILL, HILL_RADIUS, TOP), ramp(x, y, RAMP_FOOT, RAMP_TOP, LAND, TOP, RAMP_HALF));
}, ts);
sinkCorners(map, ts);

addFields(map, [FIELD], 500, 8000, ts);
addFields(map, [ENEMY_FIELD], 450, 5000, ts);
const fields = map.spec.fields.map((f) => ({ x: f.x, y: f.y, radius: f.radius }));
const fieldPts = fields.map((f): Pt => [f.x, f.y]);
assertDry(map, "base", BASES);
assertDry(map, "field", fieldPts);
assertFlat(map, "field", fields);
assertFlat(map, "base", BASES.map(([x, y]) => ({ x, y, radius: 500 })));
assertFlat(map, "hill top", [{ x: HILL[0], y: HILL[1], radius: 450 }], 0);

scatterSymmetric(map, [
  { kind: "tree", x: 600, y: 600, radius: 500, density: 120 },
  { kind: "tree", x: 1500, y: 3500, radius: 500, density: 120 },
  { kind: "tree", x: 5600, y: 900, radius: 600, density: 120 },
  { kind: "tree", x: 3600, y: 3300, radius: 500, density: 110 },
  { kind: "rock", x: W / 2, y: H / 2, radius: 4000, density: 1.5 },
  { kind: "boulder", x: W / 2, y: H / 2, radius: 4000, density: 1 },
], ts, (f) => slopeAt(map, f.x, f.y) < 22
  && !near(f.x, f.y, BASES, 750 + f.radius)
  && !fields.some((d) => Math.hypot(f.x - d.x, f.y - d.y) < 650 + f.radius)
  && !near(f.x, f.y, [HILL], HILL_RADIUS + 300 + f.radius)
  && toSegment(f.x, f.y, RAMP_FOOT, RAMP_TOP) > RAMP_HALF + 300 + f.radius
  && ROUTE.every(([a, b]) => toSegment(f.x, f.y, a, b) > 400 + f.radius));

paintMaterials(map, (x, y, h) => {
  const steep = smooth((slopeAt(map, x, y) - 20) / 25);
  const dirt = near(x, y, BASES, 600) || fieldPts.some(([px, py]) => Math.hypot(x - px, y - py) < 650) ? 1 : 0;
  const rock = Math.max(steep, smooth((h - 480) / 60) * 0.5);
  return [Math.max(0, 1 - rock - dirt), dirt * (1 - rock), rock, 0];
});

finish(map, { file: "tutorial/tutorial", marks: [...BASES, HILL], preview: process.argv[2] });
