import type { UnitKind } from "@mf/sim";
import { BUILD_PAGES, slotKind } from "../../game/buildGrid.ts";
import * as commands from "../../game/commands.ts";
import type { ActionContext } from "./context.ts";

/** Factory production: build, cancel, quota, the palette page. */
export interface BuildActions {
  /** `batch`: up to BATCH jobs per selected factory, as many as fit and are affordable. */
  build(kind: UnitKind, batch: boolean): void;
  /** Builds the kind in slot `index` of the shown palette page. An empty slot does nothing. */
  buildSlot(index: number, batch: boolean): void;
  /** Cancels the last of `jobs` (ids, queue order); with `many`, the last BATCH of them, in one intent. */
  cancelJob(factory: number, jobs: readonly number[], many: boolean): void;
  /** Switches the build palette page. Out-of-range pages are ignored. */
  showBuildPage(page: number): void;
  /** Changes the quota for `kind` by `delta` on every selected own factory. */
  adjustQuota(kind: UnitKind, delta: number): void;
}

/** `build` sends nothing without a selected own factory. */
export function buildActions(ctx: ActionContext): BuildActions {
  const { session, send, emit } = ctx;
  const build = (kind: UnitKind, batch: boolean) => {
    const w = session.world;
    if (w) commands.build(w, session.me, session.selected, kind, batch ? commands.BATCH : 1).forEach(send);
  };
  return {
    build,
    buildSlot(index, batch) {
      const kind = slotKind(session.buildPage, index);
      if (kind) build(kind, batch);
    },
    cancelJob(factory, jobs, many) {
      const w = session.world;
      if (w) emit(commands.cancelJobs(w, session.me, factory, jobs, many));
    },
    showBuildPage(page) {
      if (page >= 0 && page < BUILD_PAGES.length) session.buildPage = page;
    },
    adjustQuota(kind, delta) {
      const w = session.world;
      if (w) commands.quota(w, session.me, session.selected, kind, delta).forEach(send);
    },
  };
}
