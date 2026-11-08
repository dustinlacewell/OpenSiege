import type { Unit } from "@mf/sim";
import type { Vision } from "./vision.ts";

/**
 * A selection rectangle on the ground: two opposite corners and the camera yaw it was started at.
 * Its sides run along the screen-right and screen-forward directions of that yaw, so it looks square to the view.
 */
export interface GroundBox {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  yaw: number;
}

/** The four corners as x,y pairs in order around the box. */
export function groundBoxCorners(b: GroundBox): number[] {
  const { ux, uy, vx, vy } = axes(b.yaw);
  const du = (b.bx - b.ax) * ux + (b.by - b.ay) * uy;
  const dv = (b.bx - b.ax) * vx + (b.by - b.ay) * vy;
  return [
    b.ax, b.ay,
    b.ax + ux * du, b.ay + uy * du,
    b.bx, b.by,
    b.ax + vx * dv, b.ay + vy * dv,
  ];
}

/** Ids of accepted, shown units whose ground position is inside the box. */
export function unitsInGroundBox(units: readonly Unit[], vision: Vision, b: GroundBox, accept: (u: Unit) => boolean): number[] {
  const { ux, uy, vx, vy } = axes(b.yaw);
  const a = ux * b.ax + uy * b.ay, c = vx * b.ax + vy * b.ay;
  const p = ux * b.bx + uy * b.by, q = vx * b.bx + vy * b.by;
  const u0 = Math.min(a, p), u1 = Math.max(a, p), v0 = Math.min(c, q), v1 = Math.max(c, q);
  const out: number[] = [];
  for (const u of units) {
    const pu = ux * u.x + uy * u.y, pv = vx * u.x + vy * u.y;
    if (pu >= u0 && pu <= u1 && pv >= v0 && pv <= v1 && vision.shows(u) && accept(u)) out.push(u.id);
  }
  return out;
}

/** Screen-right (u) and a perpendicular (v) on the ground at this yaw. */
function axes(yaw: number): { ux: number; uy: number; vx: number; vy: number } {
  const ux = Math.cos(yaw), uy = Math.sin(yaw);
  return { ux, uy, vx: -uy, vy: ux };
}
