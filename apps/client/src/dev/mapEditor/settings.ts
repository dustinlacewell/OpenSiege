// The tool panel's state and the package `Tool` it stands for. Pure.
import type { MapFeatureKind } from "@mf/sim";
import { MAX_SYMMETRY, type HeightOp, type Tool } from "@mf/map";

export type ToolId = HeightOp | "paint" | "feature" | "field";
export type Channel = 0 | 1 | 2 | 3;
export type FeatureMode = "place" | "scatter" | "erase";
export type FieldMode = "place" | "erase";

export interface Settings {
  tool: ToolId;
  channel: Channel;
  featureKind: MapFeatureKind;
  featureMode: FeatureMode;
  fieldMode: FieldMode;
  /** Brush radius, world units. */
  radius: number;
  /** 0..1. Height tools scale it by HEIGHT_PER_DAB. */
  strength: number;
  /** 0 hard edge .. 1 soft dome. */
  falloff: number;
  /** Scatter: features per 1e6 square units. */
  density: number;
  fieldRadius: number;
  fieldAmount: number;
  /** Copies about the map centre, 1..MAX_SYMMETRY. */
  symmetry: number;
  /** Each copy also reflected. */
  mirror: boolean;
}

export type NumberSetting = "radius" | "strength" | "falloff" | "density" | "fieldRadius" | "fieldAmount" | "symmetry";

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const RANGES: Record<NumberSetting, Range> = {
  radius: { min: 50, max: 2000, step: 10 },
  strength: { min: 0.01, max: 1, step: 0.01 },
  falloff: { min: 0, max: 1, step: 0.01 },
  density: { min: 1, max: 200, step: 1 },
  fieldRadius: { min: 100, max: 1500, step: 10 },
  fieldAmount: { min: 500, max: 20000, step: 100 },
  symmetry: { min: 1, max: MAX_SYMMETRY, step: 1 },
};

/** Height units one dab adds at full strength and full weight. */
const HEIGHT_PER_DAB = 40;
/** `[` and `]` scale the radius by this. */
const RESIZE_STEP = 1.15;

export const DEFAULT_SETTINGS: Settings = {
  tool: "raise", channel: 1, featureKind: "tree", featureMode: "scatter", fieldMode: "place",
  radius: 400, strength: 0.3, falloff: 0.6, density: 20, fieldRadius: 500, fieldAmount: 5000,
  symmetry: 1, mirror: false,
};

/** The package tool for these settings. `flattenTo` is the flatten target height (the stroke's start). */
export function toolOf(s: Settings, flattenTo?: number): Tool {
  switch (s.tool) {
    case "paint": return { kind: "material", channel: s.channel, brush: { radius: s.radius, strength: s.strength, falloff: s.falloff } };
    case "feature": return { kind: "feature", mode: s.featureMode, featureKind: s.featureKind, radius: s.radius, density: s.density };
    case "field": return { kind: "field", mode: s.fieldMode, radius: s.fieldMode === "place" ? s.fieldRadius : s.radius, amount: s.fieldAmount };
    default: return { kind: "height", op: s.tool, brush: { radius: s.radius, strength: s.strength * HEIGHT_PER_DAB, falloff: s.falloff, target: flattenTo } };
  }
}

/** Place tools act once per stroke, at the press point. */
export function placesOnce(s: Settings): boolean {
  return (s.tool === "feature" && s.featureMode === "place") || (s.tool === "field" && s.fieldMode === "place");
}

/** The ring the cursor draws: the field's size when placing one, else the brush. */
export function cursorRadius(s: Settings): number {
  return s.tool === "field" && s.fieldMode === "place" ? s.fieldRadius : s.radius;
}

/** `dir` +1 grows, -1 shrinks. Kept in range. */
export function resizeBrush(s: Settings, dir: 1 | -1): Settings {
  return scaleBrush(s, RESIZE_STEP ** dir);
}

// The wheel nudges below are not rounded, so small touchpad steps add up. The panel shows them rounded.

export function nudgeStrength(s: Settings, delta: number): Settings {
  return { ...s, strength: inRange("strength", s.strength + delta) };
}

export function nudgeFalloff(s: Settings, delta: number): Settings {
  return { ...s, falloff: inRange("falloff", s.falloff + delta) };
}

export function scaleDensity(s: Settings, factor: number): Settings {
  return { ...s, density: inRange("density", s.density * factor) };
}

export function scaleBrush(s: Settings, factor: number): Settings {
  return { ...s, radius: inRange("radius", s.radius * factor) };
}

function inRange(key: NumberSetting, v: number): number {
  const r = RANGES[key];
  return Math.min(r.max, Math.max(r.min, v));
}
