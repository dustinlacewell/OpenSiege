import { centerOn, type Camera } from "../game/camera.ts";
import { addToGroup, centreOf, isDoubleTap, kindMembers, liveMembers, saveGroup } from "../game/controlGroups.ts";
import type { GroupOp } from "../game/hotkeys.ts";
import { unitById } from "../game/lookup.ts";
import type { Session } from "../game/session.ts";

/**
 * A control group key. Save replaces group `n` with the own selection; add joins it.
 * Recall selects the living members; a quick second recall of the same group centres the camera. `at` is ms.
 * With `simple`, group `n` is fixed to every own unit of one kind (`SIMPLE_GROUP_KINDS`): save and add do nothing.
 * `select` replaces the selection; the caller gates it (`ActionContext.select`).
 */
export function groupKey(
  session: Session, cam: Camera, select: Select, n: number, op: GroupOp, at: number, simple: boolean,
): void {
  const w = session.world;
  if (!w) return;
  if (simple) {
    if (op === "recall") recall(session, cam, select, n, at, kindMembers(w.units, session.me, n));
    return;
  }
  const own = session.selected.filter((id) => unitById(w.units, id)?.owner === session.me);
  if (op === "save") session.groups = saveGroup(session.groups, n, own);
  else if (op === "add") session.groups = addToGroup(session.groups, n, own);
  else recallSaved(session, cam, select, n, at);
}

/** Replaces the selection with `ids`. */
type Select = (ids: readonly number[]) => void;

function recallSaved(session: Session, cam: Camera, select: Select, n: number, at: number): void {
  const ids = liveMembers(session.groups, n, session.world!.units);
  session.groups = saveGroup(session.groups, n, ids);
  recall(session, cam, select, n, at, ids);
}

function recall(session: Session, cam: Camera, select: Select, n: number, at: number, ids: readonly number[]): void {
  const double = isDoubleTap(session.lastRecall, n, at);
  session.lastRecall = double ? null : { n, at };
  if (ids.length === 0) return;
  select(ids);
  const c = double ? centreOf(session.world!.units, ids) : null;
  if (c) centerOn(cam, c.x, c.y);
}
