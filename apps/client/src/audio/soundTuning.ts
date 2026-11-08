import type { Cue } from "./cues.ts";

/** Every cue, world and interface. Equals the keys of SYNTHS plus SAMPLED_CUES; a test keeps them in step. */
export const CUES: readonly Cue[] = [
  "shotDirect",
  "shotBallistic",
  "shellGround",
  "shellArmor",
  "roundGround",
  "roundArmor",
  "destroyed",
  "built",
  "underAttack",
  "deploy",
  "pack",
  "credits",
  "ack",
  "queued",
  "refused",
  "select",
];

/** What one cue is allowed to do. */
export interface CueTuning {
  /** Int 0..1000. Higher is more important. */
  rank: number;
  /** Int 1..64. Most voices of this cue that may sound together. */
  atOnceLimit: number;
  /** 0..60. Least seconds between two plays of this cue. 0 = never throttled. */
  minGapSeconds: number;
  /** 0..2. Multiplies the voice gain. */
  baseGain: number;
}

/** Budget, level, zoom and mix for the whole mix. */
export interface GlobalTuning {
  /** Int 1..128. Most voices at once. */
  voiceCap: number;
  /** Int 0..voiceCap-1. The last N slots of the cap. */
  reservedSlots: number;
  /** Int 0..1000. Only voices with a rank at or above this may use the reserved slots. */
  protectedRank: number;
  /** 0..1. */
  masterGain: number;
  /** 0.5..4. Cap on the gain of a merged voice. */
  maxGain: number;
  /** 0..1. Gain added per doubling of merged events. */
  mergeBoost: number;
  /** 0.1..3. Hearing radius as a share of the camera distance. */
  hearingRange: number;
  /** 0..1. Gain factor for placed sounds at the farthest zoom. */
  zoomFloor: number;
  /** Camera distance at or below which the zoom factor is 1. */
  zoomNear: number;
  /** Camera distance at or above which the zoom factor is `zoomFloor`. Linear between. */
  zoomFar: number;
}

export interface SoundTuning {
  cues: Readonly<Record<Cue, CueTuning>>;
  global: GlobalTuning;
}

/** One editable number. The validator and the dev editor both read this list. */
export interface TuningField {
  scope: "cue" | "global";
  key: string;
  label: string;
  section: string;
  unit: string;
  help: string;
  min: number;
  max: number;
  /** 0 = whole numbers only. */
  decimals: number;
  step: number;
}

export const TUNING_SECTIONS: readonly { id: string; label: string }[] = [
  { id: "Priority", label: "Priority" },
  { id: "Throttle", label: "Throttle" },
  { id: "Level", label: "Level" },
  { id: "Budget", label: "Budget" },
  { id: "Zoom", label: "Zoom" },
  { id: "Mix", label: "Mix" },
];

