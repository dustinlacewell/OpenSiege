/**
 * Sunlight focused by the waves onto the ground under water. Pasted into the terrain fragment shader after
 * SCENE_FS. Two layers of a tiling warped-sine pattern, at different scales, speeds and angles.
 */
export const CAUSTIC_GLSL = `
const float CAUSTIC_TAU = 6.28318;

/** One layer, 0..1: bright thin lines. Tiles every 1 in p. */
float causticLayer(vec2 p, float t) {
  vec2 q = mod(p * CAUSTIC_TAU, CAUSTIC_TAU) - 250.0;
  vec2 i = q;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / 0.005), q.y / (cos(i.y + tt) / 0.005)));
  }
  c = 1.17 - pow(c / 4.0, 1.4);
  return pow(abs(c), 8.0);
}

/** Extra sunlight on ground \`depth\` units under the surface. 0 at and above the surface, fading with depth. */
vec3 caustics(vec3 albedo, vec3 n, vec3 world, float depth, float shadow, float t) {
  if (depth <= 0.0) return vec3(0.0);
  float a = causticLayer(world.xy / 190.0, t * 0.55);
  float b = causticLayer(mat2(0.8, -0.6, 0.6, 0.8) * world.xy / 117.0, t * 0.8 + 3.0);
  float fade = smoothstep(0.0, 4.0, depth) * exp(-depth / 45.0);
  return albedo * SUN_RGB * max(dot(n, u_sun), 0.0) * shadow * (a * 0.6 + b * 0.4) * fade * 0.9;
}
`;
