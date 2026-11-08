import assert from "node:assert/strict";
import { test } from "node:test";
import { UNIT_KINDS } from "@mf/sim";
import { WRECK_HEIGHT } from "../src/render/featureInstance.ts";
import { VERTEX_FLOATS } from "../src/render/meshBuilder.ts";
import { PART } from "../src/render/propMaterials.ts";
import { WRECK_FORMS } from "../src/render/wreckForm.ts";
import { wreckModel } from "../src/render/wreckMeshes.ts";

const PART_COUNT = Object.keys(PART).length;

function bounds(v: Float32Array): { reach: number; top: number } {
  let reach = 0, top = -Infinity;
  for (let i = 0; i < v.length; i += VERTEX_FLOATS) {
    reach = Math.max(reach, Math.hypot(v[i]!, v[i + 1]!));
    top = Math.max(top, v[i + 2]!);
  }
  return { reach, top };
}

test("every wreck model is a valid normalised prop model", () => {
  for (const unit of UNIT_KINDS) {
    for (const form of WRECK_FORMS) {
      const v = wreckModel(unit, form);
      const at = `${unit} ${form}`;
      assert.ok(v.length > 0, at);
      assert.equal(v.length % (VERTEX_FLOATS * 3), 0, at);
      for (const x of v) assert.ok(Number.isFinite(x), at);
      for (let i = 6; i < v.length; i += VERTEX_FLOATS) {
        const p = v[i]!;
        assert.ok(Number.isInteger(p) && p >= 0 && p < PART_COUNT, `${at} part ${p}`);
      }
      const b = bounds(v);
      assert.ok(b.reach <= 1.2, `${at} reach ${b.reach}`);
      assert.ok(b.top <= 1.1 && b.top > 0.1, `${at} top ${b.top}`);
    }
  }
});

test("wreck models are deterministic", () => {
  for (const unit of UNIT_KINDS) {
    for (const form of WRECK_FORMS) assert.deepEqual(wreckModel(unit, form), wreckModel(unit, form));
  }
});

test("each unit's scrap looks different", () => {
  const models = UNIT_KINDS.map((unit) => wreckModel(unit, "scrap"));
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) assert.notDeepEqual(models[i], models[j], `${UNIT_KINDS[i]} vs ${UNIT_KINDS[j]}`);
  }
});

test("wreckage stands lower than scrap once drawn", () => {
  for (const unit of UNIT_KINDS) {
    const scrap = bounds(wreckModel(unit, "scrap")).top * WRECK_HEIGHT.scrap;
    const wreckage = bounds(wreckModel(unit, "wreckage")).top * WRECK_HEIGHT.wreckage;
    assert.ok(wreckage < scrap, `${unit}: ${wreckage} vs ${scrap}`);
  }
});
