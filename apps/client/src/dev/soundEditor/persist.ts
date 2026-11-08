import { TUNING_SECTIONS } from "../../audio/soundTuning.ts";
import { createLocalStore } from "../tableEditor/store.ts";

// The browser's copy of the sound editor's unsaved edits (`mf.soundEditor.draft`) and view settings (`mf.soundEditor.prefs`).

export const soundStore = createLocalStore("mf.soundEditor", TUNING_SECTIONS.map((s) => s.id));
