/**
 * GLSL for the ripple field. The state texture holds R height, G vertical velocity, B foam (all per texel).
 * The ground texture holds water depth (sea level − ground) per terrain vertex.
 */

/** Ground depth (world units) at a world point. Vertex (i, j) is texel (i, j); the grid is `u_cell` apart. */
const GROUND = `
uniform sampler2D u_depth;
uniform float u_cell;
float depthAt(vec2 xy) {
  vec2 grid = vec2(textureSize(u_depth, 0));
  return texture(u_depth, (xy / u_cell + 0.5) / grid).r;
}
`;

/** The state texel at `p` and its four neighbours, clamped at the map edge (the edge reflects). */
const NEIGHBOURS = `
uniform sampler2D u_state;
vec4 at(ivec2 p) {
  return texelFetch(u_state, clamp(p, ivec2(0), textureSize(u_state, 0) - 1), 0);
}
`;

/** One instanced quad per splat: i_splat = x, y, radius; i_amount = height, foam. Quad reaches 1.5 radius. */
export const SPLAT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 i_splat;
layout(location = 2) in vec2 i_amount;
uniform vec2 u_map;
out vec2 v_uv;
flat out vec2 v_amount;
void main() {
  v_uv = a_corner * 1.5;
  v_amount = i_amount;
  vec2 xy = i_splat.xy + v_uv * i_splat.z;
  gl_Position = vec4(xy / u_map * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** A gaussian with sigma = radius / 2, added to height and foam. Velocity is left alone. */
export const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
flat in vec2 v_amount;
out vec4 o_add;
void main() {
  float g = exp(-2.0 * dot(v_uv, v_uv));
  o_add = vec4(v_amount.x * g, 0.0, v_amount.y * g, 0.0);
}
`;

/**
 * One step of the damped wave equation, semi-implicit Euler: v += c²·∇²h, v *= damp, h += v.
 * Land kills the wave: height and velocity scale by wet = clamp(depth / u_shore.x, 0, 1).
 * Foam decays, and grows where the surface is steep and where shallow water moves.
 */
export const STEP_FS = `#version 300 es
precision highp float;
${NEIGHBOURS}
${GROUND}
uniform vec2 u_c2;
uniform float u_damp;
uniform float u_foamDecay;
uniform vec2 u_texel;
uniform vec2 u_shore;
uniform vec2 u_foamGain;
uniform float u_slopeFoam;
out vec4 o_state;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = at(p);
  float l = at(p - ivec2(1, 0)).r, r = at(p + ivec2(1, 0)).r;
  float d = at(p - ivec2(0, 1)).r, u = at(p + ivec2(0, 1)).r;
  float lap = u_c2.x * (l + r - 2.0 * s.r) + u_c2.y * (d + u - 2.0 * s.r);
  float v = (s.g + lap) * u_damp;
  float h = s.r + v;
  float depth = depthAt((vec2(p) + 0.5) * u_texel);
  float wet = clamp(depth / u_shore.x, 0.0, 1.0);
  h *= wet;
  v *= wet;
  float slope = length(vec2(r - l, u - d) / (2.0 * u_texel));
  float shallow = wet * (1.0 - clamp(depth / u_shore.y, 0.0, 1.0));
  float grow = u_foamGain.x * max(0.0, slope - u_slopeFoam) + u_foamGain.y * shallow * abs(v);
  float foam = clamp(s.b * u_foamDecay + grow, 0.0, 1.0) * step(0.0, depth);
  o_state = vec4(h, v, foam, 0.0);
}
`;

/** The contract texture: R height, G/B slope by central differences (world units per world unit), A foam. */
export const OUTPUT_FS = `#version 300 es
precision highp float;
${NEIGHBOURS}
uniform vec2 u_texel;
out vec4 o_ripple;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = at(p);
  float l = at(p - ivec2(1, 0)).r, r = at(p + ivec2(1, 0)).r;
  float d = at(p - ivec2(0, 1)).r, u = at(p + ivec2(0, 1)).r;
  vec2 slope = vec2(r - l, u - d) / (2.0 * u_texel);
  o_ripple = vec4(s.r, slope, s.b);
}
`;
