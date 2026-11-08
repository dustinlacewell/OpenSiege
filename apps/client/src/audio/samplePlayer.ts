import { echoed, type VoiceOut } from "./synthParts.ts";

/** Share of a sample sent to the outdoor echo. The samples carry their own land echoes, so it is small. */
const ECHO_SEND = 0.08;
/** Largest playback-rate change, either way. */
const RATE_SPREAD = 0.04;

/** Pure. A playback rate in [1 - RATE_SPREAD, 1 + RATE_SPREAD] from `rand` (0..1). */
export function jitterRate(rand: () => number): number {
  return 1 + RATE_SPREAD * (2 * rand() - 1);
}

/** Plays `buffer` at `rate` into the voice output and the echo send. Returns its length in seconds. */
export function playSample(v: VoiceOut, buffer: AudioBuffer, rate: number): number {
  const src = v.ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  src.connect(echoed(v, ECHO_SEND).out);
  src.start(v.t);
  return buffer.duration / rate;
}
