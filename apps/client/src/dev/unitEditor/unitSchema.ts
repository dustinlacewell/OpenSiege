import { STAT_FIELDS, STAT_KEYS, STAT_SECTIONS } from "@mf/sim";
import type { FieldSpec, Schema } from "../tableEditor/schema.ts";

// The sim's stat fields as the table editor's schema. The sim's `int` is a whole number: decimals 0, step 1.

export const UNIT_SCHEMA: Schema = {
  fields: STAT_KEYS.map((key): FieldSpec => {
    const f = STAT_FIELDS[key];
    const base = { key, label: f.label, section: f.section, unit: f.unit, help: f.help };
    if (f.type === "int") return { ...base, type: "number", min: f.min, max: f.max, decimals: 0, step: 1 };
    if (f.type === "enum") return { ...base, type: "enum", options: f.options };
    return { ...base, type: "bool" };
  }),
  sections: STAT_SECTIONS,
};
