import { heightAt, UNIT_STATS, weaponOf, type Feature, type Terrain } from "@mf/sim";
import { scrapsInCircle, type ReclaimArea } from "../game/areaReclaim.ts";
import type { Curve } from "../game/curve.ts";
import { brackets, drape, ring, type LineStyle } from "../game/groundLines.ts";
import { groundBoxCorners, type GroundBox } from "../game/groundBox.ts";
import {
  arrowSegs, gestureAt, gestureRadius, gestureSlots, gestureTaken, guideRings, pulse, UNIT_PULSE_PERIOD, ZONE_PULSE_PERIOD, type GestureState, type GuideRing, type PlayerDrag, type Seg,
} from "../game/guideMarks.ts";
import { buildOrderLines, RECLAIM_SELECTED, type OrderView } from "../game/orderLines.ts";
import { poseById, type PoseTable, type UnitPose } from "../game/poses.ts";
import type { Gesture, GuideView } from "../game/tutorial/types.ts";
import type { Frame } from "./frame.ts";
import { decal, overlay } from "./glState.ts";
import { LineBatch } from "./lines.ts";
import { MarksBatch, MarksProgram, type Rgba } from "./marks.ts";
import { rangeCircle } from "./rangeLines.ts";

const SELECT_RGBA: Rgba = [0.55, 1.0, 0.6, 0.95];
/** Weapon range while sieged: orange, dashed. */
const SIEGE_RANGE: LineStyle = { r: 1.0, g: 0.55, b: 0.35, a: 0.8, widthPx: 1.5 };
/** Weapon range while mobile: pale yellow, solid. */
const MOBILE_RANGE: LineStyle = { r: 1.0, g: 0.9, b: 0.5, a: 0.6, widthPx: 1.5 };
const RANGE_SEGMENTS = 96;
/** The dug-in footing under a sieged unit: orange corner brackets, fading in with the siege. */
const FOOTING: LineStyle = { r: 1.0, g: 0.6, b: 0.25, a: 0.95, widthPx: 3 };
/** Footing half-width and arm length, as shares of the unit's radius. Wide enough to clear the hull and the planted legs of the big kinds. */
const FOOTING_HALF = 1.25;
const FOOTING_ARM = 0.5;
const WORK: LineStyle = { r: 0.45, g: 0.85, b: 1.0, a: 0.8, widthPx: 1.5 };
/** Radar range of a kind whose siege extends it: teal. */
const RADAR: LineStyle = { r: 0.4, g: 1.0, b: 0.8, a: 0.6, widthPx: 1.5 };
/** Jam range: the jammer's violet. */
const JAM: LineStyle = { r: 0.7, g: 0.45, b: 1.0, a: 0.7, widthPx: 1.5 };
const BUILD_RGBA: Rgba = [0.95, 0.85, 0.35, 1.0];
const CURVE: LineStyle = { r: 0.55, g: 1.0, b: 0.6, a: 0.8, widthPx: 2 };
/** The selection box outline: the curve's green. */
const BOX: LineStyle = { r: 0.55, g: 1.0, b: 0.6, a: 0.9, widthPx: 1.5 };
const CURVE_RGBA: Rgba = [0.55, 1.0, 0.6, 0.95];
/** Guard-mode hover ring: the guard arc's violet, wider than the selection ring. */
const HOVER_RGBA: Rgba = [0.82, 0.55, 1.0, 0.95];
const HOVER_SCALE = 1.6;
/** The area reclaim circle and its wreck rings: the reclaim lines' lime. */
const AREA = RECLAIM_SELECTED;
const AREA_RGBA: Rgba = [AREA.r, AREA.g, AREA.b, AREA.a];
const AREA_SEGMENTS = 96;
/** An included wreck's ring, as a share of its radius. */
const AREA_WRECK_SCALE = 1.2;
/** World radius of a curve move's spot marker. */
const SPOT_RADIUS = 14;
/** Tutorial highlights: gold. Unit rings pulse in thickness and alpha; zone circles pulse in alpha. */
const GUIDE: LineStyle = { r: 1.0, g: 0.8, b: 0.3, a: 0.9, widthPx: 2.5 };
const GUIDE_SEGMENTS = 96;
const GUIDE_THICK_PX = 2;
const GUIDE_THICK_PULSE_PX = 2;
const GUIDE_ALPHA = 0.55;
const GUIDE_ZONE_FADE = 0.45;
/** The bobbing arrow over a focused unit or zone: the guide's gold, thick. */
const ARROW: LineStyle = { r: 1.0, g: 0.8, b: 0.3, a: 1, widthPx: 5 };
/** The acted-out drag: the right-drag curve's green, so it matches what the player will see. World radii. */
const GESTURE: LineStyle = { r: 0.55, g: 1.0, b: 0.6, a: 0.95, widthPx: 3 };
const GESTURE_DOT = 30;
const GESTURE_CURSOR = 45;
const GESTURE_SLOT = 60;
const GESTURE_SLOTS = 3;
const GESTURE_DOT_SEGMENTS = 24;
/** Ground marks sit in the HDR scene; this brings them to their nominal colour after tone mapping. */
const GROUND_GAIN = 2.4;
const BAR_PX = 5;
const BAR_GAP_PX = 3;
const ABOVE = 14;

