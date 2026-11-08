/**
 * Resource fields as crystal beds: Voronoi shards with faceted normals, pulsing inner glow,
 * bright cracks, random sparkles, and a soft halo on the ground around the field.
 * Needs u_fields, u_fieldCount, u_eye, u_sun, hash() and the Ground struct.
 */
import { MAX_FIELDS } from "@mf/sim";

export const CRYSTAL_GLSL = `
const vec3 CRYSTAL_RGB = vec3(0.25, 0.95, 0.85);
const float SHARD = 26.0;

/** x: distance to the nearest cell centre, y: gap to the second nearest, zw: offset to the nearest centre. */
vec4 voronoi(vec2 p, out vec2 cellId) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 toCentre = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = vec2(x, y);
      vec2 o = c + vec2(hash(i + c), hash(i + c + 31.7)) - f;
      float d = length(o);
      if (d < d1) { d2 = d1; d1 = d; toCentre = o; cellId = i + c; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec4(d1, d2 - d1, toCentre);
}

/** Paints shards into g and returns their emitted light. */
vec3 crystals(inout Ground g, vec3 pos, float t) {
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${MAX_FIELDS}; i++) {
    if (i >= u_fieldCount) break;
    vec4 f = u_fields[i];
    float d = distance(pos.xy, f.xy) / f.z;
    float amount = clamp(f.w, 0.0, 1.0);
    float halo = (1.0 - smoothstep(0.7, 1.5, d)) * amount;
    if (halo <= 0.0) continue;
    glow += CRYSTAL_RGB * halo * 0.05;
    float m = (1.0 - smoothstep(0.6, 1.0, d)) * amount;
    if (m <= 0.0) continue;
    vec2 cell;
    vec4 v = voronoi(pos.xy / SHARD + float(i) * 3.1, cell);
    float rnd = hash(cell + float(i));
    float shard = step(0.3, rnd) * smoothstep(0.0, 0.06, v.y) * m;
    vec3 facet = normalize(vec3(v.zw * 1.8, 1.0));
    g.albedo = mix(g.albedo, vec3(0.01, 0.05, 0.05), m * 0.75);
    g.n = normalize(mix(g.n, facet, shard));
    float pulse = 0.6 + 0.4 * sin(t * 2.2 + rnd * 6.28);
    float crack = (1.0 - smoothstep(0.0, 0.05, v.y)) * m;
    float sparkle = pow(hash(cell + floor(t * 5.0 + rnd * 17.0)), 60.0) * 8.0;
    vec3 h = normalize(normalize(u_eye - pos) + u_sun);
    float glint = pow(max(dot(facet, h), 0.0), 80.0) * 3.0;
    glow += CRYSTAL_RGB * (shard * (0.5 * pulse * (1.0 - v.x * 0.6) + sparkle + glint) + crack * 0.6 * pulse);
  }
  return glow * 1.6;
}
`;
