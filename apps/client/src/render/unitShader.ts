import { BARREL, BARREL_DARK, DARK, DISH, LEG, LIGHT, MAST, PANEL, TRACK, TURRET, TURRET_DARK, TURRET_PANEL } from "./meshBuilder.ts";
import { SCENE_FS, SCENE_VS } from "./scene.ts";

/** Sieged dish sweep: half-width in radians, and angular frequency in radians per second. */
const DISH_SWEEP = "2.4";
const DISH_RATE = "0.5";

/** Shared rotation helpers: hull yaw about z, and the slope tilt (roll about +x, then pitch). */
export const POSE_GLSL = `
vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec3 tilt(vec3 v, float pitch, float roll) {
  v.yz = rot(v.yz, roll);
  v.xz = rot(v.xz, pitch);
  return v;
}
`;

/**
 * Places a model vertex: dish sweep and mast raise, barrel pitch, siege fold and sink, turret turn, slope tilt, hull yaw.
 * Lit and depth passes share it.
 */
export const UNIT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in float a_part;
layout(location = 3) in vec4 i_posYaw;
layout(location = 4) in vec4 i_aimTilt;
layout(location = 5) in vec3 i_team;
/** Barrel pose about its pivot, radians: x pitch in the turret frame (positive raises the muzzle), y swing about up. */
layout(location = 6) in vec2 i_gun;
${SCENE_VS}
${POSE_GLSL}
uniform float u_lower;
uniform float u_legLift;
/** Mast hinge x, hinge z, fold angle (radians about +y when mobile). */
uniform vec3 u_mast;
/** Barrel breech pivot x, z. */
uniform vec2 u_gun;
uniform float u_time;
out vec3 v_pos;
out vec3 v_normal;
out vec3 v_local;
out vec3 v_team;
flat out int v_part;

void main() {
  int part = int(a_part + 0.5);
  float siege = i_aimTilt.w;
  vec3 p = a_pos;
  vec3 n = a_normal;
  if (part == ${DISH}) {
    float sweep = siege * ${DISH_SWEEP} * sin(u_time * ${DISH_RATE});
    p.x -= u_mast.x;
    p.xy = rot(p.xy, sweep);
    p.x += u_mast.x;
    n.xy = rot(n.xy, sweep);
  }
  if (part == ${MAST} || part == ${DISH}) {
    float fold = u_mast.z * (1.0 - siege);
    p.xz = u_mast.xy + rot(p.xz - u_mast.xy, fold);
    n.xz = rot(n.xz, fold);
  }
  bool barrel = part == ${BARREL} || part == ${BARREL_DARK};
  if (barrel) {
    p.xz = u_gun + rot(p.xz - u_gun, i_gun.x);
    n.xz = rot(n.xz, i_gun.x);
    p.x -= u_gun.x;
    p.xy = rot(p.xy, i_gun.y);
    p.x += u_gun.x;
    n.xy = rot(n.xy, i_gun.y);
  }
  if (part == ${LEG}) {
    p.xy *= mix(0.6, 1.0, siege);
    p.z += u_legLift * (1.0 - siege);
  } else {
    p.z -= u_lower * siege;
  }
  if (barrel || part == ${TURRET} || part == ${TURRET_PANEL} || part == ${TURRET_DARK}) {
    float turn = i_aimTilt.x - i_posYaw.w;
    p.xy = rot(p.xy, turn);
    n.xy = rot(n.xy, turn);
  }
  v_local = a_pos;
  p = tilt(p, i_aimTilt.y, i_aimTilt.z);
  n = tilt(n, i_aimTilt.y, i_aimTilt.z);
  p.xy = rot(p.xy, i_posYaw.w);
  n.xy = rot(n.xy, i_posYaw.w);
  v_pos = p + i_posYaw.xyz;
  v_normal = n;
  v_team = i_team;
  v_part = part;
  gl_Position = u_viewProj * vec4(v_pos, 1.0);
}
`;

export const UNIT_FS = `#version 300 es
precision highp float;
${SCENE_FS}
uniform vec3 u_base;
in vec3 v_pos;
in vec3 v_normal;
in vec3 v_local;
in vec3 v_team;
flat in int v_part;
out vec4 o_color;

struct Material {
  vec3 albedo;
  float specPower;
  float specStrength;
  vec3 emission;
};

/** Faint panel seams every few units along the hull, antialiased. */
float seams(vec3 p) {
  vec2 q = abs(fract(p.xy / vec2(14.0, 11.0)) - 0.5);
  vec2 w = fwidth(p.xy / vec2(14.0, 11.0));
  vec2 l = smoothstep(vec2(0.5) - w * 1.5, vec2(0.5), q);
  return max(l.x, l.y);
}

Material material(int part) {
  vec3 paint = mix(u_base, v_team, 0.1);
  Material m = Material(paint, 32.0, 0.35, vec3(0.0));
  bool turret = part == ${TURRET} || part == ${BARREL};
  if (turret) m.albedo = paint * 1.06;
  else if (part == ${DISH}) m = Material(mix(paint, vec3(0.85), 0.5), 40.0, 0.5, vec3(0.0));
  else if (part == ${PANEL} || part == ${TURRET_PANEL}) m = Material(v_team, 48.0, 0.55, v_team * 0.04);
  else if (part == ${LEG} || part == ${DARK} || part == ${TURRET_DARK} || part == ${BARREL_DARK} || part == ${MAST}) m = Material(u_base * 0.42, 48.0, 0.6, vec3(0.0));
  else if (part == ${TRACK}) m = Material(vec3(0.11, 0.105, 0.1) * (0.8 + 0.2 * step(0.5, fract(v_local.x / 3.0))), 8.0, 0.08, vec3(0.0));
  else if (part == ${LIGHT}) m = Material(vec3(0.9, 0.85, 0.7), 16.0, 0.2, vec3(4.0, 3.5, 2.6));
  if (part == 0 || turret) {
    m.albedo *= mix(0.72, 1.0, smoothstep(2.0, 20.0, v_local.z)) * (1.0 - seams(v_local) * 0.18);
  }
  return m;
}

void main() {
  vec3 n = normalize(v_normal);
  Material m = material(v_part);
  vec3 albedo = toLinear(m.albedo);
  float shadow = sunShadow(v_pos, n);
  vec3 col = lit(albedo, n, shadow, 0.85) + pointLights(albedo, n, v_pos) + specular(n, v_pos, shadow, m.specPower, m.specStrength);
  float rim = pow(1.0 - max(dot(n, normalize(u_eye - v_pos)), 0.0), 4.0);
  col += SKY_RGB * rim * 0.12 * m.specStrength + m.emission;
  o_color = vec4(fogged(col, v_pos), 1.0);
}
`;
