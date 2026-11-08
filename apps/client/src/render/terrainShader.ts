import { MAX_FIELDS } from "@mf/sim";
import { CAUSTIC_GLSL } from "./causticShader.ts";
import { CRYSTAL_GLSL } from "./crystalShader.ts";
import { SCENE_FS, SCENE_VS } from "./scene.ts";

export const TERRAIN_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
${SCENE_VS}
uniform vec2 u_map;
/** 0: the map itself. r: ring r of mirrored copies around it, 8r tiles, one instance each. */
uniform int u_ring;
out vec3 v_pos;
/** The point on the real map this vertex copies: paint and scorch read there. */
out vec2 v_src;
out vec3 v_normal;

/** Tile t along one axis: odd tiles are reflected, so each copy meets its neighbour edge to edge. */
float mirrored(float p, int t, float size, out float flip) {
  bool odd = (t & 1) != 0;
  flip = odd ? -1.0 : 1.0;
  return float(t) * size + (odd ? size - p : p);
}

/** Instance k walks the ring's square: bottom, right, top, left, 2r tiles a side. */
ivec2 tile() {
  int r = u_ring;
  if (r == 0) return ivec2(0);
  int side = gl_InstanceID / (2 * r);
  int off = gl_InstanceID % (2 * r);
  if (side == 0) return ivec2(-r + off, -r);
  if (side == 1) return ivec2(r, -r + off);
  if (side == 2) return ivec2(r - off, r);
  return ivec2(-r, r - off);
}

void main() {
  ivec2 t = tile();
  float fx, fy;
  vec3 pos = vec3(mirrored(a_pos.x, t.x, u_map.x, fx), mirrored(a_pos.y, t.y, u_map.y, fy), a_pos.z);
  v_pos = pos;
  v_src = a_pos.xy;
  v_normal = a_normal * vec3(fx, fy, 1.0);
  gl_Position = u_viewProj * vec4(pos, 1.0);
}
`;

export const TERRAIN_FS = `#version 300 es
precision highp float;
${SCENE_FS}
uniform vec2 u_map;
uniform float u_maxHeight;
/** Ground below this height is under water and gets caustics. */
uniform float u_seaLevel;
uniform float u_time;
uniform vec4 u_fields[${MAX_FIELDS}];
uniform int u_fieldCount;
uniform sampler2D u_detail;
/** The decal map: 0 clean to 1 charred, over 0..u_map. */
uniform sampler2D u_decals;
/** Painted ground: one texel of four weights per grid vertex, blended over u_palette (linear). Off: the procedural ground. */
uniform bool u_useMaterials;
uniform sampler2D u_materials;
uniform vec3 u_palette[4];
in vec3 v_pos;
in vec2 v_src;
in vec3 v_normal;
out vec4 o_color;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

struct Ground {
  vec3 albedo;
  vec3 n;
  float ao;
};

${CRYSTAL_GLSL}
${CAUSTIC_GLSL}

/** Grass and dry grass by height and noise, then dirt by noise and slope (sRGB). */
vec3 proceduralSoil(vec4 fine, vec4 medium, vec4 coarse, float slope) {
  vec2 p = v_pos.xy;
  float macro = noise(p / 3100.0) * 0.6 + noise(p / 1150.0 + 7.3) * 0.4;
  float h = clamp(v_pos.z / u_maxHeight, 0.0, 1.0);
  vec3 lush = mix(vec3(0.15, 0.26, 0.09), vec3(0.24, 0.38, 0.14), smoothstep(0.3, 0.7, medium.a * 0.6 + fine.a * 0.4));
  vec3 dry = mix(vec3(0.40, 0.40, 0.22), vec3(0.52, 0.48, 0.28), fine.a);
  vec3 col = mix(lush, dry, smoothstep(0.35, 0.8, h + (macro - 0.5) * 0.6 + (coarse.a - 0.5) * 0.35));
  vec3 dirt = mix(vec3(0.33, 0.25, 0.17), vec3(0.47, 0.37, 0.25), medium.b);
  float dirtMask = max(smoothstep(0.66, 0.8, macro * 0.6 + coarse.b * 0.5 + medium.a * 0.15), smoothstep(0.03, 0.08, slope));
  return mix(col, dirt, dirtMask);
}

