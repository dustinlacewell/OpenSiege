import { byId } from "../../ui/dom.ts";
import { button, el } from "../build.ts";
import { TableEditor, type PageAdapter } from "../tableEditor/editor.ts";
import { unitRemote } from "./api.ts";
import { unitStore } from "./persist.ts";
import { showPortraits } from "./portraits.ts";
import { UNIT_RULES, unitLabel } from "./unitRules.ts";
import { UNIT_SCHEMA } from "./unitSchema.ts";
import "../tableEditor/editor.css";

// The dev-only unit stat editor, served at /units.html by the Vite dev server.
if (!import.meta.env.DEV) throw new Error("The unit editor runs on the dev server only.");

const adapter: PageAdapter = {
  schema: UNIT_SCHEMA,
  rules: UNIT_RULES,
  remote: unitRemote,
  store: unitStore,
  labels: {
    title: "Unit stats",
    filterPlaceholder: "Filter stats",
    savedMessage: "Saved. The game picks it up on reload.",
    columnLabel: unitLabel,
  },
};

async function main(): Promise<void> {
  const scroll = byId("scroll");
  const loaded = await adapter.remote.load();
  if (!loaded.ok) {
    scroll.replaceChildren(el("p", "fatal", loaded.message), button("Retry", "", () => location.reload()));
    return;
  }
  const editor = new TableEditor(adapter, loaded.table, adapter.store.loadDraft(), {
    toolbar: byId("toolbar"),
    status: byId("status"),
    scroll,
    footer: byId("info"),
  });
  showPortraits((column) => editor.headerSlot(column));
}

void main();
