import { PROJ_FP, UNIT_STATS, type Projectile } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { shotAt, type PrevShot, type WorldPoint } from "../game/interp.ts";
import type { Vision } from "../game/vision.ts";
import { BillboardBatch, HOT, SOFT, type BillboardProgram } from "./billboards.ts";

interface ShellLook {
  size: number;
  rgb: readonly [number, number, number];
}

/** Shell look by the source's weapon kind. */
const BALLISTIC: ShellLook = { size: 22, rgb: [1.0, 0.55, 0.15] };
const DIRECT: ShellLook = { size: 10, rgb: [1.0, 0.9, 0.35] };
const TRAIL_POINTS = 7;
/** Fraction of one tick of travel between trail points. */
const TRAIL_STEP = 0.16;
/** Wide faint halo around the shell, relative to its size. */
const HALO = 2.6;

/** Shells in flight as bright glows with a halo and a fading trail. One instanced draw. */
export class ProjectilesPass {
  private readonly batch: BillboardBatch;
  private readonly at: WorldPoint = { x: 0, y: 0, z: 0 };

  constructor(gl: WebGL2RenderingContext, quad: WebGLBuffer, shader: BillboardProgram) {
    this.batch = new BillboardBatch(gl, quad, shader);
  }

  /** Own shells always; enemy shells only where the local player sees. */
  draw(shots: readonly Projectile[], prev: ReadonlyMap<number, PrevShot>, alpha: number, cam: Camera, vision: Vision): void {
    this.batch.reset();
    for (const s of shots) this.pushShot(s, prev.get(s.id), alpha, vision);
    this.batch.draw(cam);
  }

  private pushShot(s: Projectile, p: PrevShot | undefined, alpha: number, vision: Vision): void {
    const look = UNIT_STATS[s.source].weapon === "ballistic" ? BALLISTIC : DIRECT;
    const { x, y, z } = shotAt(this.at, s, p, alpha);
    if (!vision.showsAt(s.owner, x, y)) return;
    const r = look.rgb[0], g = look.rgb[1], b = look.rgb[2];
    this.batch.push(x, y, z, look.size * HALO, r, g * 0.8, b * 0.5, 0.18, SOFT);
    this.batch.push(x, y, z, look.size, r, g, b, 1, HOT);
    for (let k = 1; k <= TRAIL_POINTS; k++) {
      const back = (k * TRAIL_STEP) / PROJ_FP;
      const fade = 1 - k / (TRAIL_POINTS + 1);
      this.batch.push(x - s.vx * back, y - s.vy * back, z - s.vz * back, look.size * (0.4 + 0.5 * fade), r, g * 0.85, b * 0.6, fade * 0.55, SOFT);
    }
  }
}
