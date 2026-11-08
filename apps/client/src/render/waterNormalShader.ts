/**
 * Generates the tiling water detail texture once, on the GPU: a sum of small sine waves whose wave vectors are
 * whole numbers per tile, so the texture tiles exactly.
 * R, G: surface slope d/du, d/dv, packed 0..1 (unpack: (rg - 0.5) · 2). B: surface height 0..1, for foam break-up.
 */
export const WATER_NORMAL_FS = `#version 300 es
precision highp float;
uniform float u_size;
out vec4 o_color;

const float TAU = 6.28318530718;
const int COUNT = 40;

float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  float h = 0.0;
  vec2 grad = vec2(0.0);
  float ampSum = 0.0;
  float slopeSum = 0.0;
  for (int i = 0; i < COUNT; i++) {
    float n = float(i);
    float a = hash(n) * TAU;
    float freq = mix(3.0, 30.0, pow(hash(n + 0.37), 1.6));
    vec2 k = round(vec2(cos(a), sin(a)) * freq);
    if (k == vec2(0.0)) k = vec2(1.0, 0.0);
    float amp = 1.0 / pow(length(k), 1.2);
    float phase = TAU * dot(k, uv) + hash(n + 0.71) * TAU;
    h += amp * sin(phase);
    grad += amp * TAU * k * cos(phase);
    ampSum += amp;
    slopeSum += amp * TAU * length(k);
  }
  vec2 slope = clamp(grad / slopeSum * 3.0, -1.0, 1.0);
  o_color = vec4(slope * 0.5 + 0.5, clamp(0.5 + h / ampSum, 0.0, 1.0), 1.0);
}
`;
