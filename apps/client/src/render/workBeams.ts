import type { Feature, Terrain } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import type { LightPool } from "../game/lights.ts";
import type { PoseTable } from "../game/poses.ts";
import { BillboardBatch, HOT, SOFT, type BillboardProgram } from "./billboards.ts";
import { workBeams, type WorkBeam } from "./workBeamGeometry.ts";

/** World units between glow points along the beam. */
const SPACING = 4;
const CORE: readonly [number, number, number] = [0.5, 1.0, 0.6];
const HALO: readonly [number, number, number] = [0.15, 0.95, 0.35];
const CORE_SIZE = 4.5;
const HALO_SIZE = 15;
/** Bright blobs that run from the emitter to the target, and how fast (beam lengths per second). */
const PULSES = 4;
const PULSE_SPEED = 2.2;
/** The green light a beam casts along its length. */
const LIGHT_RADIUS = 140;
const LIGHT_RADIANCE = 3;

/**
 * The engineer's work beam: a green laser from its mast light to the unit or scrap it works on, and the light it casts.
 * One instanced draw.
 */
export class WorkBeamsPass {
  private readonly batch: BillboardBatch;
  private readonly beams: WorkBeam[] = [];
  private beamCount = 0;
  private readonly lightRgb = [0, 0, 0];

  constructor(gl: WebGL2RenderingContext, quad: WebGLBuffer, shader: BillboardProgram) {
    this.batch = new BillboardBatch(gl, quad, shader);
  }

  /**
   * Finds this frame's beams and holds their lights. Call after `lights.beginFrame` and before the lights are packed.
   * `poses` holds only units the local player sees, so a beam to a unit shows only when both ends are seen.
   * `features` are not filtered by vision, so a beam to scrap shows when the engineer is seen.
   */
  prepare(poses: PoseTable, features: readonly Feature[], terrain: Terrain, lights: LightPool, time: number): void {
    this.beamCount = workBeams(poses, features, terrain, this.beams);
    const s = LIGHT_RADIANCE * (1 + 0.15 * Math.sin(time * 45));
    const rgb = this.lightRgb;
    for (let c = 0; c < 3; c++) rgb[c] = HALO[c]! * s;
    for (let i = 0; i < this.beamCount; i++) {
      const b = this.beams[i]!;
      lights.hold(b.ax, b.ay, b.az, b.bx, b.by, b.bz, LIGHT_RADIUS, rgb);
    }
  }

  /** The beams found by the last `prepare`. */
  draw(cam: Camera, time: number): void {
    this.batch.reset();
    for (let i = 0; i < this.beamCount; i++) this.beam(this.beams[i]!, time);
    this.batch.draw(cam);
  }

  private beam({ ax, ay, az, bx, by, bz }: WorkBeam, time: number): void {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / SPACING));
    for (let k = 0; k <= n; k++) this.segment(ax, ay, az, bx, by, bz, k / n, time);
    this.pulses(ax, ay, az, bx, by, bz, time);
    this.ends(ax, ay, az, bx, by, bz, time);
  }

  private segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, u: number, time: number): void {
    const flicker = 1 + 0.15 * Math.sin(time * 45 + u * 40);
    const x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = az + (bz - az) * u;
    this.batch.push(x, y, z, HALO_SIZE * flicker, HALO[0], HALO[1], HALO[2], 0.2, SOFT);
    this.batch.push(x, y, z, CORE_SIZE * flicker, CORE[0], CORE[1], CORE[2], 0.9, HOT);
  }

  private pulses(ax: number, ay: number, az: number, bx: number, by: number, bz: number, time: number): void {
    for (let k = 0; k < PULSES; k++) {
      const u = (time * PULSE_SPEED + k / PULSES) % 1;
      const x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = az + (bz - az) * u;
      this.batch.push(x, y, z, HALO_SIZE * 1.1, CORE[0], CORE[1], CORE[2], 0.7, HOT);
    }
  }

  /** A flare at the emitter and a hotter, flickering glow where the beam lands. */
  private ends(ax: number, ay: number, az: number, bx: number, by: number, bz: number, time: number): void {
    const pulse = 1 + 0.3 * Math.sin(time * 30);
    this.batch.push(ax, ay, az, 20, HALO[0], HALO[1], HALO[2], 0.8, SOFT);
    this.batch.push(ax, ay, az, 8, CORE[0], CORE[1], CORE[2], 1, HOT);
    this.batch.push(bx, by, bz, 38 * pulse, HALO[0], HALO[1], HALO[2], 0.6, SOFT);
    this.batch.push(bx, by, bz, 14 * pulse, CORE[0], CORE[1], CORE[2], 1, HOT);
  }
}
