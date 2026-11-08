import type { Intent } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import type { Session } from "../game/session.ts";
import { NO_GUIDE, type Guide } from "../game/tutorial/guide.ts";
import type { Vision } from "../game/vision.ts";
import { buildActions, type BuildActions } from "./actions/build.ts";
import { cameraActions, type CameraActions } from "./actions/camera.ts";
import { commandActions, type CommandActions } from "./actions/command.ts";
import { actionContext } from "./actions/context.ts";
import { guideActions, type GuideActions } from "./actions/guide.ts";
import { hotkeyActions, type HotkeyActions } from "./actions/hotkey.ts";
import { pickActions, type PickActions } from "./actions/pick.ts";
import { selectActions, type SelectActions } from "./actions/select.ts";
import { targetActions, type TargetActions } from "./actions/target.ts";
import { viewActions, type ViewActions } from "./actions/view.ts";

export { goHome } from "./actions/camera.ts";

/** What the player can do. Input and HUD call these; they turn into selection changes, camera moves and intents. */
export interface Actions
  extends SelectActions, CommandActions, BuildActions, TargetActions, CameraActions, PickActions, ViewActions, GuideActions, HotkeyActions {}

/**
 * Composes one action group per concern over a shared context. `vision` decides which enemies can be picked.
 * `sendSpot` sends a factory spot in the pick phase. `onIdleEscape` runs when Esc has no target mode to leave.
 * `simpleGroups` reads the setting that makes group keys select by unit kind.
 * `guide` gates intents, target modes and selection (`context.ts`), and takes Continue. A normal match uses NO_GUIDE.
 */
export function createActions(
  session: Session, cam: Camera, vision: Vision, send: (intent: Intent) => void, sendSpot: (x: number, y: number) => void,
  onIdleEscape: () => void, simpleGroups: () => boolean, guide: Guide = NO_GUIDE,
): Actions {
  const ctx = actionContext(session, cam, vision, send, guide);
  const groups = {
    ...selectActions(ctx),
    ...commandActions(ctx),
    ...buildActions(ctx),
    ...targetActions(ctx),
    ...cameraActions(ctx),
    ...pickActions(ctx, sendSpot),
    ...viewActions(ctx),
    ...guideActions(ctx),
  };
  return { ...groups, ...hotkeyActions(ctx, groups, onIdleEscape, simpleGroups) };
}
