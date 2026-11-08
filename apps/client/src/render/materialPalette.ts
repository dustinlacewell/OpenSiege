/** An sRGB colour, each channel 0..255. */
export type Srgb8 = readonly [number, number, number];

/** The four colours of a material layer, one per weight channel. */
export type MaterialPalette = readonly [Srgb8, Srgb8, Srgb8, Srgb8];

/** The gamma the ground shader's `toLinear` uses; the palette must match it so a colour reads the same either way. */
const GAMMA = 2.2;

/** One sRGB channel, 0..255, to linear 0..1. Out-of-range input is clamped. */
export function srgbToLinear(c: number): number {
  return Math.pow(Math.min(255, Math.max(0, c)) / 255, GAMMA);
}

/** Packs the palette as `u_palette[4]` (four linear vec3s, twelve floats). */
export function packPalette(palette: MaterialPalette, out: Float32Array = new Float32Array(12)): Float32Array {
  for (let k = 0; k < 4; k++) {
    for (let c = 0; c < 3; c++) out[k * 3 + c] = srgbToLinear(palette[k]![c]!);
  }
  return out;
}
