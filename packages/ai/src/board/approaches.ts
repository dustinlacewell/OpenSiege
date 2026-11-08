import type { ResourceField, Unit } from "@mf/sim";
import { within, type Point } from "../geometry.ts";
import { cellCentre } from "../danger/grid.ts";
import { dangerAt, type Danger } from "../danger/query.ts";

/** Danger this far from a place counts toward its approach. */
const LOOK = 3000;
/** A summed pull shorter than this has no direction. */
const NO_DIR = 1e-6;

/** Where danger comes from, for one factory or one worked field. `dir` is a unit vector toward the danger, null if none. */
export interface Approach {
  at: "factory" | "field";
  id: number;
  x: number;
  y: number;
  dir: Point | null;
}

/** One approach per own factory and per field an own harvester stands in. */
export function approaches(own: readonly Readonly<Unit>[], fields: readonly Readonly<ResourceField>[], danger: Danger): Approach[] {
  const factories = own.filter((u) => u.kind === "factory");
  const harvesters = own.filter((u) => u.kind === "harvester");
  const worked = fields.filter((f) => harvesters.some((h) => within(h, f, f.radius)));
  return [
    ...factories.map((u) => approach("factory", u.id, u, danger)),
    ...worked.map((f) => approach("field", f.id, f, danger)),
  ];
}

function approach(at: Approach["at"], id: number, p: Point, danger: Danger): Approach {
  return { at, id, x: p.x, y: p.y, dir: pull(p, danger) };
}

/** The normalised sum, over cells within `LOOK`, of danger times the unit vector toward the cell. */
function pull(p: Point, danger: Danger): Point | null {
  const cell = danger.live.cell;
  const lo = (v: number): number => Math.max(0, Math.floor((v - LOOK) / cell));
  const hiX = Math.min(danger.live.cols - 1, Math.floor((p.x + LOOK) / cell));
  const hiY = Math.min(danger.live.rows - 1, Math.floor((p.y + LOOK) / cell));
  let sx = 0;
  let sy = 0;
  for (let j = lo(p.y); j <= hiY; j++) {
    for (let i = lo(p.x); i <= hiX; i++) {
      const c = cellCentre(i, j);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d === 0 || d > LOOK) continue;
      const w = dangerAt(danger, c.x, c.y);
      sx += (w * (c.x - p.x)) / d;
      sy += (w * (c.y - p.y)) / d;
    }
  }
  const len = Math.hypot(sx, sy);
  return len < NO_DIR ? null : { x: sx / len, y: sy / len };
}
