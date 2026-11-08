import { heightAt, type Terrain } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import type { Spot } from "../game/radarSpot.ts";
import type { Vision } from "../game/vision.ts";
import { BillboardBatch, FLAT_GLOW, type BillboardProgram } from "./billboards.ts";
import type { TeamColors } from "./teamColors.ts";

/** Radius of a radar dot on the ground, world units. */
const SIZE = 90;
/** Lift above the highest ground under the dot, so slopes do not cut it. */
const LIFT = 10;
/** Pulse speed, radians per second. */
const PULSE = 2.4;

/** Radar contacts as soft team-coloured glows on the ground, at their drifting radar spot. One additive draw. */
export class RadarPass {
  private readonly batch: BillboardBatch;
  private readonly spot: Spot = { x: 0, y: 0 };

  constructor(gl: WebGL2RenderingContext, quad: WebGLBuffer, shader: BillboardProgram) {
    this.batch = new BillboardBatch(gl, quad, shader);
  }

  draw(vision: Vision, terrain: Terrain, teams: TeamColors, cam: Camera, time: number): void {
    this.batch.reset();
    for (const u of vision.radarContacts()) {
      const s = vision.radarSpot(u, this.spot);
      const rgb = teams.of(u.owner);
      const pulse = 0.65 + 0.35 * Math.sin(time * PULSE + u.id * 1.7);
      this.batch.push(s.x, s.y, groundUnder(terrain, s.x, s.y) + LIFT, SIZE, rgb[0]!, rgb[1]!, rgb[2]!, 0.45 * pulse, FLAT_GLOW);
    }
    this.batch.draw(cam);
  }
}

/** The highest ground at the centre and four rim points of the dot. */
function groundUnder(terrain: Terrain, x: number, y: number): number {
  return Math.max(
    heightAt(terrain, x, y),
    heightAt(terrain, x + SIZE, y), heightAt(terrain, x - SIZE, y),
    heightAt(terrain, x, y + SIZE), heightAt(terrain, x, y - SIZE),
  );
}
