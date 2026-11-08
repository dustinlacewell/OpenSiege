// The Gerstner wave set on the water surface, and its GLSL constants. Pure.

/** One Gerstner wave. Lengths in world units, `speed` in world units per second. */
export interface Wave {
  /** Travel direction, radians from +x. */
  angle: number;
  wavelength: number;
  amplitude: number;
  /** 0..1: how sharp the crests are. The set's sum of steepness · k · amplitude must stay ≤ 1, or crests loop. */
  steepness: number;
}

/** Deep-water dispersion, tuned so the longest wave moves about 40 units a second: ω = √(G·k). */
export const WAVE_GRAVITY = 24;

/** A wind from the south-west: the long swell first, shorter chop spread round it. */
export const WAVES: readonly Wave[] = [
  { angle: 0.6, wavelength: 420, amplitude: 2.4, steepness: 0.55 },
  { angle: 0.2, wavelength: 265, amplitude: 1.5, steepness: 0.6 },
  { angle: 1.1, wavelength: 170, amplitude: 0.95, steepness: 0.6 },
  { angle: -0.3, wavelength: 112, amplitude: 0.55, steepness: 0.65 },
  { angle: 1.6, wavelength: 76, amplitude: 0.32, steepness: 0.7 },
];

/** Packed per wave: direction x, y, wavenumber k, angular speed ω. */
export function wavePhase(w: Wave): [number, number, number, number] {
  const k = (2 * Math.PI) / w.wavelength;
  return [Math.cos(w.angle), Math.sin(w.angle), k, Math.sqrt(WAVE_GRAVITY * k)];
}

/** Σ steepness · k · amplitude. Over 1, the crests fold through themselves. */
export function crestSharpness(waves: readonly Wave[]): number {
  return waves.reduce((s, w) => s + w.steepness * wavePhase(w)[2] * w.amplitude, 0);
}

/** GLSL: `WAVE_COUNT`, `WAVE_PHASE[i]` (dir.xy, k, ω) and `WAVE_SHAPE[i]` (amplitude, steepness). */
export function wavesGlsl(waves: readonly Wave[]): string {
  const f = (x: number): string => x.toFixed(6);
  const phase = waves.map((w) => `vec4(${wavePhase(w).map(f).join(", ")})`);
  const shape = waves.map((w) => `vec2(${f(w.amplitude)}, ${f(w.steepness)})`);
  return `
const int WAVE_COUNT = ${waves.length};
const vec4 WAVE_PHASE[${waves.length}] = vec4[](${phase.join(", ")});
const vec2 WAVE_SHAPE[${waves.length}] = vec2[](${shape.join(", ")});
`;
}
