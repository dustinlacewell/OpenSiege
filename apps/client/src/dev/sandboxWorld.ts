// The dev sandbox world: two armies face each other across the map centre. Pure.
import { ANGLE_STEPS, createWorld, DEFAULT_MAP_PARAMS, generateMap, mapCentre, mapSize, spawnUnit, START_CREDITS, UNIT_STATS, type Player, type UnitKind, type World } from "@mf/sim";

/** The two sandbox players. Real player ids start at 1. */
export const SANDBOX_SIDES = [1, 2] as const;

const NAMES = ["West", "East"];
const COLORS = 12;
/** Half the gap between the two front tank rows. Tank reach (1050 with height) plus engage search (300) is below the full gap. */
const HALF_GAP = 850;
/** Centre-to-centre spacing, in radii. */
const SPACING = 2.5;
/** Features closer than this to the centre on each axis are cleared, so no unit starts inside a rock. */
const CLEAR_X = 2400;
const CLEAR_Y = 900;

type Point = { x: number; y: number };

/** One row of the layout, front to back: the kinds, laid out side by side. */
type Row = readonly UnitKind[];

const ROWS: readonly Row[] = [
  Array(10).fill("tank"),
  Array(10).fill("tank"),
  Array(10).fill("artillery"),
  Array(5).fill("engineer"),
  ["mine", "radar", "jammer", "mine"],
  ["harvester", "factory", "harvester"],
];

/** A fresh world from the seed with both sides in place, their players added with the normal starting credits. */
export function sandboxWorld(seed: number): World {
  const world = createWorld(generateMap(seed, DEFAULT_MAP_PARAMS));
  const centre = mapCentre(mapSize(world.terrain));
  world.features = world.features.filter((f) => Math.abs(f.x - centre.x) > CLEAR_X + f.radius || Math.abs(f.y - centre.y) > CLEAR_Y + f.radius);
  SANDBOX_SIDES.forEach((id, i) => {
    world.players.push(playerOf(id, NAMES[i]!));
    placeSide(world, centre, id, i === 0 ? -1 : 1);
  });
  return world;
}

function playerOf(id: number, name: string): Player {
  return { id, name, color: id % COLORS, credits: START_CREDITS, alive: true, connected: true, team: id };
}

/** `back` is the x direction away from the enemy: -1 for the west side, +1 for the east side. */
function placeSide(world: World, centre: Point, owner: number, back: -1 | 1): void {
  const facing = back === -1 ? 0 : ANGLE_STEPS / 2;
  let depth = 0;
  let prevRadius = 0;
  for (const row of ROWS) {
    const radius = rowRadius(row);
    if (prevRadius > 0) depth += (SPACING / 2) * (prevRadius + radius);
    const x = centre.x + back * Math.round(HALF_GAP + depth);
    placeRow(world, centre.y, owner, row, x, facing);
    prevRadius = radius;
  }
}

/** Units side by side along y, centred on the map centre, each pair `SPACING` mean radii apart. */
function placeRow(world: World, centreY: number, owner: number, row: Row, x: number, facing: number): void {
  const offsets = rowOffsets(row);
  row.forEach((kind, i) => {
    const u = spawnUnit(world, owner, kind, x, centreY + offsets[i]!);
    u.facing = facing;
    u.aim = facing;
  });
}

function rowOffsets(row: Row): number[] {
  const at: number[] = [0];
  for (let i = 1; i < row.length; i++) {
    at.push(at[i - 1]! + (SPACING / 2) * (UNIT_STATS[row[i - 1]!].radius + UNIT_STATS[row[i]!].radius));
  }
  const mid = at[at.length - 1]! / 2;
  return at.map((y) => Math.round(y - mid));
}

function rowRadius(row: Row): number {
  return Math.max(...row.map((k) => UNIT_STATS[k].radius));
}
