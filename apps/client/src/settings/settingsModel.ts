// What the player can set, and the default of each. Pure data. Adding a setting = one value key, one default, one field entry.

/** Every stored setting. */
export interface SettingsValues {
  /** Multiplies the device pixel ratio: the canvas buffer size. Lower is faster. */
  renderScale: number;
  /** Idle mobile units deploy on their own (`game/autoSiege.ts`). */
  autoSiege: boolean;
  /** Seconds of idling before auto-siege deploys a unit. */
  autoSiegeSeconds: number;
  /** Group key N selects every own unit of the Nth kind (`game/controlGroups.ts`). */
  simpleGroups: boolean;
}

export const DEFAULT_SETTINGS: SettingsValues = {
  renderScale: 1,
  autoSiege: false,
  autoSiegeSeconds: 15,
  simpleGroups: false,
};

interface FieldBase {
  id: keyof SettingsValues;
  label: string;
}

export interface ToggleField extends FieldBase {
  kind: "toggle";
}

export interface ChoiceField extends FieldBase {
  kind: "choice";
  options: readonly { value: number | string; label: string }[];
}

export interface RangeField extends FieldBase {
  kind: "range";
  min: number;
  max: number;
  step: number;
}

export type SettingsField = ToggleField | ChoiceField | RangeField;

export interface SettingsTab {
  id: "graphics" | "gameplay" | "controls";
  label: string;
  fields: readonly SettingsField[];
  /** DOM id of a fixed panel shown on this tab, written in the page. */
  panel?: string;
}

export const SETTINGS_TABS: readonly SettingsTab[] = [
  {
    id: "graphics",
    label: "Graphics",
    fields: [
      {
        id: "renderScale", label: "Render scale", kind: "choice",
        options: [{ value: 0.5, label: "50%" }, { value: 0.75, label: "75%" }, { value: 1, label: "100%" }],
      },
    ],
  },
  {
    id: "gameplay",
    label: "Gameplay",
    fields: [
      { id: "autoSiege", label: "Auto-siege idle units", kind: "toggle" },
      { id: "autoSiegeSeconds", label: "Auto-siege after (seconds)", kind: "range", min: 1, max: 120, step: 1 },
      { id: "simpleGroups", label: "Simple groups", kind: "toggle" },
    ],
  },
  { id: "controls", label: "Controls", fields: [], panel: "settings-controls" },
];

export function allFields(): SettingsField[] {
  return SETTINGS_TABS.flatMap((t) => [...t.fields]);
}

/** Whether `value` is something `field` can hold. */
export function isValidFor(field: SettingsField, value: unknown): boolean {
  switch (field.kind) {
    case "toggle": return typeof value === "boolean";
    case "choice": return field.options.some((o) => o.value === value);
    case "range": return typeof value === "number" && Number.isFinite(value) && value >= field.min && value <= field.max;
  }
}
