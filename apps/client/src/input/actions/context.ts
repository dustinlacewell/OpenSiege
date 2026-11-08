import { isEnemy, type Intent, type Unit } from "@mf/sim";
import type { Camera } from "../../game/camera.ts";
import { vec3, type Vec3 } from "../../game/mat4.ts";
import { groundAt, unitAtScreen } from "../../game/picking.ts";
import { combine } from "../../game/selection.ts";
import type { Session } from "../../game/session.ts";
import { NO_GUIDE, type Guide } from "../../game/tutorial/guide.ts";
import type { Vision } from "../../game/vision.ts";

/** Screen pixels of pick tolerance around a unit. */
const PICK_PX = 6;

/** The injected dependencies and the screen-to-world helpers every action group shares. */
export interface ActionContext {
  readonly session: Session;
  readonly cam: Camera;
  readonly vision: Vision;
  /** Says which intents, target modes and selections the player may make. */
  readonly guide: Guide;
  /** Sends what the guide admits (maybe with units taken out), then tells the guide. A blocked intent is dropped. */
  send(intent: Intent): void;
  /** Sends the intent as `send` does, or nothing for null. */
  emit(intent: Intent | null): void;
  /** The visible unit under the cursor that passes `accept`, within PICK_PX. */
  pickAt(sx: number, sy: number, accept: (u: Unit) => boolean): Unit | undefined;
  /** The ground point under the cursor, or null. The vector is scratch: read it before the next call. */
  groundPoint(sx: number, sy: number): Vec3 | null;
  /** Replaces the selection with `hit`, or adds it when `additive`. Only the ids the guide finds selectable count.
   * A non-empty `hit` the guide filters to nothing leaves the selection as it is. An empty `hit` clears as usual.
   * While the guide holds the selection, nothing changes. */
  select(hit: readonly number[], additive: boolean): void;
  /** Drops `id` from the selection. Gated only by a guide that holds the selection. */
  unselect(id: number): void;
  own(u: Unit): boolean;
  /** On another team than the local player. An ally is not an enemy. */
  enemy(u: Unit): boolean;
}

export function actionContext(
  session: Session, cam: Camera, vision: Vision, sendRaw: (intent: Intent) => void, guide: Guide = NO_GUIDE,
): ActionContext {
  const ground = vec3();
  const send = (intent: Intent) => {
    const admitted = guide.admit(intent);
    if (!admitted) return;
    sendRaw(admitted);
    guide.noteSent(admitted);
  };
  return {
    session, cam, vision, guide, send,
    emit: (intent) => {
      if (intent) send(intent);
    },
    pickAt: (sx, sy, accept) => {
      const w = session.world;
      return w ? unitAtScreen(cam, w.terrain, w.units, vision, sx, sy, PICK_PX, accept) : undefined;
    },
    groundPoint: (sx, sy) => {
      const w = session.world;
      return w && groundAt(cam, w.terrain, sx, sy, ground) ? ground : null;
    },
    select: (hit, additive) => {
      if (guide.holdsSelection()) return;
      const allowed = guide.selectable(hit);
      if (hit.length > 0 && allowed.length === 0) return;
      session.select(combine(session.selected, allowed, additive));
    },
    unselect: (id) => {
      if (!guide.holdsSelection()) session.select(session.selected.filter((s) => s !== id));
    },
    own: (u) => u.owner === session.me,
    enemy: (u) => isEnemy(session.world?.players ?? [], session.me, u.owner),
  };
}