/**
 * Ground marks (selection rings, the guard-mode hover ring, range circles, order lines, guard arcs, tutorial highlights) draw into the scene under the units.
 * Health and build bars face the screen above the units, drawn last on the final image.
 */
export class OverlayPass {
  private readonly ground: MarksBatch;
  private readonly screen: MarksBatch;
  private readonly lines: LineBatch;
  private readonly view: OrderView = { me: -1, selected: new Set(), terrain: null!, features: [] };
  private readonly hpRgba: [number, number, number, number] = [0, 0, 0, 1];
  private readonly guideRgba: [number, number, number, number] = [GUIDE.r, GUIDE.g, GUIDE.b, GUIDE.a];
  private readonly guideRings: GuideRing[] = [];
  private readonly arrow: Seg[] = [];
  private readonly gesture: GestureState = { x: 0, y: 0, t: 0, alpha: 1, done: false };
  private readonly gestureStyle: LineStyle = { ...GESTURE };
  private poses: PoseTable = null!;
  private readonly findPose = (id: number): UnitPose | undefined => poseById(this.poses, id);

  constructor(private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer) {
    const marks = new MarksProgram(gl);
    this.ground = new MarksBatch(gl, quad, marks, GROUND_GAIN);
    this.screen = new MarksBatch(gl, quad, marks);
    this.lines = new LineBatch(gl, quad);
  }

  drawGround(frame: Frame, poses: PoseTable): void {
    this.ground.reset();
    this.lines.reset();
    for (let i = 0; i < poses.count; i++) {
      const p = poses.poses[i]!;
      if (frame.selected.has(p.unit.id)) this.pushSelected(p, frame.world.terrain, frame.me);
      else if (frame.boxPreview.has(p.unit.id)) this.pushSelectRing(p);
      if (p.unit.id === frame.guardHover) this.pushGuardHover(p);
      if (p.siege > 0) this.pushFooting(p, frame.world.terrain);
    }
    this.view.me = frame.me;
    this.view.selected = frame.selected;
    this.view.terrain = frame.world.terrain;
    this.view.features = frame.world.features;
    buildOrderLines(this.lines, poses, this.view);
    if (frame.curve) this.pushCurve(frame.curve, frame.world.terrain);
    if (frame.area) this.pushArea(frame.area, frame.world.features, frame.world.terrain);
    if (frame.box) this.pushBox(frame.box, frame.world.terrain);
    if (frame.guide) this.pushGuide(frame.guide, poses, frame);
    decal(this.gl);
    this.lines.draw(frame.cam, frame.dpr);
    overlay(this.gl);
    this.ground.draw(frame.cam, frame.dpr);
  }

  drawScreen(frame: Frame, poses: PoseTable): void {
    this.screen.reset();
    for (let i = 0; i < poses.count; i++) this.pushBars(frame, poses.poses[i]!);
    overlay(this.gl);
    this.screen.draw(frame.cam, frame.dpr);
  }

  private pushSelected(p: UnitPose, terrain: Terrain, me: number): void {
    const u = p.unit;
    const stats = UNIT_STATS[u.kind];
    this.pushSelectRing(p);
    if (u.owner === me) this.pushWeaponRanges(p, terrain);
    if (u.owner === me) this.pushSenseRanges(p, terrain);
    if (u.mode === "sieged" && stats.workRange > 0) rangeCircle(this.lines, terrain, p.x, p.y, stats.workRange, WORK);
  }

  /** Radar (only for a kind whose siege extends it, as in the unit panel) and jam ranges: mobile solid, sieged dashed. */
  private pushSenseRanges(p: UnitPose, terrain: Terrain): void {
    const s = UNIT_STATS[p.unit.kind];
    if (s.siegeRadar > s.radar) this.pushRangePair(p, terrain, s.radar, s.siegeRadar, RADAR);
    if (s.jam > 0 || s.siegeJam > 0) this.pushRangePair(p, terrain, s.jam, s.siegeJam, JAM);
  }