/** The palette blended by the weight map (linear). Texel centres sit on grid vertices. All-zero weights read as material 0. */
vec3 paintedSoil() {
  vec2 size = vec2(textureSize(u_materials, 0));
  vec2 uv = (clamp(v_src / u_map, 0.0, 1.0) * (size - 1.0) + 0.5) / size;
  vec4 w = texture(u_materials, uv);
  float sum = w.r + w.g + w.b + w.a;
  w = sum > 0.0 ? w / sum : vec4(1.0, 0.0, 0.0, 0.0);
  return u_palette[0] * w.r + u_palette[1] * w.g + u_palette[2] * w.b + u_palette[3] * w.a;
}

/** Soil (procedural or painted), then rock by slope and detail shading, at three detail scales. */
Ground ground(vec3 n) {
  vec2 p = v_pos.xy;
  vec4 fine = texture(u_detail, p / 61.0);
  vec4 medium = texture(u_detail, p / 263.0);
  vec4 coarse = texture(u_detail, mat2(0.8, -0.6, 0.6, 0.8) * p / 1370.0);
  float slope = 1.0 - n.z + (medium.b - 0.5) * 0.04;
  vec3 rock = mix(vec3(0.28, 0.27, 0.26), vec3(0.50, 0.48, 0.45), fine.b * 0.6 + medium.b * 0.4);
  float rockMask = smoothstep(0.08, 0.16, slope + (coarse.b - 0.5) * 0.05);
  float shade = 0.82 + 0.36 * fine.b * (0.5 + 0.5 * medium.b);

  vec2 slopes = (fine.rg - 0.5) * mix(0.5, 1.1, rockMask) + (medium.rg - 0.5) * 0.6;
  Ground g;
  if (u_useMaterials) {
    g.albedo = mix(paintedSoil(), toLinear(rock), rockMask) * toLinear(vec3(shade));
  } else {
    vec3 col = mix(proceduralSoil(fine, medium, coarse, slope), rock, rockMask);
    col *= shade;
    g.albedo = toLinear(col);
  }
  g.n = normalize(n + vec3(slopes, 0.0));
  g.ao = mix(0.7, 1.0, fine.b * 0.5 + medium.b * 0.5);
  return g;
}

const vec3 CHAR_RGB = vec3(0.05, 0.045, 0.04);

/** Darkens the albedo toward burnt earth by the decal map, before any light reads it. */
void scorch(inout Ground g) {
  float c = texture(u_decals, clamp(v_src / u_map, 0.0, 1.0)).r;
  g.albedo *= mix(vec3(1.0), CHAR_RGB, c);
}

float gridLine(vec2 p, float spacing) {
  vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
  vec2 l = 1.0 - clamp(g / fwidth(p), 0.0, 1.0);
  return max(l.x, l.y);
}

/** Dims the world outside the map and draws a soft line on its edge. */
vec3 mapEdge(vec3 col) {
  vec2 edge = min(v_pos.xy, u_map - v_pos.xy);
  float inside = min(edge.x, edge.y);
  col *= mix(1.0, 0.35, smoothstep(0.0, 200.0, -inside));
  float border = 1.0 - clamp(abs(inside) / (1.5 * fwidth(inside)), 0.0, 1.0);
  return mix(col, vec3(1.2, 1.4, 1.6), border * 0.7);
}

void main() {
  Ground g = ground(normalize(v_normal));
  scorch(g);
  vec3 glow = crystals(g, v_pos, u_time);
  float shadow = sunShadow(v_pos, g.n);
  vec3 col = lit(g.albedo, g.n, shadow, g.ao) + pointLights(g.albedo, g.n, v_pos) + glow;
  col += caustics(g.albedo, g.n, v_pos, u_seaLevel - v_pos.z, shadow, u_time);
  col = mix(col, col * 1.25 + 0.01, gridLine(v_pos.xy, 1000.0) * 0.15);
  o_color = vec4(fogged(mapEdge(col), v_pos), 1.0);
}
`;
