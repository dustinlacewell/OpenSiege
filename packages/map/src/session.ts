import type { MapFeatureKind } from "@mf/sim";
import { applyChanges, type HeightChange } from "./changes.ts";
import { heightBrush, type Brush, type HeightOp } from "./heightBrush.ts";
import { applyMaterialChanges, paintMaterial, type MaterialChange } from "./materialBrush.ts";
import { eraseFeatures, placeField, placeFeature, scatterFeatures, type Bounds, type Disc, type Feature, type Field } from "./placement.ts";
import { symmetricPoints, type Point, type Transform } from "./symmetry.ts";
import type { EditorMap } from "./types.ts";

export type Tool =
  | { kind: "height"; op: HeightOp; brush: Omit<Brush, "x" | "y"> }
  | { kind: "material"; channel: 0 | 1 | 2 | 3; brush: { radius: number; strength: number; falloff: number } }
  | { kind: "feature"; mode: "place" | "scatter" | "erase"; featureKind: MapFeatureKind; radius: number; density: number }
  | { kind: "field"; mode: "place" | "erase"; radius: number; amount: number };

/** One undoable edit. Height and material edits hold per-vertex changes. The others hold whole arrays. */
export type Edit =
  | { t: "height"; changes: HeightChange[] }
  | { t: "material"; changes: MaterialChange[] }
  | { t: "features"; before: Feature[]; after: Feature[] }
  | { t: "fields"; before: Field[]; after: Field[] };

export interface Session {
  map: EditorMap;
  undo: Edit[];
  redo: Edit[];
}

export interface VertexRect { i0: number; j0: number; i1: number; j1: number }

const UNDO_CAP = 100;

export function newSession(map: EditorMap): Session {
  return { map, undo: [], redo: [] };
}

/** Compute, apply and return the edit for one dab. Null when nothing changed. Does not touch the undo stack. */
export function strokeDab(s: Session, tool: Tool, x: number, y: number, seed: number): Edit | null {
  const edit = computeDab(s.map, tool, x, y, seed);
  if (!edit) return null;
  apply(s.map, edit, "forward");
  return edit;
}

/**
 * One dab and its symmetric copies (`transforms[0]` is the identity). Brushes dab again at each copy point.
 * Tools that add things add them once, then add their transformed copies, so scattered rocks match exactly.
 */
export function symmetricDab(s: Session, tool: Tool, x: number, y: number, seed: number, transforms: readonly Transform[]): Edit[] {
  if (!addsThings(tool)) {
    const points = symmetricPoints({ x, y }, transforms, s.map.spec, toolReach(tool));
    return points.map((p) => strokeDab(s, tool, p.x, p.y, seed)).filter((e): e is Edit => e !== null);
  }
  const first = strokeDab(s, tool, x, y, seed);
  if (!first || transforms.length < 2) return first ? [first] : [];
  const copies = first.t === "features" ? copyFeatures(s, first, transforms) : first.t === "fields" ? copyFields(s, first, transforms) : null;
  return copies ? [first, copies] : [first];
}

/** How far off the map a dab's centre can be and still touch it. */
export function toolReach(tool: Tool): number {
  return tool.kind === "height" || tool.kind === "material" ? tool.brush.radius : tool.radius;
}

function addsThings(tool: Tool): boolean {
  return (tool.kind === "feature" && tool.mode !== "erase") || (tool.kind === "field" && tool.mode === "place");
}

function copyFeatures(s: Session, e: Extract<Edit, { t: "features" }>, transforms: readonly Transform[]): Edit | null {
  const copies = featureCopies(e.after.slice(e.before.length), transforms, s.map.spec);
  if (copies.length === 0) return null;
  const before = s.map.spec.features;
  const edit: Edit = { t: "features", before, after: [...before, ...copies] };
  apply(s.map, edit, "forward");
  return edit;
}

function copyFields(s: Session, e: Extract<Edit, { t: "fields" }>, transforms: readonly Transform[]): Edit | null {
  const before = s.map.spec.fields;
  const after = withFieldCopies(before, e.after.slice(e.before.length), transforms, s.map.spec);
  if (after === before) return null;
  const edit: Edit = { t: "fields", before, after };
  apply(s.map, edit, "forward");
  return edit;
}

