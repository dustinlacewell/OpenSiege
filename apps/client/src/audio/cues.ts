/** A sound the world makes, found by comparing world states between sim steps. */
export type WorldCue =
  | "shotDirect"
  | "shotBallistic"
  | "shellGround"
  | "shellArmor"
  | "roundGround"
  | "roundArmor"
  | "destroyed"
  | "built"
  | "underAttack"
  | "deploy"
  | "pack"
  | "credits";

/** A sound the interface makes when the player acts. */
export type UiCue = "ack" | "queued" | "refused" | "select";

export type Cue = WorldCue | UiCue;

/** The weapon cues. They play samples rendered from a recipe (`recipes.ts`), not live synths. */
export type SampledCue = "shotDirect" | "shotBallistic" | "shellGround" | "shellArmor" | "roundGround" | "roundArmor";

/** The cues made live from Web Audio nodes (`synthVoices.ts`). */
export type SynthCue = Exclude<Cue, SampledCue>;

export const SAMPLED_CUES: readonly SampledCue[] = ["shotDirect", "shotBallistic", "shellGround", "shellArmor", "roundGround", "roundArmor"];

export function isSampled(cue: Cue): cue is SampledCue {
  return (SAMPLED_CUES as readonly Cue[]).includes(cue);
}

/** One thing that happened this step. `size` is 0..1. */
export interface SoundEvent {
  cue: WorldCue;
  x: number;
  y: number;
  /** False: plays centred at full gain, wherever the camera is (alerts, economy). */
  spatial: boolean;
  /** True when it happened at an own unit. Own events skip the fog test. */
  own: boolean;
  size: number;
}

/** A sound ready to play: the mixer's output, the synth's input. */
export interface Voice {
  cue: Cue;
  /** 0 up to `GlobalTuning.maxGain`. Merged events play louder. */
  gain: number;
  /** Stereo pan, -1 left .. +1 right. */
  pan: number;
  size: number;
}

/** Plays voices. The audio engine is the real one. */
export interface VoiceSink {
  play(voice: Voice): void;
}

/** The narrow seam for interface sounds. Actions-side code depends on this, not on Web Audio. */
export interface UiSounds {
  ui(cue: UiCue): void;
}
