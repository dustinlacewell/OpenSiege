import { MATERIAL_GLSL } from "./propMaterials.ts";
import { SCENE_FS, SCENE_VS } from "./scene.ts";
import { POSE_GLSL } from "./unitShader.ts";

/**
 * Places a static prop: stretch the 1-by-1 model by the instance scales, turn it about z, move it to
 * the ground. Props shrink to nothing between `u_fade.zw` world units from `u_fade.xy`, so a far prop
 * vanishes without blending. Lit and depth passes share it.
 */
export const PROP_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in float a_part;
layout(location = 3) in vec4 i_posYaw;
layout(location = 4) in vec3 i_scale;
${SCENE_VS}
${POSE_GLSL}
/** Fade centre x, y, then the distances where shrinking starts and ends. */
uniform vec4 u_fade;
out vec3 v_pos;
out vec3 v_normal;
out vec3 v_local;
out float v_tint;
flat out int v_part;
/** Per-face shade jitter. Hashed from the model normal here, once per face: hashing the interpolated normal per pixel gives grain. */
flat out float v_facet;

void main() {
  float fade = 1.0 - smoothstep(u_fade.z, u_fade.w, distance(i_posYaw.xy, u_fade.xy));
  vec3 scale = vec3(i_scale.x, i_scale.x, i_scale.y);
  vec3 p = a_pos * scale * fade;
  vec3 n = normalize(a_normal / scale);
  p.xy = rot(p.xy, i_posYaw.w);
  n.xy = rot(n.xy, i_posYaw.w);
  v_local = a_pos;
  v_pos = p + i_posYaw.xyz;
  v_normal = n;
  v_tint = i_scale.z;
  v_part = int(a_part + 0.5);
  v_facet = fract(sin(dot(a_normal, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  gl_Position = u_viewProj * vec4(v_pos, 1.0);
}
`;

/** Lit by sky and sun, shadowed, fogged. Colour from the material table, darker toward the foot. */
export const PROP_FS = `#version 300 es
precision highp float;
${SCENE_FS}
${MATERIAL_GLSL}
in vec3 v_pos;
in vec3 v_normal;
in vec3 v_local;
in float v_tint;
flat in int v_part;
flat in float v_facet;
out vec4 o_color;

void main() {
  vec3 n = normalize(v_normal);
  vec4 paint = MAT_COLOR[v_part];
  vec2 fx = MAT_FX[v_part];
  float facet = v_facet;
  float foot = mix(1.0 - paint.a, 1.0, clamp(v_local.z, 0.0, 1.0));
  vec3 albedo = toLinear(paint.rgb * (0.88 + 0.24 * v_tint) * (1.0 + (facet - 0.5) * fx.x) * foot);
  float shadow = sunShadow(v_pos, n);
  vec3 col = lit(albedo, n, shadow, mix(0.7, 1.0, foot)) + pointLights(albedo, n, v_pos) + specular(n, v_pos, shadow, 24.0, fx.y);
  o_color = vec4(fogged(col, v_pos), 1.0);
}
`;
