import { TUNING_FIELDS, TUNING_SECTIONS } from "../../audio/soundTuning.ts";
import type { FieldSpec, Schema } from "../tableEditor/schema.ts";

// The audio core's tuning fields as the table editor's schema. Every field is a number. A cue field shows in the cue columns
// only and a global field in the global column only: the table is ragged (`soundTable.ts`).

export const SOUND_SCHEMA: Schema = {
  fields: TUNING_FIELDS.map((f): FieldSpec => ({
    type: "number",
    key: f.key,
    label: f.label,
    section: f.section,
    unit: f.unit,
    help: f.help,
    min: f.min,
    max: f.max,
    decimals: f.decimals,
    step: f.step,
  })),
  sections: TUNING_SECTIONS,
};
