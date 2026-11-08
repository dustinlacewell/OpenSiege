import { AudioEngine } from "../../audio/audioEngine.ts";
import { DEFAULT_TUNING } from "../../audio/defaultTuning.ts";
import { byId } from "../../ui/dom.ts";
import { button, el } from "../build.ts";
import { restoreDraft } from "../tableEditor/model.ts";
import { TableEditor, type PageAdapter } from "../tableEditor/editor.ts";
import type { Table } from "../tableEditor/schema.ts";
import { soundRemote } from "./api.ts";
import { mountAudition } from "./auditionView.ts";
import { soundStore } from "./persist.ts";
import { GLOBAL_COLUMN } from "./soundTable.ts";
import { soundLabel, soundRules } from "./soundRules.ts";
import { SOUND_SCHEMA } from "./soundSchema.ts";
import "../tableEditor/editor.css";
import "./soundEditor.css";

// The dev-only sound tuning editor, served at /sounds.html by the Vite dev server.
if (!import.meta.env.DEV) throw new Error("The sound editor runs on the dev server only.");

async function main(): Promise<void> {
  const scroll = byId("scroll");
  const loaded = await soundRemote.load();
  if (!loaded.ok) {
    scroll.replaceChildren(el("p", "fatal", loaded.message), button("Retry", "", () => location.reload()));
    return;
  }
  // A cue's "at once" limit is checked against the draft's voice cap, so the rules read the draft. The editor draws
  // once while it is built, so the draft it starts from is worked out first.
  const cells = soundStore.loadDraft();
  let draft: Table = restoreDraft({ schema: SOUND_SCHEMA, rules: soundRules(() => undefined) }, loaded.table, cells).draft;
  const adapter: PageAdapter = {
    schema: SOUND_SCHEMA,
    rules: soundRules(() => numberOrUndefined(draft[GLOBAL_COLUMN]?.voiceCap)),
    remote: soundRemote,
    store: soundStore,
    labels: {
      title: "Sound tuning",
      filterPlaceholder: "Filter fields",
      savedMessage: "Saved. The game picks it up on reload.",
      columnLabel: soundLabel,
    },
  };
  const editor = new TableEditor(adapter, loaded.table, cells, {
    toolbar: byId("toolbar"),
    status: byId("status"),
    scroll,
    footer: byId("info"),
  });
  const audition = mountAudition(byId("audition"), new AudioEngine(DEFAULT_TUNING));
  audition.setDraft(draft);
  editor.onChange((next) => {
    draft = next;
    audition.setDraft(next);
  });
}

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

void main();
