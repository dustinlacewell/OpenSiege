import type { Intent } from "@mf/sim";
import type { Session } from "../game/session.ts";
import type { Actions } from "../input/actions.ts";
import type { UiSounds } from "./cues.ts";
import { intentCue } from "./intentCues.ts";

/** Wraps `send`: each intent the player sends plays its interface sound (`intentCue`). */
export function withIntentSounds(send: (intent: Intent) => void, session: Session, sounds: UiSounds): (intent: Intent) => void {
  return (intent) => {
    const cue = intentCue(intent, session.world, session.me);
    send(intent);
    if (cue) sounds.ui(cue);
  };
}

/** Wraps `Actions`: a click when a selecting action changes the selection to a non-empty one. */
export function withActionSounds(actions: Actions, session: Session, sounds: UiSounds): Actions {
  const selecting = (run: () => void) => {
    const before = session.selected;
    run();
    if (session.selected !== before && session.selected.length > 0) sounds.ui("select");
  };
  return {
    ...actions,
    clickSelect: (...a) => selecting(() => actions.clickSelect(...a)),
    kindSelect: (...a) => selecting(() => actions.kindSelect(...a)),
    boxSelect: (...a) => selecting(() => actions.boxSelect(...a)),
    selectOnly: (...a) => selecting(() => actions.selectOnly(...a)),
    hotkey: (...a) => selecting(() => actions.hotkey(...a)),
  };
}
