import { setHidden } from "../../ui/dom.ts";

/** A column's header: an empty slot the page fills (a headshot, an icon), the name, and a reset button that shows when the column has edits. */
export class ColumnHeaderView {
  readonly th = document.createElement("th");
  /** The page puts its own art here. */
  readonly slot = document.createElement("div");
  private readonly reset = document.createElement("button");

  constructor(column: string, label: string, onReset: () => void) {
    this.slot.className = "header-slot";
    const name = document.createElement("span");
    name.className = "column-name";
    name.textContent = label;
    this.reset.type = "button";
    this.reset.className = "column-reset";
    this.reset.textContent = "Reset";
    this.reset.title = `Revert every change to ${label}`;
    this.reset.addEventListener("click", onReset);
    this.th.scope = "col";
    this.th.dataset.column = column;
    this.th.append(this.slot, name, this.reset);
  }

  update(hasChanges: boolean): void {
    setHidden(this.reset, !hasChanges);
  }
}
