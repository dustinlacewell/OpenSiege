import type { Camera } from "../game/camera.ts";
import { uniform } from "./gl.ts";
import { LIGHT_INDEX_ROW, LIGHT_TILE } from "./lightTiles.ts";

/** Direction toward the sun. */
export const SUN = normalized(-0.5, -0.62, 0.6);
/** Texture unit of the sun's shadow map. Unit 0 is free for each pass's own texture. */
export const SHADOW_UNIT = 1;
/** Texture units of the light data, the light tiles and the light index list. */
export const LIGHT_DATA_UNIT = 2;
export const LIGHT_TILES_UNIT = 3;
export const LIGHT_INDEX_UNIT = 4;
/** Texture unit of the ground's decal map. Only the terrain reads it. */
export const DECAL_UNIT = 5;
/** Texture unit of the painted material weight map. Only the terrain reads it, and only when a layer is set. */
export const MATERIAL_UNIT = 6;
// Unit 7 is the ripple field (`RIPPLE_UNIT`, ripples.ts). Only the water reads it.
/** Texture units the water reads: the mid-frame scene grab (colour, depth), the ground height map, its normal map. */
export const GRAB_COLOR_UNIT = 8;
export const GRAB_DEPTH_UNIT = 9;
export const GROUND_HEIGHT_UNIT = 10;
export const WATER_NORMAL_UNIT = 11;

/** What lit passes read from a camera. Fog starts and scales with `dist`. */
export type SceneView = Pick<Camera, "viewProj" | "eye" | "dist">;

/** The sun's shadow map as the lit shaders read it. */
export interface SunLight {
  /** World → shadow map uv and depth, 0..1. */
  readonly shadowMat: Float32Array;
  readonly texture: WebGLTexture;
  /** One texel in uv. */
  readonly texelUv: number;
  /** One texel in world units. */
  readonly texelWorld: number;
}

/**
 * This frame's tiled capsule lights as textures. `data`: RGBA32F, 3 texels per light row. `tiles`: RG32UI, (offset,
 * count) per screen tile. `index`: R32UI, the light numbers, LIGHT_INDEX_ROW per row. Shaders read none of them
 * while `on` is false.
 */
export interface SceneLights {
  readonly on: boolean;
  readonly data: WebGLTexture | null;
  readonly tiles: WebGLTexture | null;
  readonly index: WebGLTexture | null;
}

/** For passes with no lights in their scene, such as the sky and headshots. */
export const NO_LIGHTS: SceneLights = { on: false, data: null, tiles: null, index: null };

/** Vertex-stage scene uniform. Paste after `precision`. */
export const SCENE_VS = `
uniform mat4 u_viewProj;
`;

/**
 * Fragment-stage lighting, all in linear HDR before tone mapping. Paste after `precision`.
 * Colours named *_RGB are radiance; albedos come in as sRGB and go through toLinear.
 */
export const SCENE_FS = `
uniform vec3 u_eye;
uniform vec3 u_sun;
uniform vec2 u_fog;
uniform mat4 u_shadowMat;
uniform highp sampler2DShadow u_shadow;
uniform vec2 u_shadowTexel;
/** Light i is row i: texels [A, radius], [B, 0], [radiance, 0]. */
uniform highp sampler2D u_lightData;
/** Per screen tile, from the bottom left: (offset, count) into u_lightIndex. */
uniform highp usampler2D u_lightTiles;
uniform highp usampler2D u_lightIndex;
/** 0: no lights; the light textures are not read. */
uniform int u_lightsOn;

const int LIGHT_TILE = ${LIGHT_TILE};
const uint LIGHT_INDEX_ROW = ${LIGHT_INDEX_ROW}u;

const vec3 SUN_RGB = vec3(1.0, 0.93, 0.82) * 3.0;
const vec3 SKY_RGB = vec3(0.45, 0.56, 0.80);
const vec3 BOUNCE_RGB = vec3(0.30, 0.26, 0.19) * 0.5;
const vec3 HORIZON_RGB = vec3(0.58, 0.76, 1.12);
const vec3 ZENITH_RGB = vec3(0.21, 0.38, 1.05);
const vec3 SUN_HAZE_RGB = vec3(1.0, 0.78, 0.52) * 0.9;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

/** 1 in sunlight, 0 in shadow. 3x3 hardware-filtered taps. Offsets along the normal against acne. */
float sunShadow(vec3 world, vec3 n) {
  vec3 p = world + n * u_shadowTexel.y * 1.5;
  vec3 s = (u_shadowMat * vec4(p, 1.0)).xyz;
  if (s.x <= 0.0 || s.y <= 0.0 || s.x >= 1.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  float r = u_shadowTexel.x * 1.25;
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) sum += texture(u_shadow, vec3(s.xy + vec2(x, y) * r, s.z));
  }
  return sum / 9.0;
}

/** Diffuse: sky/ground hemisphere ambient plus the sun. */
vec3 lit(vec3 albedo, vec3 n, float shadow, float ao) {
  float ndl = max(dot(n, u_sun), 0.0);
  vec3 ambient = mix(BOUNCE_RGB, SKY_RGB, n.z * 0.5 + 0.5) * ao;
  return albedo * (ambient + SUN_RGB * ndl * shadow);
}

/**
 * Diffuse from the capsule lights, unshadowed. Each lights from the closest point on its segment and falls to 0
 * at its radius. A little wrap keeps ground under a light from going black. Only the lights binned into this
 * fragment's screen tile count.
 */
vec3 pointLights(vec3 albedo, vec3 n, vec3 world) {
  if (u_lightsOn == 0) return vec3(0.0);
  uvec2 tile = texelFetch(u_lightTiles, ivec2(gl_FragCoord.xy) / LIGHT_TILE, 0).xy;
  vec3 sum = vec3(0.0);
  for (uint j = 0u; j < tile.y; j++) {
    uint k = tile.x + j;
    int i = int(texelFetch(u_lightIndex, ivec2(int(k % LIGHT_INDEX_ROW), int(k / LIGHT_INDEX_ROW)), 0).r);
    vec4 a = texelFetch(u_lightData, ivec2(0, i), 0);
    vec3 ab = texelFetch(u_lightData, ivec2(1, i), 0).xyz - a.xyz;
    float t = clamp(dot(world - a.xyz, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    vec3 d = a.xyz + ab * t - world;
    float dist = max(length(d), 1e-3);
    float att = clamp(1.0 - dist / a.w, 0.0, 1.0);
    float ndl = 0.2 + 0.8 * max(dot(n, d / dist), 0.0);
    sum += texelFetch(u_lightData, ivec2(2, i), 0).rgb * att * att * ndl;
  }
  return albedo * sum;
}

/** Normalised Blinn-Phong sun highlight. */
vec3 specular(vec3 n, vec3 world, float shadow, float power, float strength) {
  vec3 v = normalize(u_eye - world);
  vec3 h = normalize(v + u_sun);
  float s = pow(max(dot(n, h), 0.0), power) * (power + 8.0) / 25.13;
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(v, h), 0.0), 5.0);
  return SUN_RGB * s * strength * fresnel * shadow * max(dot(n, u_sun), 0.0);
}

/** Haze along a view direction: horizon colour, warmer toward the sun. */
vec3 haze(vec3 dir) {
  return HORIZON_RGB + SUN_HAZE_RGB * pow(max(dot(dir, u_sun), 0.0), 6.0) * 0.6;
}

vec3 skyColor(vec3 dir) {
  float up = clamp(dir.z, 0.0, 1.0);
  vec3 col = mix(HORIZON_RGB, ZENITH_RGB, pow(up, 0.5));
  float toSun = max(dot(dir, u_sun), 0.0);
  col += SUN_HAZE_RGB * (pow(toSun, 6.0) * 0.6 + pow(toSun, 64.0) * 1.5);
  return col + SUN_RGB * smoothstep(0.9995, 0.9998, toSun) * 8.0;
}

vec3 fogged(vec3 col, vec3 world) {
  vec3 d = world - u_eye;
  float dist = length(d);
  float f = 1.0 - exp(-max(dist - u_fog.x, 0.0) / u_fog.y);
  return mix(col, haze(d / dist), f * 0.92);
}
`;

