import type { SampledCue } from "./cues.ts";

/** Main thread to worker: render one weapon sound. `sr` is the sample rate. */
export interface RenderRequest {
  id: number;
  cue: SampledCue;
  seed: number;
  size: number;
  sr: number;
}

/** Worker to main thread: the rendered sound for request `id`. `samples` is transferred, not copied. */
export interface RenderResult {
  id: number;
  samples: Float32Array<ArrayBuffer>;
}
