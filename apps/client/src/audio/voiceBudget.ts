import type { Cue } from "./cues.ts";
import type { SoundTuning } from "./soundTuning.ts";

/** How many voices sound now, in all and per cue. */
export interface ActiveCount {
  total: number;
  byCue: ReadonlyMap<Cue, number>;
}

/** `play`: start the voice. The others name why it is dropped. */
export type Verdict = "play" | "cueFull" | "capFull" | "reserved";

/** Pure. May a new voice of this cue start now? The first rule that fails drops it. */
export function admit(cue: Cue, t: SoundTuning, active: ActiveCount): Verdict {
  const c = t.cues[cue];
  const g = t.global;
  if ((active.byCue.get(cue) ?? 0) >= c.atOnceLimit) return "cueFull";
  if (active.total >= g.voiceCap) return "capFull";
  if (active.total >= g.voiceCap - g.reservedSlots && c.rank < g.protectedRank) return "reserved";
  return "play";
}
