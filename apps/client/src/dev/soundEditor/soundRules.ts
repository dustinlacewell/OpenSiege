import { columnCrossErrors } from "../../audio/soundTuning.ts";
import { specFieldError, specOf, type Row, type Rules } from "../tableEditor/schema.ts";
import { SOUND_SCHEMA } from "./soundSchema.ts";
import { GLOBAL_COLUMN } from "./soundTable.ts";

// The sound editor's rules: the schema's range checks and the audio core's cross rules. Pure.

export function soundLabel(column: string): string {
  return column === GLOBAL_COLUMN ? "Global" : column;
}

/**
 * `voiceCap()` is the global voice cap in the draft now. A cue's "at once" limit is checked against it, and that
 * is the one rule that reads another column. Undefined, or a cap that fails its own field check, skips it.
 * Every cell is always relevant: no sound field switches another off.
 */
export function soundRules(voiceCap: () => number | undefined): Rules {
  return {
    field(_column, key, value) {
      const spec = specOf(SOUND_SCHEMA, key);
      return spec ? specFieldError(spec, value) : undefined;
    },
    cross(column, row) {
      const out: Record<string, string> = {};
      for (const e of columnCrossErrors(column, numbersOf(row), validCap(voiceCap()))) if (e.field) out[e.field] ??= e.message;
      return out;
    },
    relevant: () => true,
  };
}

/** The cap when it passes the voice cap field's own check, else undefined, as the dev server parser skips the rule. */
function validCap(cap: number | undefined): number | undefined {
  const spec = specOf(SOUND_SCHEMA, "voiceCap");
  return cap !== undefined && spec && specFieldError(spec, cap) === undefined ? cap : undefined;
}

/** The number cells of a row. A row that passed the field rules holds nothing else. */
function numbersOf(row: Row): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) if (typeof value === "number") out[key] = value;
  return out;
}
