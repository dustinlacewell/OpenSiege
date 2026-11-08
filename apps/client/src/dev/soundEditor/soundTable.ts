import { CUES, TUNING_FIELDS, parseSoundTuning, type ParseResult, type SoundTuning, type TuningField } from "../../audio/soundTuning.ts";
import type { Row, Table } from "../tableEditor/schema.ts";

// The sound tuning as the table editor's table, and back. Pure.
// Columns are the cues in CUES order, then "global". A cue column has the cue fields, "global" has the global fields.

export const GLOBAL_COLUMN = "global";

const CUE_FIELDS = TUNING_FIELDS.filter((f) => f.scope === "cue");
const GLOBAL_FIELDS = TUNING_FIELDS.filter((f) => f.scope === "global");

/** The tuning as a ragged table: each column holds only its own scope's fields, in field order. */
export function tuningToTable(t: SoundTuning): Table {
  const table: Record<string, Row> = {};
  for (const cue of CUES) table[cue] = pick(t.cues[cue], CUE_FIELDS);
  table[GLOBAL_COLUMN] = pick(t.global, GLOBAL_FIELDS);
  return table;
}

/** The table as the tuning file's JSON, whatever the cells hold. A missing column stays missing, so the parser names it. */
export function tableToJson(table: Table): unknown {
  const cues: Record<string, Row> = {};
  for (const cue of CUES) if (table[cue]) cues[cue] = { ...table[cue] };
  return { cues, global: table[GLOBAL_COLUMN] ? { ...table[GLOBAL_COLUMN] } : undefined };
}

/** The table read as a tuning, with every problem the audio core finds. */
export function tableToTuning(table: Table): ParseResult {
  return parseSoundTuning(tableToJson(table));
}

function pick(values: object, fields: readonly TuningField[]): Row {
  const row: Record<string, number> = {};
  for (const f of fields) row[f.key] = (values as Record<string, number>)[f.key]!;
  return row;
}
