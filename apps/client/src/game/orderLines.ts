import { heightAt, UNIT_STATS, type Feature, type Order, type Terrain, type Unit } from "@mf/sim";
import { arc } from "./arcLines.ts";
import { drape, ring, square, type LineSink, type LineStyle } from "./groundLines.ts";
import { featureById } from "./lookup.ts";
import { poseById, type PoseTable, type UnitPose } from "./poses.ts";
import { isScrap } from "./scrapPick.ts";

export interface OrderView {
  me: number;
  selected: ReadonlySet<number>;
  terrain: Terrain;
  /** World features, sorted by id. Reclaim orders end at a scrap here. */
  features: readonly Feature[];
}

const ATTACK: LineStyle = { r: 1.0, g: 0.36, b: 0.28, a: 0.3, widthPx: 1.5 };
const ATTACK_SELECTED: LineStyle = { ...ATTACK, a: 0.9, widthPx: 2 };
const MOVE: LineStyle = { r: 0.45, g: 1.0, b: 0.5, a: 0.26, widthPx: 1.5 };
const MOVE_SELECTED: LineStyle = { ...MOVE, a: 0.85, widthPx: 2 };
/** Attack-move: orange, between move green and attack red. */
const ATTACK_MOVE: LineStyle = { r: 1.0, g: 0.6, b: 0.18, a: 0.3, widthPx: 1.5 };
const ATTACK_MOVE_SELECTED: LineStyle = { ...ATTACK_MOVE, a: 0.9, widthPx: 2 };
const SIEGE: LineStyle = { r: 0.45, g: 0.85, b: 1.0, a: 0.9, widthPx: 2 };
const RALLY: LineStyle = { r: 1.0, g: 0.84, b: 0.32, a: 0.85, widthPx: 2 };
const GUARD: LineStyle = { r: 0.82, g: 0.55, b: 1.0, a: 0.4, widthPx: 1.5 };
const GUARD_SELECTED: LineStyle = { ...GUARD, a: 0.9, widthPx: 2 };
/** Reclaim: lime, near the work beam's green. */
const RECLAIM: LineStyle = { r: 0.75, g: 1.0, b: 0.3, a: 0.3, widthPx: 1.5 };
export const RECLAIM_SELECTED: LineStyle = { ...RECLAIM, a: 0.9, widthPx: 2 };
/** Guard arc height above its chord: a base plus a share of its length, capped. */
const ARC_BASE = 30;
const ARC_PER_LEN = 0.25;
const ARC_MAX = 400;

const FAR_FADE = 0.15;
const LEG_FADE = 0.6;
const RALLY_FADE = 0.6;
const FLAG_HEIGHT = 70;
const FLAG_LENGTH = 34;
const FLAG_DROP = 22;
const MARK_RADIUS = 24;
const MARK_SEGMENTS = 12;
const WAYPOINT_RADIUS = 7;
const WAYPOINT_SEGMENTS = 8;
const SIEGE_HALF = 11;

/** Selected own units show their whole order queue and rally point; other own units show their first leg, faint. */
export function buildOrderLines(sink: LineSink, poses: PoseTable, view: OrderView): void {
  for (let i = 0; i < poses.count; i++) {
    const p = poses.poses[i]!;
    if (p.unit.owner !== view.me) continue;
    if (!view.selected.has(p.unit.id)) {
      firstLeg(sink, poses, p, view);
      continue;
    }
    orderChain(sink, poses, p, view);
    if (p.unit.rally) rallyMark(sink, p, p.unit.rally.x, p.unit.rally.y, view.terrain);
  }
}

/** A guard head shows its arc; then the weapon, move or reclaim line as usual. */
function firstLeg(sink: LineSink, poses: PoseTable, p: UnitPose, view: OrderView): void {
  const t = view.terrain;
  const head = p.unit.orders[0];
  const guarded = head?.type === "guard" ? poseById(poses, head.target) : undefined;
  if (guarded) guardArc(sink, p.x, p.y, top(p), guarded, GUARD, LEG_FADE);
  const id = attackTarget(p.unit);
  if (id !== 0) {
    const target = poseById(poses, id);
    if (target) drape(sink, t, p.x, p.y, target.x, target.y, ATTACK, FAR_FADE);
    return;
  }
  const o = p.unit.orders[0];
  if (o?.type === "move") drape(sink, t, p.x, p.y, o.x, o.y, o.attack ? ATTACK_MOVE : MOVE, FAR_FADE);
  else if (o?.type === "reclaim") reclaimLeg(sink, t, p.x, p.y, scrapOf(view, o.target), RECLAIM, FAR_FADE);
}

/**
 * Unit → each queued order in turn. An attack-move leg and waypoint are orange. A guard is an arc in the air to the guarded unit.
 * A reclaim is a ground line to the scrap and a ring round it. A siege marks where it will happen: the last move point before it, or the unit.
 */
