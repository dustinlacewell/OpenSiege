import { parseSoundTuning, type TuningError } from "../../audio/soundTuning.ts";
import { createHttpRemote, type Codec } from "../tableEditor/store.ts";
import { tableToJson, tuningToTable } from "./soundTable.ts";

// The dev server's tuning file route (`apps/client/devSoundPlugin.ts`). The file is a `SoundTuning`; the editor edits a table.
// The conversion happens here, at the edge. The dev server names a refused cell by `column` and `field`, as the editor does.

const soundCodec: Codec = {
  decode(json) {
    const parsed = parseSoundTuning(json);
    if (!parsed.ok) throw new Error(`soundTuning.json is invalid: ${parsed.errors.map((e) => e.message).join(" ")}`);
    return tuningToTable(parsed.tuning);
  },
  encode: tableToJson,
};

export const soundRemote = createHttpRemote("/__dev/sound-tuning", (e: TuningError) => e, soundCodec);