export interface SceneUniforms {
  viewProj: WebGLUniformLocation | null;
  eye: WebGLUniformLocation | null;
  sun: WebGLUniformLocation | null;
  fog: WebGLUniformLocation | null;
  shadowMat: WebGLUniformLocation | null;
  shadow: WebGLUniformLocation | null;
  shadowTexel: WebGLUniformLocation | null;
  lightData: WebGLUniformLocation | null;
  lightTiles: WebGLUniformLocation | null;
  lightIndex: WebGLUniformLocation | null;
  lightsOn: WebGLUniformLocation | null;
}

export function sceneUniforms(gl: WebGL2RenderingContext, program: WebGLProgram): SceneUniforms {
  return {
    viewProj: uniform(gl, program, "u_viewProj"),
    eye: uniform(gl, program, "u_eye"),
    sun: uniform(gl, program, "u_sun"),
    fog: uniform(gl, program, "u_fog"),
    shadowMat: uniform(gl, program, "u_shadowMat"),
    shadow: uniform(gl, program, "u_shadow"),
    shadowTexel: uniform(gl, program, "u_shadowTexel"),
    lightData: uniform(gl, program, "u_lightData"),
    lightTiles: uniform(gl, program, "u_lightTiles"),
    lightIndex: uniform(gl, program, "u_lightIndex"),
    lightsOn: uniform(gl, program, "u_lightsOn"),
  };
}

/** Call after useProgram. Binds the shadow map to SHADOW_UNIT and, when on, the light textures to the LIGHT_*_UNITs. */
export function applyScene(gl: WebGL2RenderingContext, u: SceneUniforms, cam: SceneView, sun: SunLight, lights: SceneLights): void {
  gl.uniformMatrix4fv(u.viewProj, false, cam.viewProj);
  gl.uniform3fv(u.eye, cam.eye);
  gl.uniform3f(u.sun, SUN[0], SUN[1], SUN[2]);
  gl.uniform2f(u.fog, cam.dist * 1.3, cam.dist * 2.6);
  gl.uniformMatrix4fv(u.shadowMat, false, sun.shadowMat);
  gl.uniform2f(u.shadowTexel, sun.texelUv, sun.texelWorld);
  gl.uniform1i(u.shadow, SHADOW_UNIT);
  gl.activeTexture(gl.TEXTURE0 + SHADOW_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, sun.texture);
  applyLights(gl, u, lights);
  gl.activeTexture(gl.TEXTURE0);
}

/** The samplers always point at their own units, so no two sampler types share one. */
function applyLights(gl: WebGL2RenderingContext, u: SceneUniforms, lights: SceneLights): void {
  gl.uniform1i(u.lightData, LIGHT_DATA_UNIT);
  gl.uniform1i(u.lightTiles, LIGHT_TILES_UNIT);
  gl.uniform1i(u.lightIndex, LIGHT_INDEX_UNIT);
  gl.uniform1i(u.lightsOn, lights.on ? 1 : 0);
  if (!lights.on) return;
  bindAt(gl, LIGHT_DATA_UNIT, lights.data);
  bindAt(gl, LIGHT_TILES_UNIT, lights.tiles);
  bindAt(gl, LIGHT_INDEX_UNIT, lights.index);
}

function bindAt(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture | null): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

function normalized(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}
