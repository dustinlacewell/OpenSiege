import { SCENE_FS, SCENE_VS } from "./scene.ts";
import { WAVES, wavesGlsl } from "./waterWaves.ts";

/** Both stages: the ground height map, the ripple field, and the Gerstner sum. */
const WATER_COMMON = `
uniform float u_seaLevel;
uniform float u_time;
uniform vec2 u_map;
/** Sim vertices on x and y, and their spacing. */
uniform vec2 u_grid;
uniform float u_cell;
/** R16F, one texel per sim vertex. */
uniform highp sampler2D u_ground;
/** Over the map only. R: surface offset. G, B: slope d/dx, d/dy. A: foam. */
uniform highp sampler2D u_ripples;
${wavesGlsl(WAVES)}

/** Reflects x onto 0..size the way the mirrored surround copies the map. */
float fold(float x, float size) { return size - abs(mod(x, 2.0 * size) - size); }

float groundHeight(vec2 p) {
  vec2 q = vec2(fold(p.x, u_map.x), fold(p.y, u_map.y));
  return texture(u_ground, (q / u_cell + 0.5) / u_grid).r;
}

vec4 rippleAt(vec2 p) {
  vec2 uv = p / u_map;
  bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  return inside ? texture(u_ripples, uv) : vec4(0.0);
}

/** Waves calm to nothing in the last few units of depth, so the shore does not clip through them. */
float waveAmp(float depth) { return smoothstep(2.0, 30.0, depth); }

/** Gerstner displacement of the rest point p. */
vec3 gerstner(vec2 p, float t, float amp) {
  vec3 d = vec3(0.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    vec4 w = WAVE_PHASE[i];
    float a = WAVE_SHAPE[i].x * amp;
    float th = w.z * dot(w.xy, p) - w.w * t;
    d.xy += WAVE_SHAPE[i].y * a * w.xy * cos(th);
    d.z += a * sin(th);
  }
  return d;
}

/** The analytic normal of the displaced surface at rest point p. */
vec3 gerstnerNormal(vec2 p, float t, float amp) {
  vec3 n = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    vec4 w = WAVE_PHASE[i];
    float wa = w.z * WAVE_SHAPE[i].x * amp;
    float th = w.z * dot(w.xy, p) - w.w * t;
    n.xy -= w.xy * wa * cos(th);
    n.z -= WAVE_SHAPE[i].y * wa * sin(th);
  }
  return normalize(n);
}
`;

export const WATER_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_xy;
${SCENE_VS}
${WATER_COMMON}
/** The grid's centre in world xy, snapped so vertices do not swim. */
uniform vec2 u_centre;
/** Displacement fades out between these distances from the centre, where the grid grows coarse. */
uniform vec2 u_waveFade;
out vec3 v_pos;
/** The rest point: waves and maps are read there. */
out vec2 v_rest;

void main() {
  vec2 p = u_centre + a_xy;
  float depth = u_seaLevel - groundHeight(p);
  float amp = waveAmp(depth) * (1.0 - smoothstep(u_waveFade.x, u_waveFade.y, length(a_xy)));
  vec3 d = gerstner(p, u_time, amp);
  float ripple = rippleAt(p).r * smoothstep(0.0, 4.0, depth);
  vec3 pos = vec3(p + d.xy, u_seaLevel + d.z + ripple);
  v_pos = pos;
  v_rest = p;
  gl_Position = u_viewProj * vec4(pos, 1.0);
}
`;

export const WATER_FS = `#version 300 es
precision highp float;
${SCENE_FS}
${WATER_COMMON}
/** Declared in the vertex stage by SCENE_VS; the fragment stage projects too (refraction, reflection march). */
uniform mat4 u_viewProj;
uniform mat4 u_invViewProj;
/** The scene drawn before the water: resolved colour, and depth 0..1. */
uniform highp sampler2D u_grabColor;
uniform highp sampler2D u_grabDepth;
/** Tiling detail: RG slope packed 0..1, B height. */
uniform sampler2D u_normals;
in vec3 v_pos;
in vec2 v_rest;
out vec4 o_color;

