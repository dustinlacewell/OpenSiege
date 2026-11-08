import { STAT_FIELDS, STAT_KEYS } from "./statFields.ts";
import type { UnitStats } from "./stats.ts";
import type { UnitKind } from "./types.ts";

// Checks and writes `data/unitStats.json`. Pure: the file read and write live at the edge
// (the `stats.ts` import, and the dev server's save route).

/** One thing wrong with the data. `field` is null when the whole kind (or the file) is wrong. */
export interface StatError {
  kind: string | null;
  field: keyof UnitStats | null;
  message: string;
}

export type ParsedStats = { ok: true; stats: Record<UnitKind, UnitStats> } | { ok: false; errors: StatError[] };

/** A compile error here means `UnitKind` and the data's required kinds drifted apart. */
const KIND_SET: Record<UnitKind, true> = { factory: true, harvester: true, engineer: true, radar: true, jammer: true, tank: true, artillery: true, mine: true };

/** The problems in one value of one field, empty when it is legal. */
export function fieldErrors(kind: string, key: keyof UnitStats, value: unknown): StatError[] {
  const spec = STAT_FIELDS[key];
  const bad = (message: string): StatError[] => [{ kind, field: key, message }];
  if (spec.type === "bool") return typeof value === "boolean" ? [] : bad("must be true or false");
  if (spec.type === "enum") return typeof value === "string" && spec.options.includes(value) ? [] : bad(`must be one of ${spec.options.join(", ")}`);
  if (typeof value !== "number" || !Number.isInteger(value)) return bad("must be a whole number");
  return value >= spec.min && value <= spec.max ? [] : bad(`must be ${spec.min} to ${spec.max}`);
}

/** Rules that span fields. Run on a row whose fields each passed `fieldErrors`. */
export function crossErrors(kind: string, row: UnitStats): StatError[] {
  const errors: StatError[] = [];
  const shoots = row.weapon === "direct" || row.weapon === "ballistic";
  if (shoots && row.shotSpeed < 1) errors.push({ kind, field: "shotSpeed", message: "a shooting unit needs a shell speed of at least 1" });
  return errors;
}

/** Every problem in one unit's row: each field, then the rules across fields. */
export function rowErrors(kind: string, row: Readonly<Record<string, unknown>>): StatError[] {
  const errors: StatError[] = [];
  for (const key of STAT_KEYS) {
    if (!(key in row)) errors.push({ kind, field: key, message: "missing" });
    else errors.push(...fieldErrors(kind, key, row[key]));
  }
  for (const key of Object.keys(row)) {
    if (!(key in STAT_FIELDS)) errors.push({ kind, field: null, message: `unknown field ${key}` });
  }
  return errors.length > 0 ? errors : crossErrors(kind, row as unknown as UnitStats);
}

/** Checks the whole file. On success the rows come back with their fields in `STAT_KEYS` order. */
export function parseUnitStats(raw: unknown): ParsedStats {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, errors: [{ kind: null, field: null, message: "must be an object of kinds" }] };
  const table = raw as Record<string, unknown>;
  const errors: StatError[] = [];
  for (const kind of Object.keys(KIND_SET)) if (!(kind in table)) errors.push({ kind, field: null, message: "missing kind" });
  const stats: Record<string, UnitStats> = {};
  for (const [kind, row] of Object.entries(table)) {
    if (!(kind in KIND_SET)) { errors.push({ kind, field: null, message: "unknown kind" }); continue; }
    if (typeof row !== "object" || row === null || Array.isArray(row)) { errors.push({ kind, field: null, message: "must be an object of fields" }); continue; }
    const found = rowErrors(kind, row as Record<string, unknown>);
    if (found.length > 0) errors.push(...found);
    else stats[kind] = Object.fromEntries(STAT_KEYS.map((k) => [k, (row as Record<string, unknown>)[k]])) as unknown as UnitStats;
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, stats: stats as Record<UnitKind, UnitStats> };
}

/** The file text for `stats`: kinds in table order, fields in `STAT_KEYS` order, two-space indent, final newline. */
export function serializeUnitStats(stats: Readonly<Record<string, UnitStats>>): string {
  const ordered = Object.fromEntries(Object.entries(stats).map(([kind, row]) => [kind, Object.fromEntries(STAT_KEYS.map((k) => [k, row[k]]))]));
  return JSON.stringify(ordered, null, 2) + "\n";
}

/** Throws one line per error. For the module that loads the file at start-up. */
export function describeStatErrors(errors: readonly StatError[]): string {
  return errors.map((e) => `${e.kind ?? "file"}${e.field ? `.${e.field}` : ""}: ${e.message}`).join("\n");
}
