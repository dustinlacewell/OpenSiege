import { createProgram, uniform } from "./gl.ts";
import { fullscreen } from "./glState.ts";
import { FULLSCREEN_VS, type FullscreenTriangle } from "./fullscreen.ts";

/** Scales scene radiance before the tone curve. */
const EXPOSURE = 0.42;

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_hdr;
uniform float u_exposure;
in vec2 v_ndc;
out vec4 o_color;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 c = texelFetch(u_hdr, ivec2(gl_FragCoord.xy), 0).rgb * u_exposure;
  c = toSrgb(aces(c));
  c *= 1.0 - dot(v_ndc, v_ndc) * 0.07;
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o_color = vec4(c, 1.0);
}
`;

/** Tone maps the resolved HDR image (ACES, sRGB, a light vignette and dither) onto the canvas. */
export class PostPass {
  private readonly program: WebGLProgram;
  private readonly u: Record<"hdr" | "exposure", WebGLUniformLocation | null>;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly tri: FullscreenTriangle) {
    this.program = createProgram(gl, FULLSCREEN_VS, FS);
    this.u = { hdr: uniform(gl, this.program, "u_hdr"), exposure: uniform(gl, this.program, "u_exposure") };
  }

  /** Draws into the bound framebuffer, which must match the HDR image's `width` and `height`. */
  draw(hdr: WebGLTexture, width: number, height: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    fullscreen(gl);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hdr);
    gl.uniform1i(this.u.hdr, 0);
    gl.uniform1f(this.u.exposure, EXPOSURE);
    this.tri.draw();
  }
}
