import { specOf, type Schema, type Table } from "./schema.ts";

// Facts about the rows (fields) of the matrix. Pure.

/** What the user sees of the matrix: collapsed sections, the filter text, the changed-only switch. */
export interface ViewPrefs {
  collapsed: readonly string[];
  filter: string;
  changedOnly: boolean;
}

/** Each column's number as a share of the largest in the row, 0 to 1. All 0 for a field that is not a number. A column without the field gets 0. */
export function barFractions(schema: Schema, table: Table, field: string): Record<string, number> {
  const columns = Object.keys(table);
  const isNumber = specOf(schema, field)?.type === "number";
  const values = columns.map((c) => (isNumber && Object.hasOwn(table[c]!, field) ? Math.max(0, Number(table[c]![field])) : 0));
  const top = Math.max(0, ...values);
  return Object.fromEntries(columns.map((c, i) => [c, top > 0 ? values[i]! / top : 0]));
}

/** Every word of `text` appears in the field's label, key or help. Empty text matches all. */
export function matchesFilter(schema: Schema, field: string, text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const spec = specOf(schema, field);
  if (!spec) return false;
  const hay = `${spec.label} ${field} ${spec.help}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** A filter or the changed-only switch is on. Collapsed sections then open for the matching rows. */
export function isNarrowed(prefs: ViewPrefs): boolean {
  return prefs.filter.trim() !== "" || prefs.changedOnly;
}

/** The rows to show, in schema order. */
export function visibleKeys(schema: Schema, prefs: ViewPrefs, changed: ReadonlySet<string>): Set<string> {
  const narrowed = isNarrowed(prefs);
  return new Set(
    schema.fields
      .filter((spec) => {
        if (!narrowed && prefs.collapsed.includes(spec.section)) return false;
        if (prefs.changedOnly && !changed.has(spec.key)) return false;
        return matchesFilter(schema, spec.key, prefs.filter);
      })
      .map((spec) => spec.key),
  );
}

/** `prefs` changed just enough that `field`'s row shows. */
export function revealPrefs(schema: Schema, prefs: ViewPrefs, field: string, changed: ReadonlySet<string>): ViewPrefs {
  const hidden = prefs.changedOnly && !changed.has(field);
  const filtered = !matchesFilter(schema, field, prefs.filter);
  const section = specOf(schema, field)?.section;
  return {
    collapsed: prefs.collapsed.filter((s) => s !== section),
    filter: filtered ? "" : prefs.filter,
    changedOnly: hidden ? false : prefs.changedOnly,
  };
}

export function toggleSection(prefs: ViewPrefs, id: string): ViewPrefs {
  const collapsed = prefs.collapsed.includes(id) ? prefs.collapsed.filter((s) => s !== id) : [...prefs.collapsed, id];
  return { ...prefs, collapsed };
}