/** Per world unit of light path: red goes first, then green. Shallow reads clear teal, deep dark blue-green. */
const vec3 ABSORB = vec3(0.045, 0.016, 0.011);
/** Light the water itself scatters toward the eye, and how fast it builds with path length. */
const vec3 SCATTER_ALBEDO = vec3(0.012, 0.055, 0.065);
const float SCATTER_K = 0.02;
/** World units the refraction bends the view at full strength. */
const float REFRACT = 24.0;
const float ROUGH = 0.18;
const float GLINT_MAX = 60.0;
/** Path length over which the surface fades in from the shoreline. */
const float EDGE = 6.0;
const float PI = 3.14159265;

vec3 worldAt(vec2 uv, float z) {
  vec4 w = u_invViewProj * vec4(vec3(uv, z) * 2.0 - 1.0, 1.0);
  return w.xyz / w.w;
}

vec2 screenOf(vec3 world) {
  vec4 c = u_viewProj * vec4(world, 1.0);
  return c.xy / c.w * 0.5 + 0.5;
}

bool onScreen(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))); }

/** Gerstner normal, two scrolling detail layers and the ripple slope, summed as slopes. */
vec3 surfaceNormal(vec2 p, float depth, float eyeDist, vec2 rippleSlope) {
  float close = 1.0 - smoothstep(6000.0, 18000.0, eyeDist);
  vec3 g = gerstnerNormal(p, u_time, waveAmp(depth) * close);
  vec2 s1 = texture(u_normals, p / 380.0 + u_time * vec2(0.012, 0.007)).rg - 0.5;
  vec2 s2 = texture(u_normals, mat2(0.8, -0.6, 0.6, 0.8) * p / 155.0 - u_time * vec2(0.009, 0.015)).rg - 0.5;
  vec2 detail = (s1 * 0.5 + s2 * 0.35) * mix(0.35, 1.0, waveAmp(depth));
  return normalize(vec3(g.xy / g.z - detail - rippleSlope, 1.0));
}

/**
 * What is seen through the surface: the grabbed scene, bent by the normal more the thicker the water, then
 * absorbed per channel and filled with scattered light. A bend that lands on something in front of the
 * surface is dropped, so the foreground never bleeds in.
 */
vec3 waterBody(vec2 suv, vec3 n, float eyeDist, float thick, float shadow) {
  vec2 ruv = screenOf(v_pos + vec3(n.xy * REFRACT * clamp(thick / 80.0, 0.0, 1.0), 0.0));
  float rz = texture(u_grabDepth, ruv).r;
  float path = distance(u_eye, worldAt(ruv, rz)) - eyeDist;
  if (!onScreen(ruv) || rz >= 1.0 || path <= 0.0) {
    ruv = suv;
    path = thick;
  }
  vec3 behind = texture(u_grabColor, ruv).rgb;
  vec3 light = mix(BOUNCE_RGB, SKY_RGB, 0.8) + SUN_RGB * max(u_sun.z, 0.0) * shadow;
  vec3 scatter = SCATTER_ALBEDO * light + pointLights(SCATTER_ALBEDO, vec3(0.0, 0.0, 1.0), v_pos);
  return behind * exp(-ABSORB * path) + scatter * (1.0 - exp(-SCATTER_K * path));
}

/** Binary search between two march distances for where the ray meets the grabbed depth. */
vec2 refineHit(vec3 p, vec3 r, float t0, float t1) {
  vec2 uv = screenOf(p + r * t1);
  for (int i = 0; i < 5; i++) {
    float t = 0.5 * (t0 + t1);
    vec3 q = p + r * t;
    vec2 m = screenOf(q);
    float behind = distance(u_eye, q) - distance(u_eye, worldAt(m, texture(u_grabDepth, m).r));
    if (behind > 0.0) { t1 = t; uv = m; } else t0 = t;
  }
  return uv;
}

