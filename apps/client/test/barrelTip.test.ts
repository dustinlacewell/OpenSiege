import { test } from "node:test";
import assert from "node:assert/strict";
import { muzzleTip, PROJ_FP, UNIT_STATS, type Terrain, type Unit, type UnitKind, type World } from "@mf/sim";
import { barrelOf, muzzleX, muzzleZ } from "../src/game/muzzle.ts";
import { createPoseTable, fillPoses } from "../src/game/poses.ts";
import { UNIT_MESHES } from "../src/render/meshes.ts";
import { barrelVertex } from "./support/unitVertex.ts";

// The drawn barrel tip (the unit shader's transform, replicated in `support/unitVertex.ts`) and the
// sim's `muzzleTip`, where shells start, agree on flat ground and on a 15° slope, mobile and sieged.

const TOLERANCE = 1.5;
const CELL = 20;
const SIZE = 200;
const AT = 2000;

/** A plane rising `grade` (rise per run) along +x. */
function plane(grade: number): Terrain {
  const heights: number[] = [];
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) heights.push(100 + Math.round(i * CELL * grade));
  return { cols: SIZE, rows: SIZE, cell: CELL, heights, seaLevel: 0 };
}

const FLAT = plane(0);
const SLOPE = plane(Math.tan((15 * Math.PI) / 180));

function unit(kind: UnitKind, facing: number, aim: number, sieged: boolean, elevation: number): Unit {
  return { id: 1, owner: 0, kind, x: AT, y: AT, facing, aim, elevation, mode: sieged ? "sieged" : "mobile", modeTimer: 0, orders: [] } as unknown as Unit;
}

/** Distance between the drawn tip and the sim tip of `u` on `terrain`, world units. */
function tipError(u: Unit, terrain: Terrain): number {
  const table = createPoseTable();
  fillPoses(table, { units: [u], terrain } as unknown as World, new Map(), 1);
  const b = barrelOf(u.kind)!;
  const drawn = barrelVertex({ x: muzzleX(b), y: 0, z: muzzleZ(b) }, table.poses[0]!, UNIT_MESHES[u.kind]().gun!);
  const sim = muzzleTip(u, terrain, u.aim, u.elevation);
  return Math.hypot(drawn.x - sim.x / PROJ_FP, drawn.y - sim.y / PROJ_FP, drawn.z - sim.z / PROJ_FP);
}

/** Hull facings in angle steps: on SLOPE, 0 faces uphill, 128 downhill, 64 and 192 across. */
const FACINGS = [0, 64, 128, 192];
/** Turret bearings relative to the hull, angle steps: straight ahead and 90° each way. */
const TURNS = [0, 64, -64];
const ELEVATIONS: Record<string, number[]> = { tank: [0, 150], artillery: [700, 1500] };

for (const kind of ["tank", "artillery"] as const) {
  test(`${kind}: the drawn barrel tip is on the sim's muzzle tip, flat and on a 15° slope, mobile and sieged`, () => {
    assert.ok(UNIT_STATS[kind].sink > 0);
    let worst = 0;
    for (const terrain of [FLAT, SLOPE]) {
      for (const facing of FACINGS) {
        for (const turn of TURNS) {
          for (const sieged of [false, true]) {
            for (const elevation of ELEVATIONS[kind]!) {
              const u = unit(kind, facing, (facing + turn + 256) % 256, sieged, elevation);
              const e = tipError(u, terrain);
              worst = Math.max(worst, e);
              assert.ok(e <= TOLERANCE, `${terrain === FLAT ? "flat" : "slope"} facing ${facing} turn ${turn} ${sieged ? "sieged" : "mobile"} elevation ${elevation}: off by ${e.toFixed(2)}`);
            }
          }
        }
      }
    }
    console.log(`${kind} worst tip error ${worst.toFixed(3)}`);
  });
}
