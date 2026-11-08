import tuningFile from "./soundTuning.json" with { type: "json" };
import { parseSoundTuning, type SoundTuning } from "./soundTuning.ts";

/** The shipped tuning, loaded and checked once. A bad file throws at startup. */
export const DEFAULT_TUNING: SoundTuning = load(tuningFile);

function load(file: unknown): SoundTuning {
  const result = parseSoundTuning(file);
  if (result.ok) return result.tuning;
  throw new Error(`soundTuning.json is invalid:\n${result.errors.map((e) => `${e.column ?? "-"}.${e.field ?? "-"}: ${e.message}`).join("\n")}`);
}