function orderChain(sink: LineSink, poses: PoseTable, p: UnitPose, view: OrderView): void {
  const t = view.terrain;
  const orders = p.unit.orders;
  if (targetOf(orders[0]) === 0) weaponLine(sink, poses, p, t);
  let fromX = p.x, fromY = p.y, fromZ = top(p);
  let stopX = p.x, stopY = p.y;
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i]!;
    if (o.type === "move") {
      const style = o.attack ? ATTACK_MOVE_SELECTED : MOVE_SELECTED;
      drape(sink, t, fromX, fromY, o.x, o.y, style, LEG_FADE);
      ring(sink, t, o.x, o.y, WAYPOINT_RADIUS, WAYPOINT_SEGMENTS, style, 1);
      fromX = stopX = o.x;
      fromY = stopY = o.y;
      fromZ = heightAt(t, o.x, o.y);
    } else if (o.type === "attack" || o.type === "engage") {
      const target = poseById(poses, o.target);
      if (!target) continue;
      drape(sink, t, fromX, fromY, target.x, target.y, ATTACK_SELECTED, LEG_FADE);
      fromX = target.x;
      fromY = target.y;
      fromZ = target.z;
    } else if (o.type === "guard") {
      const target = poseById(poses, o.target);
      if (!target) continue;
      guardArc(sink, fromX, fromY, fromZ, target, GUARD_SELECTED, LEG_FADE);
      fromX = target.x;
      fromY = target.y;
      fromZ = top(target);
    } else if (o.type === "reclaim") {
      const scrap = scrapOf(view, o.target);
      if (!scrap) continue;
      reclaimLeg(sink, t, fromX, fromY, scrap, RECLAIM_SELECTED, LEG_FADE);
      fromX = stopX = scrap.x;
      fromY = stopY = scrap.y;
      fromZ = heightAt(t, scrap.x, scrap.y);
    } else {
      square(sink, t, stopX, stopY, SIEGE_HALF, SIEGE, 1);
    }
  }
}

/** The target the weapon picked on its own, when no attack order is running. */
function weaponLine(sink: LineSink, poses: PoseTable, p: UnitPose, t: Terrain): void {
  if (p.unit.target === 0) return;
  const target = poseById(poses, p.unit.target);
  if (target) drape(sink, t, p.x, p.y, target.x, target.y, ATTACK_SELECTED, FAR_FADE);
}

/** An arc in the air from a point to the top of the guarded unit. */
function guardArc(sink: LineSink, x: number, y: number, z: number, target: UnitPose, style: LineStyle, fadeEnd: number): void {
  const len = Math.hypot(target.x - x, target.y - y);
  const rise = Math.min(ARC_MAX, ARC_BASE + len * ARC_PER_LEN);
  arc(sink, x, y, z, target.x, target.y, top(target), rise, style, fadeEnd);
}

/** A ground line from a point to the scrap and a ring round it. Nothing when the scrap is gone. */
function reclaimLeg(sink: LineSink, t: Terrain, x: number, y: number, scrap: Feature | undefined, style: LineStyle, fadeEnd: number): void {
  if (!scrap) return;
  drape(sink, t, x, y, scrap.x, scrap.y, style, fadeEnd);
  ring(sink, t, scrap.x, scrap.y, scrap.radius, MARK_SEGMENTS, style, 1);
}

/** The feature a reclaim names, while it is still scrap. */
function scrapOf(view: OrderView, id: number): Feature | undefined {
  const f = featureById(view.features, id);
  return f && isScrap(f) ? f : undefined;
}

/** The top of a unit's model at its pose. */
function top(p: UnitPose): number {
  return p.z + UNIT_STATS[p.unit.kind].height;
}

function attackTarget(u: Unit): number {
  return targetOf(u.orders[0]) || u.target;
}

/** The enemy an attack or engage order names; 0 for any other order. An engage's x, y is an anchor, not drawn. */
function targetOf(o: Order | undefined): number {
  return o?.type === "attack" || o?.type === "engage" ? o.target : 0;
}

/** The line to the rally point, a ground circle there, and a pennant on a pole pointing away from the factory. */
function rallyMark(sink: LineSink, p: UnitPose, x: number, y: number, t: Terrain): void {
  drape(sink, t, p.x, p.y, x, y, RALLY, RALLY_FADE);
  ring(sink, t, x, y, MARK_RADIUS, MARK_SEGMENTS, RALLY, RALLY_FADE);
  const len = Math.hypot(x - p.x, y - p.y) || 1;
  const dx = ((x - p.x) / len) * FLAG_LENGTH;
  const dy = ((y - p.y) / len) * FLAG_LENGTH;
  const z = heightAt(t, x, y);
  const top = z + FLAG_HEIGHT;
  const tipZ = top - FLAG_DROP / 2;
  sink.segment(x, y, z, x, y, top, RALLY, RALLY_FADE, RALLY_FADE);
  sink.segment(x, y, top, x + dx, y + dy, tipZ, RALLY, RALLY_FADE, RALLY_FADE);
  sink.segment(x + dx, y + dy, tipZ, x, y, top - FLAG_DROP, RALLY, RALLY_FADE, RALLY_FADE);
}
