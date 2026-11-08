import { idleBuilders, idleHarvesters } from "../../game/idle.ts";
import { unitsInGroundBox } from "../../game/groundBox.ts";
import { unitsOnScreen } from "../../game/picking.ts";
import { ownOfKind, ownUnits } from "../../game/selection.ts";
import type { ActionContext } from "./context.ts";

/** Selection changes. Only own units can be selected. */
export interface SelectActions {
  clickSelect(sx: number, sy: number, additive: boolean): void;
  /** Own units of the clicked unit's kind: on screen, or anywhere on the map when `global`. */
  kindSelect(sx: number, sy: number, additive: boolean, global: boolean): void;
  /** A left press: anchors a selection box on the ground point under the cursor. */
  boxStart(sx: number, sy: number): void;
  /** Moves the box's free corner to the ground point under the cursor and highlights the own units inside. */
  boxDrag(sx: number, sy: number): void;
  /** Selects the own units inside the box, or adds them when `additive`, and drops the box. */
  boxSelect(additive: boolean): void;
  /** Drops the box without selecting. */
  boxCancel(): void;
  /** Every own unit. */
  selectAll(): void;
  /** Own engineers with no orders and own factories with an empty queue (`game/idle.ts`). */
  selectIdleBuilders(additive: boolean): void;
  /** Own harvesters with no orders that are not sieged in a non-empty field (`game/idle.ts`). */
  selectIdleHarvesters(additive: boolean): void;
  /** Keeps only this unit selected. */
  selectOnly(id: number): void;
  /** Drops this unit from the selection. */
  deselect(id: number): void;
}

export function selectActions(ctx: ActionContext): SelectActions {
  const { session, cam, vision, own, select, unselect, pickAt, groundPoint } = ctx;
  return {
    clickSelect(sx, sy, additive) {
      const u = pickAt(sx, sy, own);
      select(u ? [u.id] : [], additive);
    },
    kindSelect(sx, sy, additive, global) {
      const w = session.world;
      const u = pickAt(sx, sy, own);
      if (!w || !u) return;
      select(global
        ? ownOfKind(w.units, session.me, u.kind)
        : unitsOnScreen(cam, w.terrain, w.units, vision, (c) => own(c) && c.kind === u.kind), additive);
    },
    boxStart(sx, sy) {
      const g = groundPoint(sx, sy);
      if (g) session.box = { ax: g[0]!, ay: g[1]!, bx: g[0]!, by: g[1]!, yaw: cam.yaw };
    },
    boxDrag(sx, sy) {
      const w = session.world;
      const box = session.box;
      const g = groundPoint(sx, sy);
      if (!w || !box || !g) return;
      session.box = { ...box, bx: g[0]!, by: g[1]! };
      session.boxPreview = new Set(unitsInGroundBox(w.units, vision, session.box, own));
    },
    boxSelect(additive) {
      select([...session.boxPreview], additive);
      session.clearBox();
    },
    boxCancel() {
      session.clearBox();
    },
    selectAll() {
      select(ownUnits(session.world?.units ?? [], session.me), false);
    },
    selectIdleBuilders(additive) {
      const w = session.world;
      if (w) select(idleBuilders(w, session.me), additive);
    },
    selectIdleHarvesters(additive) {
      const w = session.world;
      if (w) select(idleHarvesters(w, session.me), additive);
    },
    selectOnly(id) {
      select([id], false);
    },
    deselect(id) {
      unselect(id);
    },
  };
}