/** The transformed copies of `added` (identity skipped) that land on the map and on no other copy. Pure. */
function featureCopies(added: readonly Feature[], transforms: readonly Transform[], map: Bounds): Feature[] {
  const copies: Feature[] = [];
  for (const t of transforms.slice(1)) {
    for (const f of added) {
      const q = t(f);
      const c = { ...f, x: Math.round(q.x), y: Math.round(q.y) };
      if (c.x < 0 || c.y < 0 || c.x > map.width || c.y > map.height) continue;
      if (added.some((o) => o.x === c.x && o.y === c.y) || copies.some((o) => o.x === c.x && o.y === c.y)) continue;
      copies.push(c);
    }
  }
  return copies;
}

/** `fields` plus each valid transformed copy of `added`. Returns `fields` itself when no copy fits. Pure. */
function withFieldCopies(fields: Field[], added: readonly Field[], transforms: readonly Transform[], map: Bounds): Field[] {
  let after = fields;
  for (const t of transforms.slice(1)) {
    for (const f of added) {
      const q = t(f);
      const x = Math.round(q.x), y = Math.round(q.y);
      if (after.some((o) => Math.abs(o.x - x) < 1 && Math.abs(o.y - y) < 1)) continue;
      const placed = placeField(after, x, y, f.radius, f.amount, map);
      if (!("error" in placed)) after = placed;
    }
  }
  return after;
}

/** Circles a dab would add or remove, for the cursor preview. */
export interface DabPreview {
  add: Disc[];
  remove: Disc[];
}

/**
 * What `symmetricDab` would place or erase with this seed, without changing the map. Null for brushes, which
 * change heights or paint and have nothing to outline. Pure.
 */
export function previewDab(map: EditorMap, tool: Tool, x: number, y: number, seed: number, transforms: readonly Transform[]): DabPreview | null {
  if (tool.kind === "height" || tool.kind === "material") return null;
  const points = symmetricPoints({ x, y }, transforms, map.spec, toolReach(tool));
  if (!addsThings(tool)) return { add: [], remove: removedAt(map, tool, points) };
  const e = tool.kind === "feature" ? featureDab(map, tool, x, y, seed) : fieldDab(map, tool, x, y);
  if (!e || (e.t !== "features" && e.t !== "fields")) return { add: [], remove: [] };
  const added: Disc[] = e.after.slice(e.before.length);
  const copies = e.t === "features"
    ? featureCopies(e.after.slice(e.before.length), transforms, map.spec)
    : withFieldCopies(e.after, e.after.slice(e.before.length), transforms, map.spec).slice(e.after.length);
  return { add: [...added, ...copies], remove: [] };
}

function removedAt(map: EditorMap, tool: Tool, points: readonly Point[]): Disc[] {
  const out = new Set<Disc>();
  for (const p of points) {
    if (tool.kind === "feature") {
      for (const f of eraseFeatures(map.spec.features, { x: p.x, y: p.y, radius: tool.radius }, tool.featureKind).removed) out.add(f);
    } else if (tool.kind === "field") {
      const r2 = tool.radius * tool.radius;
      for (const f of map.spec.fields) if ((f.x - p.x) ** 2 + (f.y - p.y) ** 2 <= r2) out.add(f);
    }
  }
  return [...out];
}

/** Fold the dabs of one pointer stroke into undo entries (one per edit kind). Clears redo. */
export function commitStroke(s: Session, edits: readonly Edit[]): void {
  const merged = mergeEdits(edits);
  if (merged.length === 0) return;
  s.undo.push(...merged);
  if (s.undo.length > UNDO_CAP) s.undo.splice(0, s.undo.length - UNDO_CAP);
  s.redo.length = 0;
}

export function undoLast(s: Session): Edit | null {
  const e = s.undo.pop();
  if (!e) return null;
  apply(s.map, e, "back");
  s.redo.push(e);
  return e;
}

export function redoLast(s: Session): Edit | null {
  const e = s.redo.pop();
  if (!e) return null;
  apply(s.map, e, "forward");
  s.undo.push(e);
  return e;
}

/** Vertex rect a height or material edit touched. Null for feature and field edits. */
export function editBounds(e: Edit, cols: number): VertexRect | null {
  if (e.t === "height" || e.t === "material") return indexBounds(e.changes, cols);
  return null;
}

