/**
 * Generates the tiling ground detail texture once, on the GPU. Every noise is periodic over the tile.
 * R, G: detail normal slope (x, y), packed 0..1. B: height of soil and pebbles. A: independent mottling.
 */
export const DETAIL_FS = `#version 300 es
precision highp float;
uniform float u_size;
out vec4 o_color;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
  return vec2(hash(p), hash(p + 19.19));
}

float vnoise(vec2 p, float period, float seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(mod(i, period) + seed);
  float b = hash(mod(i + vec2(1.0, 0.0), period) + seed);
  float c = hash(mod(i + vec2(0.0, 1.0), period) + seed);
  float d = hash(mod(i + vec2(1.0, 1.0), period) + seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 uv, float seed) {
  float sum = 0.0;
  float amp = 0.5;
  float period = 8.0;
  for (int k = 0; k < 7; k++) {
    sum += amp * vnoise(uv * period, period, seed + float(k) * 7.0);
    period *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

/** 1 inside a pebble, 0 in the gaps between. */
float pebbles(vec2 uv) {
  float period = 40.0;
  vec2 p = uv * period;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = vec2(x, y);
      float d = length(c + hash2(mod(i + c, period)) - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return smoothstep(0.0, 0.3, d2 - d1);
}

float height(vec2 uv) {
  return fbm(uv, 0.0) * 0.75 + pebbles(uv) * 0.25;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  float e = 1.0 / u_size;
  float h = height(uv);
  vec2 slope = vec2(height(uv + vec2(e, 0.0)) - height(uv - vec2(e, 0.0)), height(uv + vec2(0.0, e)) - height(uv - vec2(0.0, e)));
  slope = clamp(-slope / (2.0 * e) / 40.0, -1.0, 1.0);
  o_color = vec4(slope * 0.5 + 0.5, h, fbm(uv + 0.37, 101.0));
}
`;