  /** A solid ring at `mobile` and a dashed one at `sieged`; the dashed one only where it differs. */
  private pushRangePair(p: UnitPose, terrain: Terrain, mobile: number, sieged: number, style: LineStyle): void {
    if (mobile > 0) ring(this.lines, terrain, p.x, p.y, mobile, RANGE_SEGMENTS, style, 1);
    if (sieged > 0 && sieged !== mobile) rangeCircle(this.lines, terrain, p.x, p.y, sieged, style);
  }

  /** The selection ring. Also marks a unit inside the box being dragged, so the release holds no surprise. */
  private pushSelectRing(p: UnitPose): void {
    this.ground.ring(p.x, p.y, p.z + 3, UNIT_STATS[p.unit.kind].radius * 1.35, 2, SELECT_RGBA);
  }

  /** Both weapon ranges of an armed kind, whatever its mode: mobile solid, sieged dashed. */
  private pushWeaponRanges(p: UnitPose, terrain: Terrain): void {
    const mobile = weaponOf({ kind: p.unit.kind, mode: "mobile" });
    const sieged = weaponOf({ kind: p.unit.kind, mode: "sieged" });
    if (mobile) ring(this.lines, terrain, p.x, p.y, mobile.range, RANGE_SEGMENTS, MOBILE_RANGE, 1);
    if (sieged) rangeCircle(this.lines, terrain, p.x, p.y, sieged.range, SIEGE_RANGE);
  }

  /** Corner brackets under a deploying, sieged or packing unit, as strong as its siege is far along. */
  private pushFooting(p: UnitPose, terrain: Terrain): void {
    const r = UNIT_STATS[p.unit.kind].radius;
    brackets(this.lines, terrain, p.x, p.y, r * FOOTING_HALF, r * FOOTING_ARM, p.yaw, FOOTING, p.siege);
  }

  /** Guard mode: a wide violet ring on the unit a click would guard. */
  private pushGuardHover(p: UnitPose): void {
    this.ground.ring(p.x, p.y, p.z + 3, UNIT_STATS[p.unit.kind].radius * HOVER_SCALE, 3, HOVER_RGBA);
  }

  /** The curve move being drawn: its path on the ground, and a small ring at each unit's spot. */
  private pushCurve(curve: Curve, terrain: Terrain): void {
    const path = curve.path;
    for (let i = 1; i < path.length; i++) drape(this.lines, terrain, path[i - 1]!.x, path[i - 1]!.y, path[i]!.x, path[i]!.y, CURVE, 1);
    for (const s of curve.spots) this.ground.ring(s.x, s.y, heightAt(terrain, s.x, s.y) + 3, SPOT_RADIUS, 2, CURVE_RGBA);
  }

  /** The area reclaim being drawn: its circle on the ground, and a ring on each wreck it holds. */
  private pushArea(area: ReclaimArea, features: readonly Feature[], terrain: Terrain): void {
    ring(this.lines, terrain, area.x, area.y, area.radius, AREA_SEGMENTS, AREA, 1);
    for (const f of scrapsInCircle(features, area.x, area.y, area.radius)) {
      this.ground.ring(f.x, f.y, heightAt(terrain, f.x, f.y) + 3, f.radius * AREA_WRECK_SCALE, 2, AREA_RGBA);
    }
  }