function computeDab(map: EditorMap, tool: Tool, x: number, y: number, seed: number): Edit | null {
  const { spec } = map;
  const cols = spec.width / spec.cell + 1;
  const rows = spec.height / spec.cell + 1;
  switch (tool.kind) {
    case "height": {
      const grid = { cols, rows, cell: spec.cell, heights: spec.heights };
      const target = tool.brush.target ?? spec.heights[nearestVertex(spec.cell, cols, rows, x, y)];
      const changes = heightBrush(grid, tool.op, { ...tool.brush, x, y, seed, target });
      return changes.length > 0 ? { t: "height", changes } : null;
    }
    case "material": {
      const changes = paintMaterial({ cols, rows, cell: spec.cell }, map.materials, tool.channel, { ...tool.brush, x, y });
      return changes.length > 0 ? { t: "material", changes } : null;
    }
    case "feature": return featureDab(map, tool, x, y, seed);
    case "field": return fieldDab(map, tool, x, y);
  }
}

function featureDab(map: EditorMap, tool: Extract<Tool, { kind: "feature" }>, x: number, y: number, seed: number): Edit | null {
  const before = map.spec.features;
  const bounds = map.spec;
  const disc = { x, y, radius: tool.radius };
  let after: Feature[];
  if (tool.mode === "place") after = placeFeature(before, tool.featureKind, x, y, undefined, bounds);
  else if (tool.mode === "scatter") after = scatterFeatures(before, tool.featureKind, disc, tool.density, seed, bounds);
  else after = eraseFeatures(before, disc, tool.featureKind).features;
  return after.length === before.length ? null : { t: "features", before, after };
}

function fieldDab(map: EditorMap, tool: Extract<Tool, { kind: "field" }>, x: number, y: number): Edit | null {
  const before = map.spec.fields;
  let after: Field[];
  if (tool.mode === "place") {
    const placed = placeField(before, Math.round(x), Math.round(y), Math.round(tool.radius), Math.round(tool.amount), map.spec);
    if ("error" in placed) return null;
    after = placed;
  } else {
    const r2 = tool.radius * tool.radius;
    after = before.filter((f) => (f.x - x) ** 2 + (f.y - y) ** 2 > r2);
  }
  return after.length === before.length ? null : { t: "fields", before, after };
}

function apply(map: EditorMap, e: Edit, dir: "forward" | "back"): void {
  const side = dir === "forward" ? "after" : "before";
  switch (e.t) {
    case "height": applyChanges(map.spec.heights, e.changes, side); break;
    case "material": applyMaterialChanges(map.materials, e.changes, side); break;
    case "features": map.spec.features = [...e[side]]; break;
    case "fields": map.spec.fields = [...e[side]]; break;
  }
}

/** One edit per kind, in order of first appearance. */
function mergeEdits(edits: readonly Edit[]): Edit[] {
  const out: Edit[] = [];
  for (const e of edits) {
    const i = out.findIndex((m) => m.t === e.t);
    if (i < 0) out.push(copy(e));
    else out[i] = mergeInto(out[i]!, e);
  }
  return out;
}

function mergeInto(a: Edit, b: Edit): Edit {
  if (a.t === "height" && b.t === "height") return { t: "height", changes: mergeChanges(a.changes, b.changes) };
  if (a.t === "material" && b.t === "material") return { t: "material", changes: mergeChanges(a.changes, b.changes) };
  if (a.t === "features" && b.t === "features") return { t: "features", before: a.before, after: b.after };
  if (a.t === "fields" && b.t === "fields") return { t: "fields", before: a.before, after: b.after };
  return a;
}

/** Each index keeps its first `before` and last `after`. */
function mergeChanges<C extends { index: number; after: unknown }>(a: readonly C[], b: readonly C[]): C[] {
  const byIndex = new Map<number, C>();
  for (const c of a) byIndex.set(c.index, c);
  for (const c of b) {
    const prev = byIndex.get(c.index);
    byIndex.set(c.index, prev ? { ...prev, after: c.after } : c);
  }
  return [...byIndex.values()];
}

function copy(e: Edit): Edit {
  return e.t === "height" || e.t === "material" ? ({ ...e, changes: [...e.changes] } as Edit) : e;
}

function indexBounds(changes: readonly { index: number }[], cols: number): VertexRect | null {
  if (changes.length === 0) return null;
  let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
  for (const { index } of changes) {
    const i = index % cols;
    const j = (index - i) / cols;
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  return { i0, j0, i1, j1 };
}

function nearestVertex(cell: number, cols: number, rows: number, x: number, y: number): number {
  const i = Math.max(0, Math.min(cols - 1, Math.round(x / cell)));
  const j = Math.max(0, Math.min(rows - 1, Math.round(y / cell)));
  return j * cols + i;
}
