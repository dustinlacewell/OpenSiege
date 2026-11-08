import type { Camera } from "../game/camera.ts";
import { createProgram, uniform } from "./gl.ts";
import { fullscreen } from "./glState.ts";
import { FULLSCREEN_VS, type FullscreenTriangle } from "./fullscreen.ts";
import { applyScene, NO_LIGHTS, SCENE_FS, sceneUniforms, type SceneUniforms, type SunLight } from "./scene.ts";

const FS = `#version 300 es
precision highp float;
${SCENE_FS}
uniform mat4 u_invViewProj;
in vec2 v_ndc;
out vec4 o_color;
void main() {
  vec4 n = u_invViewProj * vec4(v_ndc, -1.0, 1.0);
  vec4 f = u_invViewProj * vec4(v_ndc, 1.0, 1.0);
  vec3 dir = normalize(f.xyz / f.w - n.xyz / n.w);
  o_color = vec4(skyColor(dir), 1.0);
}
`;

/** The sky gradient behind everything, matching the haze the ground fades into. */
export class SkyPass {
  private readonly program: WebGLProgram;
  private readonly scene: SceneUniforms;
  private readonly uInv: WebGLUniformLocation | null;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly tri: FullscreenTriangle) {
    this.program = createProgram(gl, FULLSCREEN_VS, FS);
    this.scene = sceneUniforms(gl, this.program);
    this.uInv = uniform(gl, this.program, "u_invViewProj");
  }

  draw(cam: Camera, sun: SunLight): void {
    const gl = this.gl;
    fullscreen(gl);
    gl.useProgram(this.program);
    applyScene(gl, this.scene, cam, sun, NO_LIGHTS);
    gl.uniformMatrix4fv(this.uInv, false, cam.invViewProj);
    this.tri.draw();
  }
}
