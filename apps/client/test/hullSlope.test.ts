import { test } from "node:test";
import assert from "node:assert/strict";
import { hullSlope, UNIT_KINDS, UNIT_STATS, type Terrain, type Unit, type World } from "@mf/sim";
import { createPoseTable, fillPoses } from "../src/game/poses.ts";

// The sim's integer hull slopes (`hullSlope`) and the client's drawn tilt (`fillPoses`) agree at integer facings.

const CELL = 20;
const SIZE = 200;

/** Ground rising `gx` along +x and `gy` along +y, plus a gentle bump so the slope varies. */
function ground(gx: number, gy: number): Terrain {
  const heights: number[] = [];
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) heights.push(300 + Math.round(i * CELL * gx + j * CELL * gy + 40 * Math.sin(i / 9) * Math.cos(j / 7)));
  }
  return { cols: SIZE, rows: SIZE, cell: CELL, heights, seaLevel: 0 };
}

/**
 * Radians apart allowed. `heightAt` floors to whole units and the sim samples at whole-unit points, so two
 * samples can each be 1 off over a baseline of 2d: up to 0.05 rad for the smallest hull (mine, d 20).
 */
const TOLERANCE = 0.06;

test("hullSlope matches the drawn pitch and roll at every 8th facing", () => {
  let worst = 0;
  for (const terrain of [ground(0.27, 0), ground(0.15, -0.2), ground(0, 0)]) {
    for (const kind of UNIT_KINDS) {
      for (let facing = 0; facing < 256; facing += 8) {
        const u = { id: 1, owner: 0, kind, x: 2011, y: 1987, facing, aim: facing, elevation: 0, mode: "mobile", modeTimer: 0, orders: [] } as unknown as Unit;
        const table = createPoseTable();
        fillPoses(table, { units: [u], terrain } as unknown as World, new Map(), 1);
        const p = table.poses[0]!;
        const s = hullSlope(terrain, u.x, u.y, facing, UNIT_STATS[kind].radius);
        const e = Math.max(Math.abs(Math.atan(s.fwd / 1000) - p.pitch), Math.abs(Math.atan(s.side / 1000) - p.roll));
        worst = Math.max(worst, e);
        assert.ok(e <= TOLERANCE, `${kind} facing ${facing}: off by ${e.toFixed(4)} rad`);
      }
    }
  }
  console.log(`hullSlope worst error ${worst.toFixed(4)} rad`);
});
