import { createProgram, uniform } from "./gl.ts";
import { fullscreen } from "./glState.ts";
import { FULLSCREEN_VS, type FullscreenTriangle } from "./fullscreen.ts";

const MAX_ANISOTROPY = 16;

/**
 * Renders a square tiling texture once with a fullscreen fragment shader, then gives it full mipmaps, REPEAT wrap
 * and anisotropic filtering. The shader reads its size from `u_size`. RGBA8.
 */
export function createTilingTexture(gl: WebGL2RenderingContext, tri: FullscreenTriangle, fs: string, size: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, Math.log2(size) + 1, gl.RGBA8, size, size);
  renderInto(gl, tri, tex, fs, size);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  anisotropic(gl);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function renderInto(gl: WebGL2RenderingContext, tri: FullscreenTriangle, tex: WebGLTexture, fs: string, size: number): void {
  const program = createProgram(gl, FULLSCREEN_VS, fs);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, size, size);
  fullscreen(gl);
  gl.useProgram(program);
  gl.uniform1f(uniform(gl, program, "u_size"), size);
  tri.draw();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteProgram(program);
}

function anisotropic(gl: WebGL2RenderingContext): void {
  const ext = gl.getExtension("EXT_texture_filter_anisotropic");
  if (!ext) return;
  const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
  gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(MAX_ANISOTROPY, max));
}