export const TUNING_FIELDS: readonly TuningField[] = [
  { scope: "cue", key: "rank", label: "Rank", section: "Priority", unit: "", help: "How important the sound is. Only sounds at or above the protected rank may use the reserved slots.", min: 0, max: 1000, decimals: 0, step: 10 },
  { scope: "cue", key: "atOnceLimit", label: "At once", section: "Priority", unit: "voices", help: "Most voices of this sound that may play together. More are dropped.", min: 1, max: 64, decimals: 0, step: 1 },
  { scope: "cue", key: "minGapSeconds", label: "Min gap", section: "Throttle", unit: "s", help: "Least time between two plays of this sound. 0 means never held back.", min: 0, max: 60, decimals: 2, step: 0.05 },
  { scope: "cue", key: "baseGain", label: "Gain", section: "Level", unit: "x", help: "Multiplies the loudness of this sound.", min: 0, max: 2, decimals: 2, step: 0.05 },

  { scope: "global", key: "voiceCap", label: "Voice cap", section: "Budget", unit: "voices", help: "Most voices of any sound that may play together. More are dropped.", min: 1, max: 128, decimals: 0, step: 1 },
  { scope: "global", key: "reservedSlots", label: "Reserved slots", section: "Budget", unit: "voices", help: "The last slots of the voice cap. Only sounds at or above the protected rank may use them.", min: 0, max: 127, decimals: 0, step: 1 },
  { scope: "global", key: "protectedRank", label: "Protected rank", section: "Budget", unit: "", help: "A sound needs this rank or more to use the reserved slots.", min: 0, max: 1000, decimals: 0, step: 10 },
  { scope: "global", key: "masterGain", label: "Master gain", section: "Level", unit: "x", help: "Loudness of everything.", min: 0, max: 1, decimals: 2, step: 0.05 },
  { scope: "global", key: "maxGain", label: "Max gain", section: "Level", unit: "x", help: "Loudest a merged sound may get.", min: 0.5, max: 4, decimals: 2, step: 0.05 },
  { scope: "global", key: "mergeBoost", label: "Merge boost", section: "Mix", unit: "x", help: "Gain added each time the count of merged events doubles.", min: 0, max: 1, decimals: 2, step: 0.05 },
  { scope: "global", key: "hearingRange", label: "Hearing range", section: "Mix", unit: "x camera distance", help: "How far from the camera a sound can be heard, as a share of the camera distance.", min: 0.1, max: 3, decimals: 2, step: 0.05 },
  { scope: "global", key: "zoomFloor", label: "Zoom floor", section: "Zoom", unit: "x", help: "How loud placed sounds are at the farthest zoom. 1 means zoom does not change loudness.", min: 0, max: 1, decimals: 2, step: 0.05 },
  { scope: "global", key: "zoomNear", label: "Zoom near", section: "Zoom", unit: "camera distance", help: "At this camera distance or closer, placed sounds are at full loudness.", min: 0, max: 100000, decimals: 0, step: 100 },
  { scope: "global", key: "zoomFar", label: "Zoom far", section: "Zoom", unit: "camera distance", help: "At this camera distance or farther, placed sounds are at the zoom floor. Linear between.", min: 0, max: 100000, decimals: 0, step: 100 },
];

const CUE_FIELDS = TUNING_FIELDS.filter((f) => f.scope === "cue");
const GLOBAL_FIELDS = TUNING_FIELDS.filter((f) => f.scope === "global");

export type TuningError = { column: string | null; field: string | null; message: string };

export type ParseResult = { ok: true; tuning: SoundTuning } | { ok: false; errors: TuningError[] };

type Numbers = Record<string, number>;

/** Pure. Checks a loaded object against TUNING_FIELDS and the cross rules. Returns every error. */
export function parseSoundTuning(json: unknown): ParseResult {
  const errors: TuningError[] = [];
  if (!isRecord(json)) return { ok: false, errors: [{ column: null, field: null, message: "Tuning must be an object." }] };
  for (const key of Object.keys(json)) {
    if (key !== "cues" && key !== "global") errors.push({ column: null, field: key, message: `Unknown key "${key}".` });
  }
  const cues = readCues(json.cues, errors);
  const global = readColumn("global", json.global, GLOBAL_FIELDS, errors);
  checkCrossRules(cues, global, errors);
  if (errors.length > 0 || !global) return { ok: false, errors };
  return { ok: true, tuning: { cues: cues as unknown as SoundTuning["cues"], global: global as unknown as GlobalTuning } };
}

/** Pure. Stable key order (cues in CUES order, fields in TUNING_FIELDS order), 2-space indent, trailing newline. */
export function serializeSoundTuning(t: SoundTuning): string {
  const cues: Record<string, Numbers> = {};
  for (const cue of CUES) cues[cue] = ordered(t.cues[cue] as unknown as Numbers, CUE_FIELDS);
  const out = { cues, global: ordered(t.global as unknown as Numbers, GLOBAL_FIELDS) };
  return JSON.stringify(out, null, 2) + "\n";
}

