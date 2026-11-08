// What a table editor edits: the fields, the sections, and the rules about them. Pure: no DOM, no fetch, no storage.
// A table is columns (units, cues) by fields (stats). A column may leave out fields. Such a cell shows blank and cannot be edited.

export type Value = number | boolean | string;
/** One column's values by field key. */
export type Row = Readonly<Record<string, Value>>;
/** Column id to its row. */
export type Table = Readonly<Record<string, Row>>;

interface FieldBase {
  key: string;
  label: string;
  section: string;
  /** What one step of the value is: "hp", "ticks", "ms". Empty when the label says it. */
  unit: string;
  help: string;
}

/** `decimals` 0 is a whole number. `step` is what one Up press adds (Shift is 10 times, Ctrl 100 times). */
export type NumberSpec = FieldBase & { type: "number"; min: number; max: number; decimals: number; step: number };
export type FieldSpec = NumberSpec | (FieldBase & { type: "bool" }) | (FieldBase & { type: "enum"; options: readonly string[] });

export interface SectionSpec { id: string; label: string }

/** Array order is row order and file order. */
export interface Schema { fields: readonly FieldSpec[]; sections: readonly SectionSpec[] }

/** What the dev server refused. `column` is null when the whole file is wrong, `field` is null when the whole column is. */
export interface Refusal { column: string | null; field: string | null; message: string }

/** The page's own rules. The core never reads a field's meaning, only these answers. */
export interface Rules {
  /** What is wrong with one cell alone, or undefined. */
  field(column: string, key: string, value: Value): string | undefined;
  /** Rules across fields, by field key. Run only when every field of the column passes `field`. */
  cross(column: string, row: Row): Readonly<Record<string, string>>;
  /** False when the column's other fields make this one do nothing. The cell is dimmed, not hidden. */
  relevant(row: Row, key: string): boolean;
}

export function specOf(schema: Schema, key: string): FieldSpec | undefined {
  return schema.fields.find((f) => f.key === key);
}

export function fieldsOfSection(schema: Schema, sectionId: string): FieldSpec[] {
  return schema.fields.filter((f) => f.section === sectionId);
}

/** `value` rounded to `decimals` places. Never -0. */
export function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals)) + 0;
}

export function notANumber(spec: NumberSpec): string {
  return spec.decimals === 0 ? "must be a whole number" : "must be a number";
}

/** The number a text means, or undefined while it is not a number yet. "0." and ".5" count for a decimal field. */
export function parseNumber(spec: NumberSpec, text: string): number | undefined {
  const t = text.trim();
  if (spec.decimals === 0) {
    const n = /^-?\d+$/.test(t) ? Number(t) + 0 : NaN;
    return Number.isSafeInteger(n) ? n : undefined;
  }
  const n = /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) + 0 : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** True when `value` is the right kind of thing for the field. Range is not checked. */
export function fitsType(spec: FieldSpec, value: unknown): boolean {
  if (spec.type === "bool") return typeof value === "boolean";
  if (spec.type === "enum") return typeof value === "string" && spec.options.includes(value);
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return spec.decimals > 0 || Number.isInteger(value);
}

/** What is wrong with a value for this field: its type, its range and its decimal places. For a page's `Rules.field`. */
export function specFieldError(spec: FieldSpec, value: unknown): string | undefined {
  if (spec.type === "bool") return typeof value === "boolean" ? undefined : "must be true or false";
  if (spec.type === "enum") return fitsType(spec, value) ? undefined : `must be one of ${spec.options.join(", ")}`;
  if (!fitsType(spec, value)) return notANumber(spec);
  const n = value as number;
  if (n < spec.min || n > spec.max) return `must be ${spec.min} to ${spec.max}`;
  if (roundTo(n, spec.decimals) !== n) return `must have at most ${spec.decimals} decimal place${spec.decimals === 1 ? "" : "s"}`;
  return undefined;
}

/** A value as text: a fixed count of places for a decimal field, plain otherwise. */
export function formatValue(spec: FieldSpec, v: Value): string {
  return spec.type === "number" && spec.decimals > 0 && typeof v === "number" ? v.toFixed(spec.decimals) : String(v);
}

/** A value as a number box shows it: as `formatValue`, except a number with more places than the field allows, which shows exactly as typed. */
export function cellText(spec: FieldSpec, v: Value): string {
  const overPrecise = spec.type === "number" && typeof v === "number" && roundTo(v, spec.decimals) !== v;
  return overPrecise ? String(v) : formatValue(spec, v);
}

/** A value for a label ("was 5", "Saved: on"): a switch reads on or off, the rest as `formatValue`. */
export function showValue(spec: FieldSpec, v: Value): string {
  return typeof v === "boolean" ? (v ? "on" : "off") : formatValue(spec, v);
}
