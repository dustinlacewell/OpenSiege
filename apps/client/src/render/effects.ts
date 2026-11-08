import type { Camera } from "../game/camera.ts";
import { RING, SPARK, type Particle, type ParticlePool } from "../game/particles.ts";
import type { Vision } from "../game/vision.ts";
import { BillboardBatch, FLAT_RING, HOT, SOFT, type BillboardProgram } from "./billboards.ts";

/** Explosions, rings, sparks and muzzle flashes. One instanced additive draw. */
export class EffectsPass {
  private readonly batch: BillboardBatch;

  constructor(gl: WebGL2RenderingContext, quad: WebGLBuffer, shader: BillboardProgram) {
    this.batch = new BillboardBatch(gl, quad, shader);
  }

  /** Only particles where the local player sees. */
  draw(pool: ParticlePool, cam: Camera, vision: Vision): void {
    this.batch.reset();
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[i]!;
      if (vision.sees(p.x, p.y)) this.push(p);
    }
    this.batch.draw(cam);
  }

  /** Rings grow and fade; sparks keep their size and fade; glows swell a little and fade fast. */
  private push(p: Particle): void {
    const t = p.age / p.life;
    const fade = 1 - t;
    if (p.kind === RING) {
      this.batch.push(p.x, p.y, p.z, p.size * (0.2 + 0.8 * Math.sqrt(t)), p.r, p.g, p.b, fade, FLAT_RING);
    } else if (p.kind === SPARK) {
      this.batch.push(p.x, p.y, p.z, p.size, p.r, p.g, p.b, fade, HOT);
    } else {
      this.batch.push(p.x, p.y, p.z, p.size * (1 + 0.5 * t), p.r, p.g, p.b, fade * fade, SOFT);
    }
  }
}
