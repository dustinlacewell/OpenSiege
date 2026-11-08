import type { Hotkey } from "../../game/hotkeys.ts";
import { groupKey } from "../groupKeys.ts";
import type { BuildActions } from "./build.ts";
import { goHome } from "./camera.ts";
import type { CommandActions } from "./command.ts";
import type { ActionContext } from "./context.ts";
import type { GuideActions } from "./guide.ts";
import type { SelectActions } from "./select.ts";
import type { TargetActions } from "./target.ts";

export interface HotkeyActions {
  /** `shift` queues the siege toggle or builds a batch. `at` is the key time in ms. */
  hotkey(key: Hotkey, shift: boolean, at: number): void;
}

/** The actions a hotkey can reach. */
type Reachable = SelectActions & CommandActions & BuildActions & TargetActions & GuideActions;

/**
 * Routes each hotkey to the action group that owns it. Esc leaves a target mode, else cancels a right drag, else calls `onIdleEscape`.
 * `simpleGroups` says whether group keys select by unit kind (`groupKey`).
 */
export function hotkeyActions(ctx: ActionContext, to: Reachable, onIdleEscape: () => void, simpleGroups: () => boolean): HotkeyActions {
  const { session, cam } = ctx;
  const replaceSelection = (ids: readonly number[]) => ctx.select(ids, false);
  return {
    hotkey(key, shift, at) {
      switch (key.t) {
        case "siege": return to.siege(shift);
        case "stop": return to.stop();
        case "guard": return to.enterTarget("guard");
        case "attackMove": return to.enterTarget("attackMove");
        case "cancel": return void (to.cancel() || to.cancelDrag() || onIdleEscape());
        case "continue": return to.acknowledge();
        case "slot": return to.buildSlot(key.index, shift);
        case "home": return void goHome(session, cam);
        case "group": return groupKey(session, cam, replaceSelection, key.index, key.op, at, simpleGroups());
        case "selectAll": return to.selectAll();
        case "idleBuilders": return to.selectIdleBuilders(shift);
        case "idleHarvesters": return to.selectIdleHarvesters(shift);
      }
    },
  };
}
