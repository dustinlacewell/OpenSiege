import { heightAt, type Terrain } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { colorCss } from "../game/palette.ts";
import type { Placement, PlacementMark, PlacementRow } from "../game/placement.ts";
import { project, type ScreenPoint } from "../game/picking.ts";
import { byId, setHidden, setText } from "./dom.ts";

/** The pick screen over the terrain: a panel (title, countdown, who has picked, Leave) and a marker on the map for every pick. */
export class PickView {
  private readonly panel = byId("pick");
  private readonly marksLayer = byId("pick-marks");
  private readonly title = byId("pick-title");
  private readonly count = byId("pick-count");
  private readonly list = byId("pick-list");
  private readonly marks = new Map<number, HTMLElement>();
  private readonly at: ScreenPoint = { x: 0, y: 0 };
  private placement: Placement | null = null;
  private shownRows = "";

  constructor() {
    byId("pick-leave").addEventListener("click", () => this.placement?.leave());
  }

  show(placement: Placement): void {
    this.placement = placement;
    setHidden(this.panel, false);
    setHidden(this.marksLayer, false);
  }

  hide(): void {
    this.placement = null;
    setHidden(this.panel, true);
    setHidden(this.marksLayer, true);
    this.marks.forEach((el) => el.remove());
    this.marks.clear();
    this.shownRows = "";
  }

  /** Call every frame while picking: redraws the panel and puts the markers where the camera sees the spots. */
  update(now: number, cam: Camera, terrain: Terrain | null): void {
    if (!this.placement) return;
    const v = this.placement.view(now);
    setText(this.title, v.title);
    setText(this.count, v.countdown);
    setHidden(this.count, v.countdown === "");
    this.drawRows(v.rows);
    this.drawMarks(v.marks, cam, terrain);
  }

  private drawRows(rows: readonly PlacementRow[]): void {
    const key = JSON.stringify(rows);
    if (key === this.shownRows) return;
    this.shownRows = key;
    this.list.replaceChildren(...rows.map(rowItem));
  }

  /** One marker per player (colour = team). Markers for spots that are gone are removed. */
  private drawMarks(marks: readonly PlacementMark[], cam: Camera, terrain: Terrain | null): void {
    const live = new Set<number>();
    for (const mark of marks) {
      live.add(mark.id);
      const el = this.markFor(mark);
      const z = terrain ? heightAt(terrain, mark.x, mark.y) : 0;
      const seen = project(cam, mark.x, mark.y, z, this.at);
      setHidden(el, !seen);
      if (seen) el.style.transform = `translate(${this.at.x}px, ${this.at.y}px)`;
    }
    for (const [id, el] of this.marks) {
      if (live.has(id)) continue;
      el.remove();
      this.marks.delete(id);
    }
  }

  private markFor(mark: PlacementMark): HTMLElement {
    let el = this.marks.get(mark.id);
    if (!el) {
      el = document.createElement("div");
      const label = document.createElement("span");
      el.append(label);
      this.marksLayer.append(el);
      this.marks.set(mark.id, el);
    }
    const label = el.firstElementChild as HTMLElement;
    setText(label, mark.name);
    label.style.color = colorCss(mark.team);
    el.className = mark.me ? "pick-mark me" : "pick-mark";
    el.style.setProperty("--c", colorCss(mark.team));
    return el;
  }
}

function rowItem(row: PlacementRow): HTMLLIElement {
  const li = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = row.name;
  name.style.color = colorCss(row.team);
  const check = document.createElement("span");
  check.textContent = row.picked ? "✓" : "";
  li.append(name, check);
  li.className = row.me ? "me" : "";
  return li;
}
