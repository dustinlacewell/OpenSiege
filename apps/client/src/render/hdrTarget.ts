const SAMPLES = 4;

/** The scene as it stood at the last `grab`: resolved colour (linear filtered) and depth (0..1, nearest). */
export interface SceneGrab {
  readonly color: WebGLTexture;
  readonly depth: WebGLTexture;
}

/** The off-screen scene target: multisampled linear HDR colour and depth, resolved into a texture. */
export class HdrTarget {
  private readonly msaa: WebGLFramebuffer;
  private readonly resolved: WebGLFramebuffer;
  private readonly grabbed: WebGLFramebuffer;
  private readonly format: number;
  private readonly samples: number;
  private color: WebGLRenderbuffer | null = null;
  private depth: WebGLRenderbuffer | null = null;
  private tex: WebGLTexture | null = null;
  private grabbedTextures: SceneGrab | null = null;
  private width = 0;
  private height = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.format = gl.getExtension("EXT_color_buffer_float") ? gl.RGBA16F : gl.RGBA8;
    const supported = gl.getInternalformatParameter(gl.RENDERBUFFER, this.format, gl.SAMPLES) as Int32Array | null;
    this.samples = Math.min(SAMPLES, supported?.[0] ?? 0);
    this.msaa = gl.createFramebuffer();
    this.resolved = gl.createFramebuffer();
    this.grabbed = gl.createFramebuffer();
  }

  /** The resolved image of the last `resolve`. */
  get texture(): WebGLTexture {
    return this.tex!;
  }

  /**
   * Mid-frame copy of what is drawn so far: the samples resolved into the grab colour, one sample's depth into the
   * grab depth. Then the multisampled target is bound again, so drawing goes on into it.
   */
  grab(): SceneGrab {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.grabbed);
    const bits = gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT;
    gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, bits, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa);
    return this.grabbedTextures!;
  }

  /** Binds the target at the given size and clears it. */
  begin(width: number, height: number): void {
    const gl = this.gl;
    if (width !== this.width || height !== this.height) this.allocate(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa);
    gl.viewport(0, 0, width, height);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Averages the samples into `texture`. Leaves the default framebuffer bound. */
  resolve(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolved);
    gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private allocate(width: number, height: number): void {
    const gl = this.gl;
    this.release();
    this.width = width;
    this.height = height;
    this.color = renderbuffer(gl, this.samples, this.format, width, height);
    this.depth = renderbuffer(gl, this.samples, gl.DEPTH_COMPONENT24, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.color);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    this.tex = targetTexture(gl, this.format, width, height, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolved);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    this.grabbedTextures = {
      color: targetTexture(gl, this.format, width, height, gl.LINEAR),
      depth: targetTexture(gl, gl.DEPTH_COMPONENT24, width, height, gl.NEAREST),
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.grabbed);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.grabbedTextures.color, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.grabbedTextures.depth, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private release(): void {
    const gl = this.gl;
    if (this.color) gl.deleteRenderbuffer(this.color);
    if (this.depth) gl.deleteRenderbuffer(this.depth);
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.grabbedTextures) {
      gl.deleteTexture(this.grabbedTextures.color);
      gl.deleteTexture(this.grabbedTextures.depth);
    }
  }
}

function renderbuffer(gl: WebGL2RenderingContext, samples: number, format: number, w: number, h: number): WebGLRenderbuffer {
  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, w, h);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  return rb;
}

/** One level of `format`, clamped at the edge. Depth formats must use NEAREST. */
function targetTexture(gl: WebGL2RenderingContext, format: number, w: number, h: number, filter: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}
