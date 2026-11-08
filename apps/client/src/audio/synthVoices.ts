import type { SynthCue } from "./cues.ts";
import { echoed, noise, rumble, saturate, tone, type VoiceOut } from "./synthParts.ts";

/** Schedules one sound at `v.t`. `size` is 0..1. Returns its length in seconds. */
export type Synth = (v: VoiceOut, size: number) => number;

/** One synth per live cue. Peaks set the loudness of each cue against the others. The weapon cues are samples (`recipes.ts`). */
export const SYNTHS: Record<SynthCue, Synth> = {
  // Explosion: a boom is "bwoom", not "ksh"; the "ksh" is noise between 1 and 4 kHz, so it keeps almost none of it.
  // A tiny dull click (without it the boom sounds underwater), a falling sine (the "bwoom"), a heavy low noise body,
  // a long uneven rumble, and a late aftershock. The sine and body go through `saturate`, so phone speakers carry them.
  // Noise peaks look large because low-passed noise is quiet. The layers sum to well under full scale.
  destroyed: (v, size) => {
    const air = echoed(v, 0.12);
    const hot = saturate(air);
    return Math.max(
      rumble(air, 500, 200, 9 * size, 0.03, 0.05, 0.010, 0),
      rumble(hot, 1400, 600, 6 * size, 1.5 * size, 0.007, 0.03, 0.05),
      rumble(hot, 1800, 1450, 7 * size, 1 * size, 0.003, 0.03, 0.05),
      tone(hot, "sine", 100, 30, 1 * size, 1.4 * size),
    );
  },

  built: (v) => Math.max(tone(v, "sine", 660, 660, 0.18, 0.12), tone(v, "sine", 990, 990, 0.18, 0.18, 0.11)),

  underAttack: (v) =>
    Math.max(
      tone(v, "triangle", 440, 440, 0.2, 0.12),
      tone(v, "triangle", 330, 330, 0.2, 0.12, 0.15),
      tone(v, "triangle", 440, 440, 0.2, 0.12, 0.3),
    ),

  deploy: (v) => Math.max(tone(v, "square", 130, 55, 0.12, 0.07), noise(v, "bandpass", 400, 0.35, 0.12, 0.02)),

  pack: (v) => Math.max(noise(v, "bandpass", 400, 0.35, 0.12), tone(v, "square", 55, 130, 0.12, 0.07, 0.05)),

  credits: (v) => tone(v, "sine", 1320, 1320, 0.06, 0.06),

  ack: (v) => tone(v, "sine", 880, 880, 0.08, 0.05),

  queued: (v) => tone(v, "sine", 740, 1100, 0.1, 0.08),

  refused: (v) => tone(v, "square", 180, 150, 0.06, 0.18),

  select: (v) => Math.max(noise(v, "highpass", 4000, 0.06, 0.02), tone(v, "sine", 1200, 1200, 0.04, 0.03)),
};
