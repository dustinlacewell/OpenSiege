import { STAT_SECTIONS } from "@mf/sim";
import { createLocalStore } from "../tableEditor/store.ts";

// The browser's copy of the unit editor's unsaved edits (`mf.unitEditor.draft`) and view settings (`mf.unitEditor.prefs`).

export const unitStore = createLocalStore("mf.unitEditor", STAT_SECTIONS.map((s) => s.id));