/**
 * Pure. The cross rules that one column breaks, for a dev editor that checks a column at a time. The column is a cue id or
 * "global". A cue column also needs the global voice cap (undefined skips that rule). The fields must have passed their own checks.
 */
export function columnCrossErrors(column: string, values: Readonly<Record<string, number>>, voiceCap: number | undefined): TuningError[] {
  const errors: TuningError[] = [];
  if (column === "global") checkCrossRules({}, { ...values }, errors);
  else checkCrossRules({ [column]: { ...values } }, voiceCap === undefined ? null : { voiceCap }, errors);
  return errors;
}

function ordered(values: Numbers, fields: readonly TuningField[]): Numbers {
  const out: Numbers = {};
  for (const f of fields) out[f.key] = values[f.key]!;
  return out;
}

function readCues(raw: unknown, errors: TuningError[]): Record<string, Numbers | null> {
  const out: Record<string, Numbers | null> = {};
  if (!isRecord(raw)) {
    errors.push({ column: null, field: "cues", message: "cues must be an object." });
    return out;
  }
  for (const id of Object.keys(raw)) {
    if (!CUES.includes(id as Cue)) errors.push({ column: id, field: null, message: `Unknown cue "${id}".` });
  }
  for (const cue of CUES) {
    if (!(cue in raw)) errors.push({ column: cue, field: null, message: `Cue "${cue}" is missing.` });
    else out[cue] = readColumn(cue, raw[cue], CUE_FIELDS, errors);
  }
  return out;
}

/** Reads one column (a cue or "global"). Null when the column is not an object. */
function readColumn(column: string, raw: unknown, fields: readonly TuningField[], errors: TuningError[]): Numbers | null {
  if (!isRecord(raw)) {
    errors.push({ column, field: null, message: `${column} must be an object.` });
    return null;
  }
  const known = new Set(fields.map((f) => f.key));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) errors.push({ column, field: key, message: `Unknown key "${key}".` });
  }
  const out: Numbers = {};
  for (const f of fields) {
    const message = fieldProblem(f, raw[f.key]);
    if (message) errors.push({ column, field: f.key, message });
    else out[f.key] = raw[f.key] as number;
  }
  return out;
}

/** The problem with one value, or null when it is fine. */
function fieldProblem(f: TuningField, v: unknown): string | null {
  if (v === undefined) return `${f.label} is missing.`;
  if (typeof v !== "number" || !Number.isFinite(v)) return `${f.label} must be a number.`;
  if (v < f.min || v > f.max) return `${f.label} must be from ${f.min} to ${f.max}.`;
  if (!hasDecimals(v, f.decimals)) return f.decimals === 0 ? `${f.label} must be a whole number.` : `${f.label} may have at most ${f.decimals} decimals.`;
  return null;
}

function hasDecimals(v: number, decimals: number): boolean {
  const scaled = v * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Rules that span fields. A rule is skipped when a field it needs failed its own check. */
function checkCrossRules(cues: Record<string, Numbers | null>, global: Numbers | null, errors: TuningError[]): void {
  const g = global && has(global, ["voiceCap", "reservedSlots", "zoomNear", "zoomFar"]) ? global : null;
  if (g && g.reservedSlots! >= g.voiceCap!) {
    errors.push({ column: "global", field: "reservedSlots", message: "Reserved slots must be fewer than the voice cap." });
  }
  if (g && g.zoomNear! >= g.zoomFar!) {
    errors.push({ column: "global", field: "zoomNear", message: "Zoom near must be less than zoom far." });
  }
  const cap = global?.voiceCap;
  if (cap === undefined) return;
  for (const [id, c] of Object.entries(cues)) {
    if (c?.atOnceLimit !== undefined && c.atOnceLimit > cap) {
      errors.push({ column: id, field: "atOnceLimit", message: "At once must not be more than the voice cap." });
    }
  }
}

function has(values: Numbers, keys: readonly string[]): boolean {
  return keys.every((k) => values[k] !== undefined);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
