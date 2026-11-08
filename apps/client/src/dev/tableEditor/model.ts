import {
  fitsType, notANumber, parseNumber, roundTo, specOf, type Refusal, type Rules, type Schema, type Table, type Value,
} from "./schema.ts";

// The table editor's state and the operations on it. Pure: no DOM, no fetch, no storage.
// `draft` is the whole table with the user's edits in it. `saved` is the file as the dev server last gave it.
// A cell a column leaves out (a ragged table) has no value: no operation here creates, edits or counts it.

/** The schema and the page's rules, carried by the state so every operation can read them. */
export interface EditorSpec { schema: Schema; rules: Rules }

/** One undoable step. Typing in one cell is one step. */
export interface Edit { column: string; field: string; before: Value; after: Value }
type Batch = readonly Edit[];

export interface EditorState {
  readonly spec: EditorSpec;
  readonly saved: Table;
  readonly draft: Table;
  readonly undo: readonly Batch[];
  readonly redo: readonly Batch[];
  /** Text in a number cell that is not a number yet, by cell id. The draft keeps the last legal value. */
  readonly raw: Readonly<Record<string, string>>;
  /** What the dev server refused on the last save. A cell's entry goes when the cell is edited. */
  readonly remote: readonly Refusal[];
  /** True once the user moved on: the next edit starts a new undo step instead of joining the last one. */
  readonly sealed: boolean;
}

/** A cell whose draft differs from the saved file. */
export interface Change { column: string; field: string; saved: Value; value: Value }

/** A cell as stored in the draft backup. Untrusted: `restoreDraft` checks it. */
export interface DraftCell { column: string; field: string; value: unknown }

export function cellId(column: string, field: string): string {
  return `${column}.${field}`;
}

export function createEditor(spec: EditorSpec, saved: Table): EditorState {
  return { spec, saved, draft: saved, undo: [], redo: [], raw: {}, remote: [], sealed: false };
}

export function columnsOf(s: EditorState): string[] {
  return Object.keys(s.saved);
}

/** True when the column exists and has a value for the field. */
export function hasCell(t: Table, column: string, field: string): boolean {
  return Object.hasOwn(t, column) && Object.hasOwn(t[column]!, field);
}

/** The saved file replaced by `saved`: edits, history and refusals all start over. */
export function applySaved(s: EditorState, saved: Table): EditorState {
  return createEditor(s.spec, saved);
}

/** The draft backup applied on top of `saved`. Cells that no longer exist or no longer differ are dropped. */
export function restoreDraft(spec: EditorSpec, saved: Table, cells: readonly DraftCell[]): EditorState {
  let s = createEditor(spec, saved);
  for (const c of cells) {
    const field = specOf(spec.schema, c.field);
    if (!field || !hasCell(saved, c.column, c.field) || !fitsType(field, c.value)) continue;
    s = seal(setValue(s, c.column, c.field, c.value as Value));
  }
  return s;
}

/** Sets a cell. Edits to the same cell join one undo step until `seal`. */
export function setValue(s: EditorState, column: string, field: string, value: Value): EditorState {
  if (!hasCell(s.draft, column, field)) return s;
  const current = s.draft[column]![field]!;
  const base = clearCell(s, column, field);
  if (current === value) return base;
  const history = record(base, { column, field, before: current, after: value });
  return { ...base, ...history, draft: withCell(base.draft, column, field, value), redo: [] };
}

/** A number cell moved by `delta` steps of its field, kept inside its legal range. Starts from the draft value, not from unparsed text. */
export function stepValue(s: EditorState, column: string, field: string, delta: number): EditorState {
  const spec = specOf(s.spec.schema, field);
  if (!spec || spec.type !== "number" || !hasCell(s.draft, column, field)) return s;
  const moved = roundTo((s.draft[column]![field] as number) + delta * spec.step, spec.decimals);
  return setValue(s, column, field, Math.min(spec.max, Math.max(spec.min, moved)));
}

/** Number cell text. A number is committed. Anything else is kept as text, and the draft is left alone. */
export function typeText(s: EditorState, column: string, field: string, text: string): EditorState {
  const spec = specOf(s.spec.schema, field);
  if (!spec || spec.type !== "number" || !hasCell(s.draft, column, field)) return s;
  const n = parseNumber(spec, text);
  if (n !== undefined) return setValue(s, column, field, n);
  const id = cellId(column, field);
  if (s.raw[id] === text) return s;
  return { ...s, raw: { ...s.raw, [id]: text }, remote: withoutCell(s.remote, column, field) };
}

/** Ends the current undo step. Call when focus leaves a cell. */
export function seal(s: EditorState): EditorState {
  return s.sealed ? s : { ...s, sealed: true };
}

export function revertCell(s: EditorState, column: string, field: string): EditorState {
  return revert(s, changedCells(s).filter((c) => c.column === column && c.field === field), (id) => id === cellId(column, field));
}

export function revertColumn(s: EditorState, column: string): EditorState {
  return revert(s, changedCells(s).filter((c) => c.column === column), (id) => id.startsWith(`${column}.`));
}