/** Screen-space reflection against the grabbed depth, 16 growing steps and a short refine. Misses read the sky. */
vec3 reflection(vec3 p, vec3 r) {
  r.z = abs(r.z);
  vec3 sky = skyColor(r);
  float t = 0.0, stride = 24.0;
  for (int i = 0; i < 16; i++) {
    float t0 = t;
    t += stride;
    stride *= 1.35;
    vec3 q = p + r * t;
    vec4 c = u_viewProj * vec4(q, 1.0);
    if (c.w <= 0.0) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (!onScreen(uv)) break;
    float z = texture(u_grabDepth, uv).r;
    if (z >= 1.0) continue;
    float behind = distance(u_eye, q) - distance(u_eye, worldAt(uv, z));
    if (behind <= 0.0) continue;
    if (behind > stride * 2.0 + 40.0) break;
    vec2 hit = refineHit(p, r, t0, t);
    vec2 edge = smoothstep(0.0, 0.08, hit) * smoothstep(0.0, 0.08, 1.0 - hit);
    return mix(sky, texture(u_grabColor, hit).rgb, edge.x * edge.y);
  }
  return sky;
}

float schlick(vec3 n, vec3 v) { return 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0); }

/** GGX sun highlight in HDR, clamped against single-pixel spikes. */
vec3 sunGlint(vec3 n, vec3 v, float shadow) {
  vec3 h = normalize(v + u_sun);
  float ndl = max(dot(n, u_sun), 0.0);
  float ndv = max(dot(n, v), 1e-3);
  float ndh = max(dot(n, h), 0.0);
  float a2 = ROUGH * ROUGH * ROUGH * ROUGH;
  float dd = ndh * ndh * (a2 - 1.0) + 1.0;
  float d = a2 / (PI * dd * dd);
  float k = ROUGH * ROUGH * 0.5;
  float vis = 0.25 / ((ndl * (1.0 - k) + k) * (ndv * (1.0 - k) + k));
  float f = 0.02 + 0.98 * pow(1.0 - max(dot(v, h), 0.0), 5.0);
  return SUN_RGB * min(d * vis * f * ndl, GLINT_MAX) * shadow;
}

/**
 * Foam: on the waterline, in bands that roll in toward the shore, and wherever the ripples churn. The waterline
 * reads ground depth, not view path, so it keeps one width from any angle; the grain cuts it into patches.
 */
float foam(vec2 p, float depth, float churn) {
  float grain = texture(u_normals, p / 90.0 + u_time * vec2(0.01, -0.006)).b;
  float edge = 1.0 - smoothstep(0.0, 4.0, depth);
  float band = smoothstep(0.82, 1.0, sin(depth * 0.45 + u_time * 1.4 + grain * 3.0)) * (1.0 - smoothstep(4.0, 26.0, depth));
  float f = smoothstep(0.5, 0.9, max(edge, band * 0.8) * (0.2 + grain));
  return clamp(max(f, churn), 0.0, 1.0) * 0.7;
}

void main() {
  vec2 suv = gl_FragCoord.xy / vec2(textureSize(u_grabDepth, 0));
  float sceneZ = texture(u_grabDepth, suv).r;
  if (sceneZ >= 1.0) discard;
  vec3 toEye = u_eye - v_pos;
  float eyeDist = length(toEye);
  vec3 v = toEye / eyeDist;
  float thick = distance(u_eye, worldAt(suv, sceneZ)) - eyeDist;
  if (thick <= 0.0) discard;
  float depth = u_seaLevel - groundHeight(v_rest);
  vec4 ripple = rippleAt(v_rest);
  vec3 n = surfaceNormal(v_rest, depth, eyeDist, ripple.gb);
  float shadow = sunShadow(v_pos, vec3(0.0, 0.0, 1.0));
  vec3 col = mix(waterBody(suv, n, eyeDist, thick, shadow), reflection(v_pos, reflect(-v, n)), schlick(n, v));
  col += sunGlint(n, v, shadow);
  vec3 foamLit = lit(vec3(0.8), n, shadow, 1.0) + pointLights(vec3(0.8), n, v_pos);
  col = mix(col, foamLit, foam(v_rest, depth, ripple.a));
  o_color = vec4(fogged(col, v_pos), smoothstep(0.0, EDGE, thick));
}
`;
