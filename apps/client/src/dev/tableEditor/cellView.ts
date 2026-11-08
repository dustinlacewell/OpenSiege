import { setHidden, setText } from "../../ui/dom.ts";
import { setClass, setWidthPct } from "../../ui/domStyle.ts";
import { cellText, showValue, type FieldSpec, type Value } from "./schema.ts";

export interface CellRef { column: string; field: string }

/** What a cell asks of the editor. Every call carries the cell's own ref. */
export interface CellHost {
  type(c: CellRef, text: string): void;
  set(c: CellRef, value: Value): void;
  /** Add `delta` steps of the field to the number. */
  step(c: CellRef, delta: number): void;
  revert(c: CellRef): void;
  /** Focus the same column's cell this many visible rows down (negative: up). */
  move(c: CellRef, rows: number): void;
  /** Focus entered the cell, or left it (null). */
  focus(c: CellRef | null): void;
}

/** Everything a cell shows. */
export interface CellModel {
  value: Value;
  saved: Value;
  /** Number text that is not a number yet. */
  raw: string | undefined;
  error: string | undefined;
  relevant: boolean;
  /** Share of the row's largest number, 0 to 1. */
  bar: number;
}

type Control = HTMLInputElement | HTMLSelectElement;
type Type = FieldSpec["type"];

/** One cell of the matrix: a number box, a switch or a select, with its "was" note, revert button and bar. Built once, updated in place. */
export class CellView {
  readonly td = document.createElement("td");
  readonly control: Control;
  private readonly was = document.createElement("span");
  private readonly revert = document.createElement("button");
  private readonly fill: HTMLElement | null;
  private focused = false;

  constructor(private readonly ref: CellRef, private readonly spec: FieldSpec, ariaLabel: string, private readonly host: CellHost) {
    this.control = spec.type === "enum" ? makeSelect(spec.options) : makeInput(spec.type === "bool", spec.type === "number" && spec.decimals > 0);
    this.control.setAttribute("aria-label", ariaLabel);
    this.was.className = "was";
    this.revert.type = "button";
    this.revert.className = "revert";
    this.revert.tabIndex = -1;
    this.revert.title = "Revert to saved";
    this.revert.textContent = "↺";
    const slot = document.createElement("div");
    slot.className = spec.type === "bool" ? "slot switch" : "slot";
    slot.append(spec.type === "bool" ? switchTrack(this.control) : this.control);
    this.td.append(slot, this.was, this.revert);
    this.fill = spec.type === "number" ? addBar(this.td) : null;
    this.td.dataset.column = ref.column;
    this.td.dataset.field = ref.field;
    this.wire(spec.type);
  }

  update(m: CellModel): void {
    const changed = m.value !== m.saved;
    setClass(this.td, ["cell", changed && "changed", m.error && "invalid", !m.relevant && "dim", this.focused && "focused"].filter(Boolean).join(" "));
    this.td.title = m.error ?? "";
    setText(this.was, changed ? `was ${showValue(this.spec, m.saved)}` : "");
    setHidden(this.revert, !changed);
    if (this.fill) setWidthPct(this.fill, m.bar * 100);
    if (m.error !== undefined) this.control.setAttribute("aria-invalid", "true");
    else this.control.removeAttribute("aria-invalid");
    this.write(m);
  }

  /** Writes the control. A number box being typed in keeps its text while it still means the draft value. */
  private write(m: CellModel): void {
    const c = this.control;
    if (c instanceof HTMLSelectElement) { c.value = String(m.value); return; }
    if (c.type === "checkbox") { c.checked = m.value === true; return; }
    const text = m.raw ?? cellText(this.spec, m.value);
    const typing = this.focused && (m.raw !== undefined ? c.value === m.raw : Number(c.value.trim()) === m.value && c.value.trim() !== "");
    if (!typing && c.value !== text) c.value = text;
  }

  private wire(type: Type): void {
    const { ref, host, control } = this;
    this.td.addEventListener("focusin", () => { this.focused = true; host.focus(ref); });
    this.td.addEventListener("focusout", () => { this.focused = false; host.focus(null); });
    this.td.addEventListener("mousedown", (e) => {
      if (e.target === this.td || e.target === this.was) { e.preventDefault(); control.focus(); }
    });
    this.revert.addEventListener("mousedown", (e) => e.preventDefault());
    this.revert.addEventListener("click", () => host.revert(ref));
    control.addEventListener("keydown", (e) => this.onKey(e as KeyboardEvent, type));
    if (type === "number") wireNumber(control as HTMLInputElement, (text) => host.type(ref, text));
    else if (type === "bool") control.addEventListener("change", () => host.set(ref, (control as HTMLInputElement).checked));
    else control.addEventListener("change", () => host.set(ref, control.value));
  }

  private onKey(e: KeyboardEvent, type: Type): void {
    const down = e.key === "ArrowDown";
    if ((e.key === "ArrowUp" || down) && e.altKey) { e.preventDefault(); this.host.move(this.ref, down ? 1 : -1); return; }
    if (e.key === "Enter") { e.preventDefault(); this.host.move(this.ref, e.shiftKey ? -1 : 1); return; }
    if (type === "number" && (e.key === "ArrowUp" || down)) {
      e.preventDefault();
      this.host.step(this.ref, (down ? -1 : 1) * (e.ctrlKey ? 100 : e.shiftKey ? 10 : 1));
    }
  }
}

function makeInput(isSwitch: boolean, decimal: boolean): HTMLInputElement {
  const input = document.createElement("input");
  if (isSwitch) { input.type = "checkbox"; return input; }
  input.type = "text";
  input.inputMode = decimal ? "decimal" : "numeric";
  input.autocomplete = "off";
  input.spellcheck = false;
  return input;
}

function makeSelect(options: readonly string[]): HTMLSelectElement {
  const select = document.createElement("select");
  for (const o of options) select.append(new Option(o, o));
  return select;
}

/** The checkbox inside a label with a drawn track, so it is a real control that looks like a switch. */
function switchTrack(input: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  const track = document.createElement("span");
  track.className = "track";
  label.append(input, track);
  return label;
}

function addBar(td: HTMLElement): HTMLElement {
  const bar = document.createElement("div");
  const fill = document.createElement("div");
  bar.className = "bar";
  fill.className = "bar-fill";
  bar.append(fill);
  td.append(bar);
  return fill;
}

/** Sends the text on every keystroke. A click or tab into the box selects its text, so typing replaces it. */
function wireNumber(input: HTMLInputElement, onText: (text: string) => void): void {
  let justFocused = false;
  input.addEventListener("input", () => onText(input.value));
  input.addEventListener("focus", () => { justFocused = true; input.select(); });
  input.addEventListener("mouseup", (e) => { if (justFocused) e.preventDefault(); justFocused = false; });
  input.addEventListener("keydown", () => { justFocused = false; });
}
