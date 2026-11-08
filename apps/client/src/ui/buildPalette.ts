import { GRID_SLOTS, type GridSlot } from "../game/buildGrid.ts";
import type { Actions } from "../input/actions.ts";
import { byId, setHidden, setSrc, setText } from "./dom.ts";
import { setClass } from "./domStyle.ts";
import type { PaletteSlot } from "./guideModel.ts";
import type { HudModel } from "./model.ts";
import type { Portraits } from "./portraits.ts";

/**
 * One square slot: headshot, cost and key letter in the corners, quota badge top-left.
 * Click builds when enabled; Shift+click builds a batch. Ctrl+click raises the quota, Ctrl+right-click lowers it.
 * A locked slot ignores build clicks; a quota-locked slot ignores quota clicks and dims its quota badge.
 */
class SlotTile {
  readonly el = document.createElement("div");
  private readonly img = document.createElement("img");
  private readonly cost = document.createElement("span");
  private readonly key = document.createElement("span");
  private readonly quota = quotaBadge();
  slot: PaletteSlot | null = null;

  constructor(actions: Actions) {
    this.img.alt = "";
    this.cost.className = "slot-cost";
    this.key.className = "slot-key";
    this.el.append(this.img, this.cost, this.key, this.quota);
    this.el.addEventListener("click", (e) => {
      const s = this.slot;
      if (!s?.kind) return;
      if (e.ctrlKey) {
        if (!s.quotaLocked) actions.adjustQuota(s.kind, 1);
      } else if (s.enabled && !s.locked) actions.build(s.kind, e.shiftKey);
    });
    this.el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const s = this.slot;
      if (s?.kind && !s.quotaLocked && e.ctrlKey) actions.adjustQuota(s.kind, -1);
    });
  }

  update(s: PaletteSlot, portraits: Portraits): void {
    this.slot = s;
    setClass(this.el, slotClass(s));
    setSrc(this.img, s.kind ? portraits.url(s.kind) : "");
    setText(this.cost, s.kind ? String(s.cost) : "");
    setText(this.key, s.kind ? s.key : "");
    setText(this.quota, s.quota > 0 ? String(s.quota) : "");
  }
}

function slotClass(s: PaletteSlot): string {
  if (!s.kind) return "slot empty";
  return ["slot", !s.enabled && "off", s.locked && "locked", s.quotaLocked && "quota-locked", s.focus && "focus"].filter(Boolean).join(" ");
}

/** The corner text style of `slot-key`, moved to the top-left corner. */
function quotaBadge(): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "slot-key slot-quota";
  el.style.left = "4px";
  el.style.right = "auto";
  el.style.color = "#7fd0ff";
  return el;
}

/** The fixed tooltip box: name, cost and build time of the hovered slot. */
class SlotTip {
  private readonly body = byId("tip-body");
  private readonly name = byId("tip-name");
  private readonly cost = byId("tip-cost");
  private readonly time = byId("tip-time");

  show(s: GridSlot | null): void {
    setHidden(this.body, !s?.kind);
    if (!s?.kind) return;
    setText(this.name, s.kind);
    setText(this.cost, String(s.cost));
    setText(this.time, `${s.seconds} s`);
  }
}

/** Page tabs. Shown only when there is more than one page. */
class PageTabs {
  private readonly root = byId("palette-pages");
  private tabs: HTMLButtonElement[] = [];

  constructor(private readonly actions: Actions) {}

  update(page: number, pages: number): void {
    setHidden(this.root, pages <= 1);
    if (this.tabs.length !== pages) this.build(pages);
    this.tabs.forEach((t, i) => setClass(t, i === page ? "page-tab on" : "page-tab"));
  }

  private build(pages: number): void {
    this.tabs = Array.from({ length: pages }, (_, i) => {
      const t = document.createElement("button");
      t.textContent = String(i + 1);
      t.addEventListener("click", () => this.actions.showBuildPage(i));
      return t;
    });
    this.root.replaceChildren(...this.tabs);
  }
}

/** The 3x3 build grid, its page tabs and the hover tooltip. */
export class BuildPalette {
  private readonly tiles: SlotTile[];
  private readonly tip = new SlotTip();
  private readonly pages: PageTabs;
  private hovered: SlotTile | null = null;

  constructor(actions: Actions, private readonly portraits: Portraits) {
    this.pages = new PageTabs(actions);
    this.tiles = Array.from({ length: GRID_SLOTS }, () => this.makeTile(actions));
    byId("palette").append(...this.tiles.map((t) => t.el));
  }

  update(m: HudModel): void {
    if (!m.hasSelection) this.hovered = null; // the card is hidden; mouseleave may not fire
    this.tiles.forEach((t, i) => t.update(m.palette[i]!, this.portraits));
    this.pages.update(m.page, m.pages);
    this.tip.show(this.hovered?.slot ?? null);
  }

  private makeTile(actions: Actions): SlotTile {
    const tile = new SlotTile(actions);
    tile.el.addEventListener("mouseenter", () => this.hover(tile));
    tile.el.addEventListener("mouseleave", () => this.hover(null));
    return tile;
  }

  private hover(tile: SlotTile | null): void {
    this.hovered = tile;
    this.tip.show(tile?.slot ?? null);
  }
}
