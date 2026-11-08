import {
  commitStroke, editBounds, newSession, previewDab, redoLast, resizeMap, symmetricDab, symmetricPoints, symmetryTransforms, undoLast,
  type DabPreview, type Edit, type EditorMap, type MapProps, type Point, type Session, type Transform, type VertexRect,
} from "@mf/map";
import { heightAt, seaLevelOf } from "@mf/sim";
import { MapScene } from "./mapScene.ts";
import { cursorRadius, DEFAULT_SETTINGS, placesOnce, toolOf, type Settings } from "./settings.ts";
import { Stroke } from "./stroke.ts";
import type { Viewport } from "./viewport.ts";

/** What changed: a new or resized map, an edit (or undo/redo), the name or base height, or the tool panel. */
export type Change = "load" | "edit" | "props" | "settings";

/**
 * The editing session and what the viewport shows of it. A dab edits the map in place, then refreshes only what it
 * touched: height dabs grow a dirty rectangle (its mesh rows rewritten once per frame in `flush`), material dabs upload their rectangle,
 * feature and field dabs rebuild the scene's placements. A stroke that changed heights renews the terrain at its end,
 * so features and ground cover follow the new ground.
 */
export class Editor {
  session!: Session;
  scene!: MapScene;
  settings: Settings = DEFAULT_SETTINGS;
  private stroke: Stroke | null = null;
  private meshDirty: VertexRect | null = null;
  private readonly listeners: ((c: Change) => void)[] = [];

  private nextSeed: number;

  constructor(private readonly viewport: Viewport, map: EditorMap, private readonly random: () => number) {
    this.nextSeed = this.freshSeed();
    this.bind(map);
  }

  get map(): EditorMap {
    return this.session.map;
  }

  listen(fn: (c: Change) => void): void {
    this.listeners.push(fn);
  }

  load(map: EditorMap): void {
    this.stroke = null;
    this.bind(map);
    this.emit("load");
  }

  /** Same size: only the name and base height change. A new size resizes the map, which reloads it and clears undo. */
  setProps(p: MapProps): void {
    const { width, height } = this.map.spec;
    if (p.width !== width || p.height !== height) return this.load(resizeMap(this.map, p));
    this.map.name = p.name;
    this.map.baseHeight = p.baseHeight;
    this.emit("props");
  }

  update(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.emit("settings");
  }

  setColor(channel: number, color: [number, number, number]): void {
    const p = this.map.palette;
    p[channel] = { ...p[channel]!, color };
    this.viewport.setPalette(p);
    this.emit("edit");
  }

  beginStroke(x: number, y: number): void {
    const s = this.settings;
    const flattenTo = s.tool === "flatten" ? Math.round(heightAt(this.scene.terrain, x, y)) : undefined;
    const seed = this.nextSeed;
    this.nextSeed = this.freshSeed();
    this.stroke = new Stroke(toolOf(s, flattenTo), seed, cursorRadius(s), placesOnce(s));
    this.paint(x, y);
  }

  paint(x: number, y: number): void {
    const st = this.stroke;
    if (!st || !st.due(x, y)) return;
    const edits = symmetricDab(this.session, st.tool, x, y, st.dabSeed(), this.transforms());
    st.record(x, y, edits);
    for (const e of edits) this.show(e);
  }

  /**
   * What the next dab at `p` would place or erase. It uses the seed that dab will use, so a scatter preview is
   * exactly what a press makes.
   */
  preview(p: Point): DabPreview | null {
    const st = this.stroke;
    if (st && placesOnce(this.settings)) return null;
    const seed = st ? st.dabSeed() : this.nextSeed;
    return previewDab(this.map, st ? st.tool : toolOf(this.settings), p.x, p.y, seed, this.transforms());
  }

  private freshSeed(): number {
    return Math.floor(this.random() * 0x100000000) >>> 0;
  }

  /** Where a dab at `p` lands, copies included. */
  copiesOf(p: Point): Point[] {
    return symmetricPoints(p, this.transforms(), this.map.spec, cursorRadius(this.settings));
  }

  private transforms(): Transform[] {
    return symmetryTransforms({ order: this.settings.symmetry, mirror: this.settings.mirror }, this.map.spec);
  }

  endStroke(): void {
    const st = this.stroke;
    if (!st) return;
    this.stroke = null;
    commitStroke(this.session, st.edits);
    if (st.touchedHeights()) this.renewTerrain();
    this.emit("edit");
  }

  /** Ignored mid-stroke: the stroke is not on the stack yet. */
  undo(): void {
    if (!this.stroke) this.swapped(undoLast(this.session));
  }

  redo(): void {
    if (!this.stroke) this.swapped(redoLast(this.session));
  }

  /** Call once per frame before drawing. The sea level follows the edited heights, so the water does too. */
  flush(): void {
    if (!this.meshDirty) return;
    const terrain = this.scene.terrain;
    terrain.seaLevel = seaLevelOf(terrain.heights);
    this.viewport.updateMesh(terrain, this.meshDirty);
    this.meshDirty = null;
  }

  private bind(map: EditorMap): void {
    this.session = newSession(map);
    this.scene = new MapScene(map.spec);
    this.viewport.setMap(map);
  }

  /** Refreshes what one dab changed. */
  private show(e: Edit): void {
    if (e.t === "height") this.markMesh(e);
    else if (e.t === "material") this.uploadMaterials(e);
    else this.scene.syncPlacements();
  }

  private markMesh(e: Edit): void {
    const r = editBounds(e, this.cols());
    if (!r) return;
    const d = this.meshDirty;
    this.meshDirty = d ? { i0: Math.min(d.i0, r.i0), j0: Math.min(d.j0, r.j0), i1: Math.max(d.i1, r.i1), j1: Math.max(d.j1, r.j1) } : r;
  }

  private cols(): number {
    return this.map.spec.width / this.map.spec.cell + 1;
  }

  private swapped(e: Edit | null): void {
    if (!e) return;
    if (e.t === "height") this.renewTerrain();
    else this.show(e);
    this.emit("edit");
  }

  private uploadMaterials(e: Edit): void {
    const rect = editBounds(e, this.cols());
    if (rect) this.viewport.uploadMaterials(this.map.materials.weights, rect);
  }

  private renewTerrain(): void {
    this.meshDirty = null;
    this.scene.renewTerrain();
  }

  private emit(c: Change): void {
    for (const fn of this.listeners) fn(c);
  }
}
