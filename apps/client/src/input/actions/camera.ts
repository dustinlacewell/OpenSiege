import { centerOn, type Camera } from "../../game/camera.ts";
import type { Session } from "../../game/session.ts";
import { zoomAt } from "../../game/zoom.ts";
import type { ActionContext } from "./context.ts";

/** Camera moves the player asks for. */
export interface CameraActions {
  jumpTo(wx: number, wy: number): void;
  zoom(sx: number, sy: number, factor: number): void;
}

export function cameraActions(ctx: ActionContext): CameraActions {
  const { session, cam } = ctx;
  return {
    jumpTo(wx, wy) {
      centerOn(cam, wx, wy);
    },
    zoom(sx, sy, factor) {
      zoomAt(cam, session.terrain, sx, sy, factor);
    },
  };
}

/** Centre the camera on the local player's first factory. Returns false if there is none. */
export function goHome(session: Session, cam: Camera): boolean {
  const factory = session.world?.units.find((u) => u.owner === session.me && u.kind === "factory");
  if (!factory) return false;
  centerOn(cam, factory.x, factory.y);
  return true;
}
