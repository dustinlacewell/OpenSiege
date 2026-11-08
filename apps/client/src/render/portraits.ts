import { UNIT_KINDS, type UnitKind } from "@mf/sim";
import { mat4 } from "../game/mat4.ts";
import { HdrTarget } from "./hdrTarget.ts";
import { portraitCanvas } from "./portraitImage.ts";
import { portraitView } from "./portraitView.ts";
import type { PostPass } from "./postPass.ts";
import type { SunLight } from "./scene.ts";
import type { UnitsPass } from "./units.ts";

const SIZE = 256;
/** Dark neutral backdrop in linear HDR. After tone mapping it reads about #141b21. */
const BACKDROP = [0.038, 0.052, 0.062] as const;

/**
 * Headshots of every unit kind: the game's own model, unit shader, lighting and tone map, drawn off-screen
 * and published as blob URLs. Re-renders when the team colour changes.
 */
export class PortraitRenderer {
  private readonly hdr: HdrTarget;
  private readonly fbo: WebGLFramebuffer;
  private readonly pixels = new Uint8Array(SIZE * SIZE * 4);
  private readonly urls = new Map<UnitKind, string>();
  private readonly sun: SunLight;
  private team: readonly number[] | null = null;
  private generation = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly units: UnitsPass,
    private readonly post: PostPass,
    shadowTexture: WebGLTexture,
  ) {
    this.hdr = new HdrTarget(gl);
    this.fbo = colorTarget(gl);
    this.sun = unshadowed(shadowTexture);
  }

  /** The headshot of `kind`, or "" until it is ready. */
  url(kind: UnitKind): string {
    return this.urls.get(kind) ?? "";
  }

  /** Renders every kind in `team` colour if it changed. Call before `UnitsPass.prepare`: it reuses its instances. */
  update(team: readonly number[]): void {
    if (this.team && sameRgb(this.team, team)) return;
    this.team = [...team];
    const generation = ++this.generation;
    for (const kind of UNIT_KINDS) this.publish(kind, this.capture(kind, team), generation);
    this.restore();
  }

  /** One kind: HDR scene, tone map into the 8-bit target, read back. */
  private capture(kind: UnitKind, team: readonly number[]): HTMLCanvasElement {
    const gl = this.gl;
    const view = portraitView(kind);
    this.hdr.begin(SIZE, SIZE);
    gl.clearColor(BACKDROP[0], BACKDROP[1], BACKDROP[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pose = { x: 0, y: 0, z: 0, yaw: view.yaw, aim: view.yaw, pitch: 0, roll: 0, siege: 0, gun: 0, swing: 0 };
    this.units.drawOne(kind, pose, team, view, this.sun);
    this.hdr.resolve();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    this.post.draw(this.hdr.texture, SIZE, SIZE);
    gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    return portraitCanvas(this.pixels, SIZE);
  }

  /** Swaps in the new URL once encoded. A newer render wins over a late one. */
  private publish(kind: UnitKind, canvas: HTMLCanvasElement, generation: number): void {
    canvas.toBlob((blob) => {
      if (!blob || generation !== this.generation) return;
      const old = this.urls.get(kind);
      if (old) URL.revokeObjectURL(old);
      this.urls.set(kind, URL.createObjectURL(blob));
    }, "image/png");
  }

  /** Leaves the main frame's GL state as it was: canvas framebuffer and viewport, no program, no VAO. */
  private restore(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(null);
    gl.bindVertexArray(null);
  }
}

/** An 8-bit colour framebuffer of SIZE, the tone map's output. */
function colorTarget(gl: WebGL2RenderingContext): WebGLFramebuffer {
  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, SIZE, SIZE);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

/** A zero shadow matrix puts every point outside the map, so `sunShadow` reads 1 (fully lit). */
function unshadowed(texture: WebGLTexture): SunLight {
  return { shadowMat: mat4(), texture, texelUv: 1, texelWorld: 0 };
}

function sameRgb(a: readonly number[], b: readonly number[]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
