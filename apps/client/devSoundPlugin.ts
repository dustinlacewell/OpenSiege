import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { parseSoundTuning, serializeSoundTuning } from "./src/audio/soundTuning.ts";
import { devJsonPlugin } from "./devJsonPlugin.ts";

/**
 * The sound tuning editor's route: `/__dev/sound-tuning` reads and writes `soundTuning.json`. A PUT body is checked
 * with the audio core's own rules (`parseSoundTuning`) before it is written.
 */
export function devSoundPlugin(): Plugin {
  return devJsonPlugin({
    name: "dev-sound-tuning",
    route: "/__dev/sound-tuning",
    file: fileURLToPath(new URL("./src/audio/soundTuning.json", import.meta.url)),
    parse(json) {
      const parsed = parseSoundTuning(json);
      return parsed.ok ? { ok: true, value: parsed.tuning } : { ok: false, errors: parsed.errors };
    },
    serialize: serializeSoundTuning,
  });
}
