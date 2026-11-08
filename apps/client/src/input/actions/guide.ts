import type { ActionContext } from "./context.ts";

/** What the player tells the tutorial guide. */
export interface GuideActions {
  /** Continue: ends the note on screen. Nothing on any other step or outside a tutorial. */
  acknowledge(): void;
}

export function guideActions(ctx: ActionContext): GuideActions {
  const { guide } = ctx;
  return {
    acknowledge: () => guide.acknowledge(),
  };
}
