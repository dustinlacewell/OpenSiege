import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap } from "@mf/sim";
import { heightEdge } from "../src/terrain/edge.ts";
import { cellAt } from "../src/terrain/grid.ts";
import { studyPath } from "../src/terrain/path.ts";
import { studyMap } from "../src/terrain/study.ts";
import { GAP, ridge, RIDGE_X, terrainOf, wallWithGap, worldOf } from "./terrainWorld.ts";

const wallStudy = () => studyMap(worldOf(terrainOf(wallWithGap), [{ x: 1000, y: 1000 }, { x: 4000, y: 1000 }, { x: 1000, y: 4000 }, { x: 4000, y: 4000 }]));

test("terrain study: the wall is blocked and the gap is open", () => {
  const s = wallStudy();
  assert.equal(s.passable[cellAt(s, { x: 2400, y: 1000 })], 0);
  assert.equal(s.passable[cellAt(s, { x: 2400, y: 2400 })], 1);
});

test("terrain study: the gap carries the most flow and is narrow", () => {
  const s = wallStudy();
  const gap = cellAt(s, { x: 2400, y: 2400 }), open = cellAt(s, { x: 1000, y: 2500 });
  assert.ok(s.flow[gap]! > 0.9, `gap flow ${s.flow[gap]}`);
  assert.ok(s.flow[gap]! > s.flow[open]!);
  assert.ok(s.width[gap]! <= 2, `gap width ${s.width[gap]}`);
  assert.ok(s.width[gap]! < s.width[open]!);
});

test("terrain study: the path from one side of the wall to the other goes through the gap", () => {
  const s = wallStudy();
  const path = studyPath(s, { x: 1000, y: 500 }, { x: 4000, y: 500 });
  assert.ok(path.length > 0);
  const crossing = path.filter((p) => p.x > 2250 && p.x < 2750);
  assert.ok(crossing.length > 0 && crossing.every((p) => Math.abs(p.y - GAP.y) < 250), JSON.stringify(crossing));
});

test("terrain study: a ridge crest has a height edge facing down-slope and none facing up", () => {
  const s = studyMap(worldOf(terrainOf((x) => ridge(x)), []));
  const crest = cellAt(s, { x: RIDGE_X, y: 2500 }), flank = cellAt(s, { x: RIDGE_X + 600, y: 2500 });
  assert.ok(heightEdge(s, crest, { x: 1, y: 0 }, 800) > 100);
  assert.ok(heightEdge(s, crest, { x: -1, y: 0 }, 800) > 0, "the crest faces down-slope both ways");
  assert.equal(heightEdge(s, flank, { x: -1, y: 0 }, 800), 0, "facing up the slope");
  assert.ok(heightEdge(s, crest, { x: 1, y: 0 }, 800) <= 400);
});

test("terrain study: a 16000 x 12000 map studies in under 200 ms", () => {
  const w = createWorld(generateMap(1, { width: 16000, height: 12000, cell: 125 }));
  studyMap(w);
  const t0 = performance.now();
  const s = studyMap(w);
  const ms = performance.now() - t0;
  console.log(`study ${s.cols}x${s.rows}, ${w.fields.length} fields: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 200, `${ms} ms`);
});
