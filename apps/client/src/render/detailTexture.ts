import { DETAIL_FS } from "./detailShader.ts";
import type { FullscreenTriangle } from "./fullscreen.ts";
import { createTilingTexture } from "./tilingTexture.ts";

const SIZE = 1024;

/** Renders the tiling ground detail texture once, with full mipmaps and anisotropic filtering. */
export function createDetailTexture(gl: WebGL2RenderingContext, tri: FullscreenTriangle): WebGLTexture {
  return createTilingTexture(gl, tri, DETAIL_FS, SIZE);
}
