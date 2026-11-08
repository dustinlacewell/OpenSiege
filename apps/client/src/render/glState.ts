/** The few blend/depth states the passes use. Each pass sets one before it draws. */

export function opaque(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** Depth only, pushed away from the light so lit surfaces do not shadow themselves. */
export function shadowCaster(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.5, 3);
}

/** Alpha-blended, depth-tested, no depth write, pulled toward the camera. For marks lying on a surface. */
export function decal(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(-2, -4);
}

/** Alpha-blended, depth-tested, no depth write. For clouds in the air. */
export function translucent(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** Additive light, depth-tested, no depth write. Shaders output premultiplied colour. */
export function additive(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** Alpha-blended, depth-tested and depth-written. For a see-through surface that hides what lies under it: the water. */
export function surface(gl: WebGL2RenderingContext): void {
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** Alpha-blended over everything drawn so far. */
export function overlay(gl: WebGL2RenderingContext): void {
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** No depth. Accumulates and saturates: dst = src + dst · (1 − src). For the decal map. */
export function stamp(gl: WebGL2RenderingContext): void {
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** No depth. Plain sum, signed values allowed: dst = src + dst. For splats into the ripple field. */
export function accumulate(gl: WebGL2RenderingContext): void {
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

/** Overwrites every pixel: sky and post-processing. */
export function fullscreen(gl: WebGL2RenderingContext): void {
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.disable(gl.BLEND);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}
