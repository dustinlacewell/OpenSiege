import type { World } from "@mf/sim";
import type { ReclaimArea } from "../game/areaReclaim.ts";
import type { Camera } from "../game/camera.ts";
import type { Curve } from "../game/curve.ts";
import type { GroundBox } from "../game/groundBox.ts";
import type { LightPool } from "../game/lights.ts";
import type { ParticlePool } from "../game/particles.ts";
import type { GuideView } from "../game/tutorial/types.ts";
import type { PrevPose, PrevShot } from "../game/interp.ts";
import type { Vision } from "../game/vision.ts";

/** Everything one rendered frame reads. Built once and mutated each frame. */
export interface Frame {
  world: World;
  prev: ReadonlyMap<number, PrevPose>;
  prevShots: ReadonlyMap<number, PrevShot>;
  alpha: number;
  me: number;
  selected: ReadonlySet<number>;
  /** The right-drag curve move being drawn, or null. */
  curve: Curve | null;
  /** The right-drag area reclaim being drawn, or null. */
  area: ReclaimArea | null;
  /** Guard mode: the unit a left click would guard, or 0. */
  guardHover: number;
  /** The selection box being dragged on the ground, or null. */
  box: GroundBox | null;
  /** Units inside `box`. */
  boxPreview: ReadonlySet<number>;
  cam: Camera;
  dpr: number;
  particles: ParticlePool;
  /** Flashes and beams that light the scene. The renderer adds this frame's held lights. */
  lights: LightPool;
  /** The local player's fog of war. Passes hide what it does not show and draw its radar contacts. */
  vision: Vision;
  /** Seconds, for shader animation. */
  time: number;
  /** What the tutorial points at this frame, or null (no tutorial, or no match yet). */
  guide: GuideView | null;
}
