import type { Actions } from "../input/actions.ts";
import { byId, setHidden } from "./dom.ts";
import type { HudModel } from "./model.ts";
import { MultiView } from "./multiView.ts";
import type { Portraits } from "./portraits.ts";
import { QueueView } from "./queueView.ts";
import { SingleView } from "./singleView.ts";

/** Centre console box: one unit's card or a tile grid; the factory queue band below. Hidden with no selection. */
export class UnitPanel {
  private readonly root = byId("unit-panel");
  private readonly single: SingleView;
  private readonly multi: MultiView;
  private readonly queue: QueueView;

  constructor(actions: Actions, portraits: Portraits) {
    this.single = new SingleView(portraits);
    this.multi = new MultiView(actions, portraits);
    this.queue = new QueueView(byId("queue"), actions, portraits);
  }

  update(m: HudModel): void {
    const s = m.selection;
    setHidden(this.root, !m.hasSelection);
    this.single.update(s.single);
    this.multi.update(s.count > 1 ? s : null);
    this.queue.update(m.queues, m.queueLocked);
  }
}
