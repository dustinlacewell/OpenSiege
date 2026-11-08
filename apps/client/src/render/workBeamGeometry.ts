import { heightAt, UNIT_STATS, type Feature, type Terrain } from "@mf/sim";
import { featureById } from "../game/lookup.ts";
import { poseById, type PoseTable, type UnitPose } from "../game/poses.ts";
import { ENGINEER_EMITTER } from "./meshSupport.ts";

/** How far up the target's height the beam lands. */
const TARGET_HEIGHT = 0.5;
/** How far up its unit's height a beam lands on scrap: low, as scrap lies on the ground. */
const SCRAP_HEIGHT = 0.2;

/** One work beam: from the engineer's mast light (a) to the unit or scrap it works on (b). World units. */
export interface WorkBeam {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
}

/**
 * Writes every beam of a posed engineer with work into `out[0..n)`, reusing its objects, and returns n.
 * `work` names a posed unit, else a feature (scrap being reclaimed). No beam when it names neither.
 */
export function workBeams(poses: PoseTable, features: readonly Feature[], terrain: Terrain, out: WorkBeam[]): number {
  let n = 0;
  for (let i = 0; i < poses.count; i++) {
    const p = poses.poses[i]!;
    if (p.unit.kind !== "engineer" || p.unit.work === 0) continue;
    const target = poseById(poses, p.unit.work);
    if (target) {
      beamToUnit(p, target, slot(out, n++));
      continue;
    }
    const scrap = featureById(features, p.unit.work);
    if (scrap) beamToScrap(p, scrap, terrain, slot(out, n++));
  }
  return n;
}

function slot(out: WorkBeam[], i: number): WorkBeam {
  let b = out[i];
  if (!b) {
    b = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0 };
    out.push(b);
  }
  return b;
}

function beamToUnit(e: UnitPose, t: UnitPose, b: WorkBeam): void {
  fromEmitter(e, b);
  b.bx = t.x;
  b.by = t.y;
  b.bz = t.z + UNIT_STATS[t.unit.kind].height * TARGET_HEIGHT;
}

function beamToScrap(e: UnitPose, f: Feature, terrain: Terrain, b: WorkBeam): void {
  fromEmitter(e, b);
  b.bx = f.x;
  b.by = f.y;
  b.bz = heightAt(terrain, f.x, f.y) + (f.unit ? UNIT_STATS[f.unit].height * SCRAP_HEIGHT : 0);
}

function fromEmitter(e: UnitPose, b: WorkBeam): void {
  b.ax = e.x + Math.cos(e.yaw) * ENGINEER_EMITTER.x;
  b.ay = e.y + Math.sin(e.yaw) * ENGINEER_EMITTER.x;
  b.az = e.z + ENGINEER_EMITTER.z;
}
