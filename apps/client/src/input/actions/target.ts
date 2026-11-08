import type { Unit } from "@mf/sim";
import * as commands from "../../game/commands.ts";
import { unitById } from "../../game/lookup.ts";
import type { TargetKind } from "../../game/session.ts";
import type { ActionContext } from "./context.ts";

/** Target modes: the next left click picks a guard target or an attack-move point. */
export interface TargetActions {
  /** Enters a target mode when own units are selected and the guide may issue its intent. The next left click picks the target. */
  enterTarget(kind: TargetKind): void;
  /** The target mode, or null. */
  targetMode(): TargetKind | null;
  /** Guard mode: marks the own, unselected unit under the cursor, or none. Called every frame. */
  hoverTarget(at: { x: number; y: number } | null): void;
  /** Target mode left click: guard the own, unselected unit there, or attack-move to the ground point. Then leaves the mode. */
  targetAt(sx: number, sy: number, mods: commands.CommandMods): void;
  /** Leaves the target mode with no order. True when there was a mode to leave. */
  cancel(): boolean;
}

export function targetActions(ctx: ActionContext): TargetActions {
  const { session, guide, emit, pickAt, groundPoint, own } = ctx;
  const mayEnter = (kind: TargetKind) => guide.mayIssue(kind === "guard" ? "guard" : "move");
  const guardable = (u: Unit) => own(u) && !session.selectedSet.has(u.id);
  const hasOwnSelection = () => {
    const w = session.world;
    return w !== null && session.selected.some((id) => unitById(w.units, id)?.owner === session.me);
  };
  const guardAt = (sx: number, sy: number, queue: boolean) => {
    const u = pickAt(sx, sy, guardable);
    if (u) emit(commands.guard(session.selected, u.id, queue));
  };
  const attackMoveAt = (sx: number, sy: number, mods: commands.CommandMods) => {
    const g = groundPoint(sx, sy);
    if (g) emit(commands.attackMoveAt(session.selected, g[0]!, g[1]!, mods));
  };
  return {
    enterTarget(kind) {
      if (hasOwnSelection() && mayEnter(kind)) session.targetMode = kind;
    },
    targetMode() {
      return session.targetMode;
    },
    hoverTarget(at) {
      const u = session.targetMode === "guard" && at ? pickAt(at.x, at.y, guardable) : undefined;
      session.guardHover = u ? u.id : 0;
    },
    targetAt(sx, sy, mods) {
      const kind = session.targetMode;
      session.endTarget();
      if (kind === "guard") guardAt(sx, sy, mods.queue);
      else if (kind === "attackMove") attackMoveAt(sx, sy, mods);
    },
    cancel() {
      const was = session.targetMode !== null;
      session.endTarget();
      return was;
    },
  };
}
