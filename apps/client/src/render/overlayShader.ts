/**
 * Marks: kind 0 is a ring lying flat at z (params: radius, thickness px);
 * kind 1 is a screen-space bar anchored at a world point (params: width px, height px, fill 0..1, lift px).
 */
export const MARKS_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_posKind;
layout(location = 2) in vec4 i_params;
layout(location = 3) in vec4 i_color;
uniform mat4 u_viewProj;
uniform vec2 u_pxToClip;
uniform float u_dpr;
out vec2 v_local;
out vec4 v_color;
flat out int v_kind;
flat out vec4 v_params;
void main() {
  v_kind = int(i_posKind.w + 0.5);
  v_params = i_params;
  v_color = i_color;
  if (v_kind == 0) {
    v_local = a_corner * i_params.x * 1.15;
    gl_Position = u_viewProj * vec4(i_posKind.xyz + vec3(v_local, 0.0), 1.0);
  } else {
    // Pad 1 px each side so the fragment shader can blend the edges at sub-pixel positions.
    vec4 clip = u_viewProj * vec4(i_posKind.xyz, 1.0);
    vec2 padded = i_params.xy + 2.0;
    vec2 px = a_corner * padded * 0.5 + vec2(0.0, i_params.w);
    clip.xy += px * u_dpr * u_pxToClip * clip.w;
    v_local = (a_corner * 0.5 + 0.5) * padded - 1.0;
    gl_Position = clip;
  }
}
`;

export const MARKS_FS = `#version 300 es
precision highp float;
uniform float u_dpr;
uniform float u_hdrGain;
in vec2 v_local;
in vec4 v_color;
flat in int v_kind;
flat in vec4 v_params;
out vec4 o_color;

vec4 encode(vec4 c) {
  return u_hdrGain > 0.0 ? vec4(pow(c.rgb, vec3(2.2)) * u_hdrGain, c.a) : c;
}

void main() {
  if (v_kind == 0) {
    float r = length(v_local);
    float px = abs(r - v_params.x) / max(fwidth(r), 1e-4);
    float a = 1.0 - smoothstep(v_params.y * u_dpr * 0.5 - 0.5, v_params.y * u_dpr * 0.5 + 0.5, px);
    o_color = encode(vec4(v_color.rgb, v_color.a * a));
    return;
  }
  // Signed distances in CSS px, blended over one device pixel so edges move smoothly.
  vec2 size = v_params.xy;
  float h = 0.5 / u_dpr;
  vec2 outer = max(-v_local, v_local - size);
  vec2 inner = max(1.0 - v_local, v_local - (size - 1.0));
  float cover = 1.0 - smoothstep(-h, h, max(outer.x, outer.y));
  float border = smoothstep(-h, h, max(inner.x, inner.y));
  float filled = 1.0 - smoothstep(size.x * v_params.z - h, size.x * v_params.z + h, v_local.x);
  vec4 body = mix(vec4(0.05, 0.05, 0.05, 0.7), v_color, filled);
  vec4 c = mix(body, vec4(0.0, 0.0, 0.0, 0.85), border);
  o_color = encode(vec4(c.rgb, c.a * cover));
}
`;