  /** The selection box being dragged: its four sides draped on the ground. */
  private pushBox(box: GroundBox, terrain: Terrain): void {
    const c = groundBoxCorners(box);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      drape(this.lines, terrain, c[i * 2]!, c[i * 2 + 1]!, c[j * 2]!, c[j * 2 + 1]!, BOX, 1);
    }
  }

  /**
   * Tutorial highlights: a pulsing gold ring on each pointed unit the player can see, and a pulsing gold circle on each zone.
   * `poses` holds only seen units, so a hidden unit gets no ring.
   */
  /** Gold pulsing rings on focused units and zones, a bobbing arrow over each, and the acted-out drag. */
  private pushGuide(guide: GuideView, poses: PoseTable, frame: Frame): void {
    const { time } = frame, terrain = frame.world.terrain;
    this.poses = poses;
    const n = guideRings(guide.units, this.findPose, this.guideRings);
    const u = pulse(time, UNIT_PULSE_PERIOD);
    this.guideRgba[3] = GUIDE.a * (GUIDE_ALPHA + (1 - GUIDE_ALPHA) * u);
    for (let i = 0; i < n; i++) {
      const r = this.guideRings[i]!;
      this.ground.ring(r.x, r.y, r.z + 3, r.radius, GUIDE_THICK_PX + GUIDE_THICK_PULSE_PX * u, this.guideRgba);
      const p = this.findPose(guide.units[i]!);
      this.pushArrow(r.x, r.y, r.z + (p ? UNIT_STATS[p.unit.kind].height : 0), frame);
    }
    const fade = 1 - GUIDE_ZONE_FADE * pulse(time, ZONE_PULSE_PERIOD);
    for (const z of guide.zones) {
      ring(this.lines, terrain, z.x, z.y, z.radius, GUIDE_SEGMENTS, GUIDE, fade);
      if (n === 0) this.pushArrow(z.x, z.y, heightAt(terrain, z.x, z.y), frame);
    }
    if (guide.gesture && !gestureTaken(guide.gesture, playerDrag(frame))) this.pushGesture(guide.gesture, frame.world.features, terrain, time);
  }

  private pushArrow(x: number, y: number, z: number, frame: Frame): void {
    const { cam } = frame;
    arrowSegs(x, y, z, cam.right[0]!, cam.right[1]!, cam.dist, frame.time, this.arrow);
    for (const s of this.arrow) this.lines.segment(s.ax, s.ay, s.az, s.bx, s.by, s.bz, ARROW, 1, 1);
  }

  /**
   * The drag acted out: a press ring and a cursor ring. A line grows behind the cursor, then shows the slots the units
   * would take. A circle grows to the cursor in the reclaim lime, then rings the wrecks it holds.
   */
  private pushGesture(g: Gesture, features: readonly Feature[], terrain: Terrain, time: number): void {
    const s = gestureAt(g, time, this.gesture);
    const base = g.shape === "circle" ? AREA : GESTURE;
    Object.assign(this.gestureStyle, base);
    this.gestureStyle.a = base.a * s.alpha;
    ring(this.lines, terrain, g.from.x, g.from.y, GESTURE_DOT, GESTURE_DOT_SEGMENTS, this.gestureStyle, 1);
    ring(this.lines, terrain, s.x, s.y, GESTURE_CURSOR, GESTURE_DOT_SEGMENTS, this.gestureStyle, 1);
    if (g.shape === "circle") return this.pushGestureCircle(g, s, features, terrain);
    if (s.t > 0) drape(this.lines, terrain, g.from.x, g.from.y, s.x, s.y, this.gestureStyle, 1);
    if (!s.done) return;
    for (const p of gestureSlots(g, GESTURE_SLOTS)) ring(this.lines, terrain, p.x, p.y, GESTURE_SLOT, GESTURE_DOT_SEGMENTS, this.gestureStyle, 1);
  }

  private pushGestureCircle(g: Gesture, s: GestureState, features: readonly Feature[], terrain: Terrain): void {
    const radius = gestureRadius(g, s);
    if (radius > 0) ring(this.lines, terrain, g.from.x, g.from.y, radius, AREA_SEGMENTS, this.gestureStyle, 1);
    if (!s.done) return;
    for (const f of scrapsInCircle(features, g.from.x, g.from.y, radius)) {
      ring(this.lines, terrain, f.x, f.y, f.radius * AREA_WRECK_SCALE, GESTURE_DOT_SEGMENTS, this.gestureStyle, 1);
    }
  }

  private pushBars(frame: Frame, p: UnitPose): void {
    const u = p.unit;
    const stats = UNIT_STATS[u.kind];
    const selected = frame.selected.has(u.id);
    const damaged = u.hp < stats.maxHp;
    const job = u.owner === frame.me ? u.queue[0] : undefined;
    if (!selected && !damaged && !job) return;
    const z = p.z + stats.height + ABOVE;
    const width = 18 + stats.radius * 0.25;
    const hp = u.hp / stats.maxHp;
    if (selected || damaged) this.screen.bar(p.x, p.y, z, width, BAR_PX, hp, 0, hpColor(hp, this.hpRgba));
    if (job) this.screen.bar(p.x, p.y, z, width, BAR_PX, job.progress / UNIT_STATS[job.kind].buildTicks, BAR_PX + BAR_GAP_PX, BUILD_RGBA);
  }
}

/** Green at full health, through yellow, to red. Writes into `out`. */
/** The right-drag the player is making, if any: a curve from its first stroke point, an area from its centre. */
function playerDrag(frame: Frame): PlayerDrag | null {
  const start = frame.curve?.stroke[0];
  if (start) return { shape: "line", x: start.x, y: start.y };
  if (frame.area) return { shape: "circle", x: frame.area.x, y: frame.area.y };
  return null;
}

function hpColor(f: number, out: [number, number, number, number]): Rgba {
  const t = Math.min(1, Math.max(0, f));
  out[0] = t > 0.5 ? (1 - t) * 2 : 1;
  out[1] = t > 0.5 ? 1 : t * 2;
  out[2] = 0.2;
  out[3] = 1;
  return out;
}
