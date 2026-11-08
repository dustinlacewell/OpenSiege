import type { Actions } from "../input/actions.ts";
import { setHidden, setText } from "./dom.ts";
import type { Portraits } from "./portraits.ts";
import { MAX_ROWS, type QueueSummary } from "./queueModel.ts";
import { QueueRow } from "./queueRow.ts";

/** Build queue band: one row per selected factory plus a "+N more" badge. Right-click a job tile to cancel it, unless locked. */
export class QueueView {
  private readonly rows: QueueRow[];
  private readonly more = document.createElement("div");

  constructor(private readonly root: HTMLElement, actions: Actions, portraits: Portraits) {
    const cancel = (factory: number, jobs: readonly number[], many: boolean) => actions.cancelJob(factory, jobs, many);
    this.rows = Array.from({ length: MAX_ROWS }, () => new QueueRow(portraits, cancel));
    this.more.className = "q-more";
    root.append(...this.rows.map((r) => r.el), this.more);
  }

  /** `locked`: the guide forbids cancel; tiles show it and ignore right-clicks. */
  update(q: QueueSummary, locked: boolean): void {
    setHidden(this.root, q.rows.length === 0);
    this.rows.forEach((row, i) => {
      const data = q.rows[i];
      row.setHidden(!data);
      if (data) row.update(data, locked);
    });
    setHidden(this.more, q.more === 0);
    setText(this.more, `+${q.more} more`);
  }
}
