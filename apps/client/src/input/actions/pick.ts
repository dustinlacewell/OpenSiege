import { groundAt } from "../../game/picking.ts";
import { vec3 } from "../../game/mat4.ts";
import type { ActionContext } from "./context.ts";

/** The pick phase: a left click on the ground chooses the factory spot. */
export interface PickActions {
  /** In the pick phase, sends the ground point under the cursor and returns true. Else returns false and does nothing. */
  chooseSpot(sx: number, sy: number): boolean;
}

export function pickActions(ctx: ActionContext, sendSpot: (x: number, y: number) => void): PickActions {
  const { session, cam } = ctx;
  const ground = vec3();
  return {
    chooseSpot(sx, sy) {
      const world = session.pickWorld;
      if (!world) return false;
      if (groundAt(cam, world.terrain, sx, sy, ground)) sendSpot(ground[0]!, ground[1]!);
      return true;
    },
  };
}
