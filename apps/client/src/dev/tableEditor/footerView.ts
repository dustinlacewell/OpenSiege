import { setText } from "../../ui/dom.ts";
import { el } from "../build.ts";
import { formatValue, showValue, specOf, type FieldSpec, type Schema, type Value } from "./schema.ts";

export interface FooterModel {
  field: string;
  /** The column of the focused or hovered cell, or null over a row label. */
  column: string | null;
  /** The saved value, or null over a row label or a cell the column does not have. */
  saved: Value | null;
  error: string | undefined;
}

/** The strip at the bottom: what the focused or hovered field is, what it may be, and its saved value. */
export class FooterView {
  private readonly name = el("b", "foot-name");
  private readonly key = el("code", "foot-key");
  private readonly help = el("span", "foot-help");
  private readonly range = el("span", "foot-range");
  private readonly saved = el("span", "foot-saved");
  private readonly error = el("span", "foot-error");

  constructor(root: HTMLElement, private readonly schema: Schema, private readonly columnLabel: (column: string) => string) {
    root.append(this.name, this.key, this.help, this.range, this.saved, this.error);
  }

  update(m: FooterModel | null): void {
    const spec = m ? specOf(this.schema, m.field) : undefined;
    setText(this.name, m && spec ? (m.column ? `${this.columnLabel(m.column)} · ${spec.label}` : spec.label) : "");
    setText(this.key, m?.field ?? "");
    setText(this.help, spec?.help ?? "");
    setText(this.range, spec ? legalRange(spec) : "");
    setText(this.saved, m && spec && m.saved !== null ? `Saved: ${showValue(spec, m.saved)}` : "");
    setText(this.error, m?.error ?? "");
  }
}

function legalRange(spec: FieldSpec): string {
  if (spec.type === "number") return `${formatValue(spec, spec.min)} to ${formatValue(spec, spec.max)}`;
  if (spec.type === "enum") return spec.options.join(" / ");
  return "on or off";
}