export function revertAll(s: EditorState): EditorState {
  return revert(s, changedCells(s), () => true);
}

export function undo(s: EditorState): EditorState {
  const batch = s.undo.at(-1);
  if (!batch) return s;
  const draft = [...batch].reverse().reduce((t, e) => withCell(t, e.column, e.field, e.before), s.draft);
  return { ...dropCells(s, batch), draft, undo: s.undo.slice(0, -1), redo: [...s.redo, batch], sealed: true };
}

export function redo(s: EditorState): EditorState {
  const batch = s.redo.at(-1);
  if (!batch) return s;
  const draft = batch.reduce((t, e) => withCell(t, e.column, e.field, e.after), s.draft);
  return { ...dropCells(s, batch), draft, redo: s.redo.slice(0, -1), undo: [...s.undo, batch], sealed: true };
}

/** Every cell that differs from the saved file, columns in table order, fields in schema order. */
export function changedCells(s: EditorState): Change[] {
  const out: Change[] = [];
  for (const column of columnsOf(s)) {
    for (const { key: field } of s.spec.schema.fields) {
      if (!hasCell(s.saved, column, field) || !hasCell(s.draft, column, field)) continue;
      const saved = s.saved[column]![field]!;
      const value = s.draft[column]![field]!;
      if (saved !== value) out.push({ column, field, saved, value });
    }
  }
  return out;
}

/** The table to send to the dev server. */
export function merged(s: EditorState): Table {
  return s.draft;
}

/** What is wrong with each cell, by cell id: unparsed text, the field rules, then the rules across fields. */
export function errorsOf(s: EditorState): Record<string, string> {
  const { schema, rules } = s.spec;
  const out: Record<string, string> = {};
  for (const column of columnsOf(s)) {
    const row = s.draft[column]!;
    let fieldsOk = true;
    for (const spec of schema.fields) {
      if (!Object.hasOwn(row, spec.key)) continue;
      const id = cellId(column, spec.key);
      const found = rules.field(column, spec.key, row[spec.key]!);
      if (found) { out[id] = found; fieldsOk = false; }
      if (spec.type === "number" && id in s.raw) out[id] = notANumber(spec);
    }
    if (!fieldsOk) continue;
    for (const [field, message] of Object.entries(rules.cross(column, row))) out[cellId(column, field)] ??= message;
  }
  return out;
}

/** The dev server's refusals that name a cell, by cell id. */
export function remoteCells(s: EditorState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of s.remote) if (e.column && e.field) out[cellId(e.column, e.field)] ??= e.message;
  return out;
}

export function withServerErrors(s: EditorState, errors: readonly Refusal[]): EditorState {
  return { ...s, remote: errors };
}

function withCell(t: Table, column: string, field: string, value: Value): Table {
  return { ...t, [column]: { ...t[column], [field]: value } };
}

function withoutCell(errors: readonly Refusal[], column: string, field: string): Refusal[] {
  return errors.filter((e) => !(e.column === column && e.field === field));
}

/** `s` with a cell's unparsed text and dev server refusal removed. */
function clearCell(s: EditorState, column: string, field: string): EditorState {
  const id = cellId(column, field);
  const hasRaw = id in s.raw;
  const remote = withoutCell(s.remote, column, field);
  if (!hasRaw && remote.length === s.remote.length) return s;
  const { [id]: _gone, ...raw } = s.raw;
  return { ...s, raw: hasRaw ? raw : s.raw, remote };
}

function dropCells(s: EditorState, batch: Batch): EditorState {
  return batch.reduce((acc, e) => clearCell(acc, e.column, e.field), s);
}

/** The undo stack after `edit`: merged into the last step when it is the same cell and not sealed. */
function record(s: EditorState, edit: Edit): { undo: readonly Batch[]; sealed: boolean } {
  const top = s.undo.at(-1)?.[0];
  const joins = !s.sealed && s.undo.at(-1)?.length === 1 && top !== undefined && top.column === edit.column && top.field === edit.field;
  if (!joins) return { undo: [...s.undo, [edit]], sealed: false };
  const whole = { ...top, after: edit.after };
  const rest = s.undo.slice(0, -1);
  return { undo: whole.before === whole.after ? rest : [...rest, [whole]], sealed: false };
}

/** Puts `changes` back to their saved values as one undo step. `inScope` picks which unparsed texts go too. */
function revert(s: EditorState, changes: readonly Change[], inScope: (id: string) => boolean): EditorState {
  const raw = Object.fromEntries(Object.entries(s.raw).filter(([id]) => !inScope(id)));
  const remote = s.remote.filter((e) => !inScope(cellId(e.column ?? "", e.field ?? "")));
  const kept = { ...s, raw, remote };
  if (changes.length === 0) return kept;
  const batch: Batch = changes.map((c) => ({ column: c.column, field: c.field, before: c.value, after: c.saved }));
  const draft = batch.reduce((t, e) => withCell(t, e.column, e.field, e.after), s.draft);
  return { ...kept, draft, undo: [...s.undo, batch], redo: [], sealed: true };
}
