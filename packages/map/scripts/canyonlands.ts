// maps/canyonlands.json: a winding river canyon with cliff walls splits the map north to south and is crossed at two dams.
// Each base sits on a raised deck. A stepped mesa with a high nest stands on each flank. Half-turn symmetry.
// Run: node packages/map/scripts/canyonlands.ts [preview.png]
import { emptyMap } from "../src/index.ts";
import { addFields, assertDry, assertFlat, finish, fillHeights, noise, orbit, paintMaterials, scatterSymmetric, seaOf, slopeAt, smooth, turn2, wetAt, type Pt } from "./lib/gen.ts";
import { calmNear, forestBrushes, plateau, ramp } from "./lib/terrain.ts";

const SIZE = { W: 24000, H: 14000 }, { W, H } = SIZE, LAND = 440, FLOOR = 60, DECK = 600, MESA = 760, NEST = 880;
const ts = turn2(SIZE);
const mirror = (p: Pt): Pt => ts[1]!(p);
const near = (x: number, y: number, pts: Pt[], r: number) => pts.some(([px, py]) => Math.hypot(x - px, y - py) < r);

const BASE: Pt = [2400, 7000];
const BASES = [BASE, mirror(BASE)];
const DAMS_Y = [3500, 10500];
const MESA_AT: Pt = [7600, 2600], NEST_AT: Pt = [7600, 2100];
const MESAS = [MESA_AT, mirror(MESA_AT)], NESTS = [NEST_AT, mirror(NEST_AT)];

const canyonX = (y: number) => W / 2 + 1800 * Math.sin((2 * Math.PI * (y - H / 2)) / 7000);
const canyonSlope = (y: number) => 1800 * ((2 * Math.PI) / 7000) * Math.cos((2 * Math.PI * (y - H / 2)) / 7000);

const FIELD_GROUPS: [Pt[], number, number][] = [
  [[[1300, 7000], [2900, 5600], [2900, 8400]], 500, 5000],
  [[[6500, 3100], [8700, 3100]], 500, 6000],
  [[NEST_AT], 350, 9000],
  [[[W / 2, 3500]], 500, 7000],
  [[[9600, 7000]], 500, 6000],
];
const fieldSpots = FIELD_GROUPS.flatMap(([pts]) => pts.flatMap((p) => orbit(p, ts)));
const spots: Pt[] = [...fieldSpots, ...BASES];

const map = emptyMap({ name: "Canyonlands", width: W, height: H, cell: 125, baseHeight: LAND });

fillHeights(map, (x, y) => {
  const d = Math.abs(x - canyonX(y)) / Math.sqrt(1 + canyonSlope(y) ** 2);
  const dam = Math.max(...DAMS_Y.map((dy) => 1 - smooth((Math.abs(y - dy) - 400) / 1200)));
  const floor = FLOOR + (LAND - FLOOR) * smooth(dam * 1.25);
  const inside = 1 - smooth((d - 450) / 170);
  const rolling = (noise(x, y, 1200) - 0.5) * 90 + (noise(x, y, 350) - 0.5) * 30;
  const land = LAND + rolling * calmNear(x, y, spots, 600, 1000) * (1 - inside);
  const canyon = land - (land - floor) * inside;

  const decks = BASES.map((b) => plateau(x, y, b, 2000, DECK));
  const exits = [[[6400, 7000], [4350, 7000]], [[W - 6400, 7000], [W - 4350, 7000]]] as [Pt, Pt][];
  const deckRamps = exits.map(([a, b]) => ramp(x, y, a, b, LAND, DECK, 450));
  const mesas = MESAS.map((m) => plateau(x, y, m, 1800, MESA));
  const nests = NESTS.map((n) => plateau(x, y, n, 700, NEST));
  const mesaRamps = [
    ...MESAS.map((m, i) => { const s = i === 0 ? 1 : -1; return ramp(x, y, [m[0], m[1] + s * 4150], [m[0], m[1] + s * 1750], LAND, MESA, 400); }),
    ...NESTS.map((n, i) => { const s = i === 0 ? 1 : -1; return ramp(x, y, [n[0], n[1] + s * 1650], [n[0], n[1] + s * 650], MESA, NEST, 300); }),
  ];
  return Math.max(canyon, ...decks, ...deckRamps, ...mesas, ...nests, ...mesaRamps);
}, ts);

for (const [pts, radius, amount] of FIELD_GROUPS) addFields(map, pts, radius, amount, ts);
const fields = map.spec.fields.map((f) => ({ x: f.x, y: f.y, radius: f.radius }));
assertDry(map, "base", BASES);
assertDry(map, "field", fields.map((f): Pt => [f.x, f.y]));
assertFlat(map, "field", fields, 45);

const fieldPts = fields.map((f): Pt => [f.x, f.y]);
scatterSymmetric(map, [
  ...forestBrushes(SIZE, 1400, 2600, 0.57, 700, 140),
  { kind: "rock", x: W / 2, y: H / 2, radius: 14000, density: 1.6 },
  { kind: "boulder", x: W / 2, y: H / 2, radius: 14000, density: 1.6 },
], ts, (f) => !wetAt(map, f.x, f.y, 40) && slopeAt(map, f.x, f.y) < 22 && !near(f.x, f.y, fieldPts, f.radius + 600) && !near(f.x, f.y, BASES, 900));

const sea = seaOf(map);
paintMaterials(map, (x, y, h) => {
  const steep = smooth((slopeAt(map, x, y) - 20) / 25);
  const sand = 1 - smooth((h - sea) / 45);
  const dirt = near(x, y, BASES, 600) || fieldPts.some(([px, py]) => Math.hypot(x - px, y - py) < 650) ? 1 : 0;
  const rock = Math.max(steep, smooth((h - 650) / 150));
  return [Math.max(0, 1 - rock - dirt - sand), dirt * (1 - rock) * (1 - sand), rock * (1 - sand), sand];
});

finish(map, { file: "canyonlands", marks: BASES, preview: process.argv[2] });
