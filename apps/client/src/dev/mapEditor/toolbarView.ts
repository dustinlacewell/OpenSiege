import { setDisabled, setText } from "../../ui/dom.ts";
import { button, el } from "../build.ts";

export interface ToolbarHandlers {
  onLevels(): void;
  onProps(): void;
  onSave(): void;
  onUndo(): void;
  onRedo(): void;
}

export interface ToolbarModel {
  /** Name, file and size, e.g. "Ridge  ridge.json  16000 x 16000, cell 125, base 300". */
  title: string;
  /** Edits not on disk yet. */
  unsaved: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/** The top bar: Maps, Properties, Save, the map title, Undo, Redo, and a status line for file results. */
export class ToolbarView {
  private readonly title = el("span", "title");
  private readonly undo: HTMLButtonElement;
  private readonly redo: HTMLButtonElement;
  private readonly save: HTMLButtonElement;
  private readonly status = el("div", "status");

  constructor(root: HTMLElement, h: ToolbarHandlers) {
    this.undo = button("Undo", "", h.onUndo, "Ctrl+Z");
    this.redo = button("Redo", "", h.onRedo, "Ctrl+Y or Ctrl+Shift+Z");
    this.save = button("Save", "primary", h.onSave, "Write the map to the maps folder");
    const bar = el("div", "bar");
    bar.append(
      el("h1", "", "Map editor"),
      button("Maps", "", h.onLevels, "Open another map, or make a new one"),
      button("Properties", "", h.onProps, "Name, size and base height"),
      this.save,
      this.title, el("span", "spacer"), this.undo, this.redo,
    );
    this.status.hidden = true;
    root.append(bar, this.status);
  }

  update(m: ToolbarModel): void {
    setText(this.title, m.unsaved ? `${m.title}  (unsaved)` : m.title);
    setDisabled(this.undo, !m.canUndo);
    setDisabled(this.redo, !m.canRedo);
  }

  /** A file result. An empty `text` hides the line. */
  showStatus(text: string, errors: readonly string[] = []): void {
    this.status.hidden = text === "";
    this.status.className = errors.length > 0 ? "status error" : "status";
    const list = el("ul", "errors");
    for (const e of errors) list.append(el("li", "", e));
    this.status.replaceChildren(el("span", "", text), ...(errors.length > 0 ? [list] : []));
  }
}
