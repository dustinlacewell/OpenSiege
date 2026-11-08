import { propsErrors, type MapProps } from "@mf/map";
import { button, el } from "../build.ts";

/** "new" lets every prop change. "edit" fixes the cell: a resize keeps the grid. */
export type PropsMode = "new" | "edit";

type NumberKey = "width" | "height" | "cell" | "baseHeight";

const FIELDS: { key: NumberKey; label: string; step: number }[] = [
  { key: "width", label: "Width", step: 1000 },
  { key: "height", label: "Height", step: 1000 },
  { key: "cell", label: "Cell", step: 1 },
  { key: "baseHeight", label: "Base height", step: 10 },
];

/**
 * A modal form for the map's props. `ask` resolves with the checked props, or null on Cancel. The form stays open
 * while the props are invalid and lists why.
 */
export class PropertiesView {
  private readonly dialog = el("dialog", "props");
  private readonly heading = el("h2");
  private readonly name = el("input");
  private readonly inputs = {} as Record<NumberKey, HTMLInputElement>;
  private readonly note = el("p", "note");
  private readonly errors = el("ul", "errors");
  private finish: (p: MapProps | null) => void = () => {};
  private mode: PropsMode = "new";
  private start: MapProps | null = null;

  constructor(root: HTMLElement) {
    const form = el("form");
    form.method = "dialog";
    form.append(this.heading, row("Name", this.name));
    for (const f of FIELDS) {
      const input = el("input");
      input.type = "number";
      input.step = String(f.step);
      input.addEventListener("input", () => this.showNote());
      this.inputs[f.key] = input;
      form.append(row(f.label, input));
    }
    const actions = el("div", "actions");
    // A submit button, so Enter in any field submits.
    const ok = button("OK", "primary", () => {});
    ok.type = "submit";
    actions.append(button("Cancel", "", () => this.close(null)), ok);
    form.append(this.note, this.errors, actions);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit();
    });
    this.dialog.addEventListener("cancel", () => this.finish(null));
    this.dialog.append(form);
    root.append(this.dialog);
  }

  ask(start: MapProps, mode: PropsMode): Promise<MapProps | null> {
    this.mode = mode;
    this.start = start;
    this.heading.textContent = mode === "new" ? "New map" : "Map properties";
    this.name.value = start.name;
    for (const f of FIELDS) this.inputs[f.key].value = String(start[f.key]);
    this.inputs.cell.disabled = mode === "edit";
    this.errors.replaceChildren();
    this.showNote();
    this.dialog.showModal();
    this.name.select();
    return new Promise((resolve) => (this.finish = resolve));
  }

  private submit(): void {
    const p = this.read();
    const errors = propsErrors(p);
    if (errors.length > 0) return this.errors.replaceChildren(...errors.map((e) => el("li", "", e)));
    this.close(p);
  }

  private close(p: MapProps | null): void {
    this.dialog.close();
    this.finish(p);
  }

  private read(): MapProps {
    const n = (k: NumberKey): number => Number(this.inputs[k].value);
    return { name: this.name.value.trim(), width: n("width"), height: n("height"), cell: n("cell"), baseHeight: n("baseHeight") };
  }

  /** Says what a resize does to the map. */
  private showNote(): void {
    const s = this.start;
    const p = this.read();
    const shrinks = this.mode === "edit" && s !== null && (p.width < s.width || p.height < s.height);
    const grows = this.mode === "edit" && s !== null && (p.width > s.width || p.height > s.height);
    const parts: string[] = [];
    if (shrinks) parts.push("Everything past the new edge is cut off.");
    if (grows) parts.push("New ground is flat, at the base height.");
    if (shrinks || grows) parts.push("A resize clears undo.");
    this.note.textContent = parts.join(" ");
    this.note.hidden = parts.length === 0;
  }
}

function row(label: string, input: HTMLInputElement): HTMLLabelElement {
  const r = el("label", "row");
  r.append(el("span", "name", label), input);
  return r;
}
