import type { ActionContext } from "./context.ts";

/** Whose eyes a spectator looks through, or which side the dev sandbox commands. */
export interface ViewActions {
  /**
   * A watcher takes this player's view; the same player again goes back to the overview. Playing: no effect.
   * In the dev sandbox: command and see as this player.
   */
  viewPlayer(id: number): void;
}

export function viewActions(ctx: ActionContext): ViewActions {
  const { session } = ctx;
  return {
    viewPlayer(id) {
      if (session.sandbox) session.takeSide(id);
      else session.viewAs(session.me === id ? null : id);
    },
  };
}
