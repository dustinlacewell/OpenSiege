import type { UnitKind } from "@mf/sim";
import { setHidden, setSrc, setText } from "./dom.ts";
import { setClass, setWidthPct } from "./domStyle.ts";
import type { Portraits } from "./portraits.ts";
import { NEXT_TILES, type FactoryQueue, type HeadTile, type RunTile } from "./queueModel.ts";

/** Right-click on a job tile: cancel from the end of the tile's `jobs` (ids); `many` (Shift) cancels a batch. */
export type CancelJob = (jobs: readonly number[], many: boolean) => void;

/** One queue tile: a headshot with a progress fill (head) or a count badge (run), or a "+N" label. */
class Tile {
  readonly el = document.createElement("div");
  private readonly img = document.createElement("img");
  private readonly fill = document.createElement("div");
  private readonly badge = document.createElement("span");
  private lastPct = 0;
  /** Job ids a right-click cancels from, in queue order. Empty: nothing to cancel. */
  private jobs: readonly number[] = [];

  constructor(cancel: CancelJob) {
    this.img.alt = "";
    this.fill.className = "q-fill";
    this.badge.className = "q-count";
    this.el.append(this.img, this.fill, this.badge);
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
    this.el.addEventListener("pointerdown", (e) => {
      if (e.button === 2 && this.jobs.length > 0) cancel(this.jobs, e.shiftKey);
    });
  }

  /** `locked`: the tile shows the guide's lock; the row drops its cancels. */
  showHead(head: HeadTile | null, portraits: Portraits, locked: boolean): void {
    setHidden(this.el, false);
    this.jobs = head ? [head.job] : [];
    setClass(this.el, head ? lockedClass("q-tile head", locked) : "q-tile head empty");
    this.picture(head?.kind ?? null, portraits);
    setText(this.badge, "");
    this.progress(head?.pct ?? 0);
  }

  showRun(run: RunTile, portraits: Portraits, locked: boolean): void {
    setHidden(this.el, false);
    this.jobs = run.jobs;
    setClass(this.el, lockedClass("q-tile", locked));
    this.picture(run.kind, portraits);
    setText(this.badge, run.count > 1 ? `×${run.count}` : "");
    this.progress(0);
  }

  showRest(n: number): void {
    setHidden(this.el, false);
    this.jobs = [];
    setClass(this.el, "q-tile more");
    this.picture(null, null);
    setText(this.badge, `+${n}`);
    this.progress(0);
  }

  hide(): void {
    this.jobs = [];
    setHidden(this.el, true);
  }

  private picture(kind: UnitKind | null, portraits: Portraits | null): void {
    setSrc(this.img, kind && portraits ? portraits.url(kind) : "");
  }

  private progress(pct: number): void {
    // A new head job restarts at 0: jump back instead of animating backwards.
    const instant = pct < this.lastPct ? "none" : "";
    if (this.fill.style.transition !== instant) this.fill.style.transition = instant;
    setWidthPct(this.fill, pct);
    this.lastPct = pct;
  }
}

/** One factory: speed tag, the head job (large, with progress), seconds left, then the rest as grouped runs. */
export class QueueRow {
  readonly el = document.createElement("div");
  private readonly tag = document.createElement("span");
  private readonly head: Tile;
  private readonly time = document.createElement("span");
  private readonly next: Tile[];
  private factory = 0;
  private locked = false;

  constructor(private readonly portraits: Portraits, cancel: (factory: number, jobs: readonly number[], many: boolean) => void) {
    const onTile: CancelJob = (jobs, many) => {
      if (!this.locked) cancel(this.factory, jobs, many);
    };
    this.head = new Tile(onTile);
    this.next = Array.from({ length: NEXT_TILES }, () => new Tile(onTile));
    this.el.className = "q-row";
    this.tag.className = "q-tag";
    this.time.className = "q-time";
    const strip = document.createElement("div");
    strip.className = "q-tiles";
    strip.append(...this.next.map((t) => t.el));
    this.el.append(this.tag, this.head.el, this.time, strip);
  }

  /** `locked`: the guide forbids cancel. */
  update(q: FactoryQueue, locked: boolean): void {
    this.factory = q.id;
    this.locked = locked;
    setText(this.tag, q.rate > 0 ? `${q.mode} ×${q.rate}` : `${q.mode} · paused`);
    setClass(this.tag, `q-tag ${q.rate === 0 ? "paused" : q.slow ? "slow" : "fast"}`);
    this.head.showHead(q.head, this.portraits, locked);
    setText(this.time, q.secondsLeft === null ? "" : `${q.secondsLeft}s`);
    this.next.forEach((tile, i) => {
      const run = q.next[i];
      if (run) tile.showRun(run, this.portraits, locked);
      else if (i === q.next.length && q.rest > 0) tile.showRest(q.rest);
      else tile.hide();
    });
  }

  setHidden(hidden: boolean): void {
    setHidden(this.el, hidden);
  }
}

function lockedClass(base: string, locked: boolean): string {
  return locked ? `${base} locked` : base;
}
