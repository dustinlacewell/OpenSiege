import { mapHeight, mapWidth, type Terrain } from "@mf/sim";
import { RippleSources } from "../game/rippleSources.ts";
import type { Frame } from "./frame.ts";
import { GroundWatch } from "./groundWatch.ts";
import { RippleField } from "./rippleField.ts";
import { rippleGrid } from "./rippleGrid.ts";
import { RipplePrograms, STEP_HZ } from "./ripplePrograms.ts";
import { StepClock } from "./stepClock.ts";

/** Texture unit the water shader reads the ripple texture from. */
export const RIPPLE_UNIT = 7;

/** Most fixed steps per frame. */
const MAX_STEPS = 4;

/**
 * Wakes and splashes on the water: a wave-equation height field on the GPU over the map.
 * The texture covers the map rectangle: uv = world xy / map size. RGBA16F.
 * R: surface offset in world units. G, B: its slope d/dx and d/dy (world units per world unit). A: foam 0..1.
 * Without EXT_color_buffer_float the texture stays null and `update` does nothing.
 */
export class RipplePass {
  private readonly programs: RipplePrograms | null;
  private readonly sources = new RippleSources();
  private readonly ground = new GroundWatch();
  private readonly clock = new StepClock(STEP_HZ, MAX_STEPS);
  private field: RippleField | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.programs = gl.getExtension("EXT_color_buffer_float") ? new RipplePrograms(gl, RIPPLE_UNIT) : null;
  }

  /** The current ripple field. Null until the first `update`, and always without float render targets. */
  get texture(): WebGLTexture | null {
    return this.field?.output.texture ?? null;
  }

  /** Steps the field for this frame: injects wakes and splashes from `f`, then runs the wave step. Leaves no framebuffer bound. */
  update(f: Frame, terrain: Terrain): void {
    const programs = this.programs;
    if (!programs) return;
    const field = this.useTerrain(terrain);
    const tick = this.clock.advance(f.time);
    programs.resetSplats();
    this.sources.collect(f.world, f.prev, f.alpha, tick.dt, f.vision, programs);
    if (!field.hasWater || (programs.pending === 0 && tick.steps === 0)) return;
    if (programs.pending > 0) programs.drawSplats(field, mapWidth(terrain), mapHeight(terrain));
    for (let i = 0; i < tick.steps; i++) programs.step(field, terrain.cell);
    programs.output(field);
    this.finish(field);
  }

  /** A new Terrain object rebuilds the field; heights changed in place re-upload the ground only. */
  private useTerrain(terrain: Terrain): RippleField {
    const change = this.ground.check(terrain);
    if (change === "new" || !this.field) {
      this.field?.dispose();
      const max = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
      this.field = new RippleField(this.gl, rippleGrid(mapWidth(terrain), mapHeight(terrain), max), terrain);
    } else if (change === "changed") {
      this.field.uploadGround(terrain);
    }
    return this.field;
  }

  /** No framebuffer bound, viewport back on the drawing buffer, the output on RIPPLE_UNIT. */
  private finish(field: RippleField): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.activeTexture(gl.TEXTURE0 + RIPPLE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, field.output.texture);
    gl.activeTexture(gl.TEXTURE0);
  }
}
