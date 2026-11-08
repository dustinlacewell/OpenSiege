import { setDisabled, setText } from "../../ui/dom.ts";
import { button, el } from "../build.ts";

export interface ToolbarHandlers {
  onFilter(text: string): void;
  onChangedOnly(on: boolean): void;
  onUndo(): void;
  onRedo(): void;
  onRevertAll(): void;
  onSave(): void;
}

export interface ToolbarModel {
  filter: string;
  changedOnly: boolean;
  /** Cells that differ from the saved file. */
  changes: number;
  canUndo: boolean;
  canRedo: boolean;
  canRevert: boolean;
  canSave: boolean;
  saving: boolean;
  /** Why Save is off, shown as its tooltip. */
  saveHint: string;
}

/** The top bar: title, filter, changed-only switch, change count, undo, redo, revert all and save. */
export class ToolbarView {
  private readonly filter = el("input", "filter");
  private readonly changedOnly = el("input");
  private readonly count = el("span", "count");
  private readonly undo: HTMLButtonElement;
  private readonly redo: HTMLButtonElement;
  private readonly revert: HTMLButtonElement;
  private readonly save: HTMLButtonElement;

  constructor(root: HTMLElement, h: ToolbarHandlers, title: string, filterPlaceholder: string) {
    this.filter.type = "text";
    this.filter.placeholder = filterPlaceholder;
    this.filter.title = "Matches the name, the key and the help text. Press / to focus.";
    this.filter.setAttribute("aria-label", filterPlaceholder);
    this.filter.autocomplete = "off";
    this.filter.spellcheck = false;
    this.filter.addEventListener("input", () => h.onFilter(this.filter.value));
    this.changedOnly.type = "checkbox";
    this.changedOnly.addEventListener("change", () => h.onChangedOnly(this.changedOnly.checked));
    const toggle = el("label", "toggle");
    toggle.append(this.changedOnly, el("span", "", "Changed only"));
    this.undo = button("Undo", "", h.onUndo, "Ctrl+Z");
    this.redo = button("Redo", "", h.onRedo, "Ctrl+Y or Ctrl+Shift+Z");
    this.revert = button("Revert all", "", h.onRevertAll, "Put every cell back to the saved value");
    this.save = button("Save", "primary", h.onSave);
    root.append(el("h1", "", title), this.filter, toggle, this.count, el("span", "spacer"), this.undo, this.redo, this.revert, this.save);
  }

  update(m: ToolbarModel): void {
    if (this.filter.value !== m.filter) this.filter.value = m.filter;
    if (this.changedOnly.checked !== m.changedOnly) this.changedOnly.checked = m.changedOnly;
    setText(this.count, m.changes === 0 ? "Saved" : `${m.changes} unsaved change${m.changes === 1 ? "" : "s"}`);
    setDisabled(this.undo, !m.canUndo);
    setDisabled(this.redo, !m.canRedo);
    setDisabled(this.revert, !m.canRevert);
    setDisabled(this.save, !m.canSave || m.saving);
    this.save.title = m.canSave ? "Ctrl+S" : m.saveHint;
  }

  focusFilter(): void {
    this.filter.focus();
    this.filter.select();
  }
}
