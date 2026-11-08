import type { Actions } from "../input/actions.ts";
import { byId, setHidden, setSrc, setText } from "./dom.ts";
import { setClass, setWidthPct } from "./domStyle.ts";
import type { Portraits } from "./portraits.ts";
import { MULTI_SLOTS, type SelectionView, type UnitCard } from "./selectionModel.ts";

/** One small headshot with a thin health bar and its control group number. Click keeps only this unit; Shift-click drops it. */
class UnitTile {
  readonly el = document.createElement("div");
  private readonly img = document.createElement("img");
  private readonly bar = document.createElement("div");
  private readonly fill = document.createElement("div");
  private readonly more = document.createElement("span");
  private readonly group = document.createElement("span");
  private id = 0;

  constructor(actions: Actions) {
    this.img.alt = "";
    this.bar.className = "u-bar";
    this.fill.className = "hp-fill";
    this.more.className = "u-more";
    this.group.className = "u-group";
    this.bar.append(this.fill);
    this.el.append(this.img, this.bar, this.more, this.group);
    this.el.addEventListener("click", (e) => {
      if (this.id === 0) return;
      if (e.shiftKey) actions.deselect(this.id);
      else actions.selectOnly(this.id);
    });
  }

  showUnit(c: UnitCard, portraits: Portraits): void {
    this.id = c.id;
    setHidden(this.el, false);
    setClass(this.el, "u-tile");
    setSrc(this.img, portraits.url(c.kind));
    setHidden(this.bar, false);
    setWidthPct(this.fill, c.hpPct);
    setClass(this.fill, `hp-fill ${c.tone}`);
    setText(this.more, "");
    setText(this.group, c.group > 0 ? String(c.group) : "");
  }

  showMore(n: number): void {
    this.id = 0;
    setHidden(this.el, false);
    setClass(this.el, "u-tile more");
    setSrc(this.img, "");
    setHidden(this.bar, true);
    setText(this.more, `+${n}`);
    setText(this.group, "");
  }

  hide(): void {
    this.id = 0;
    setHidden(this.el, true);
  }
}

/** Several selected units: a fixed grid of MULTI_SLOTS tiles. */
export class MultiView {
  private readonly root = byId("unit-multi");
  private readonly tiles: UnitTile[];

  constructor(actions: Actions, private readonly portraits: Portraits) {
    this.tiles = Array.from({ length: MULTI_SLOTS }, () => new UnitTile(actions));
    this.root.append(...this.tiles.map((t) => t.el));
  }

  /** `s` is null unless two or more units are selected. */
  update(s: SelectionView | null): void {
    setHidden(this.root, !s);
    if (!s) return;
    this.tiles.forEach((tile, i) => {
      const c = s.cards[i];
      if (c) tile.showUnit(c, this.portraits);
      else if (i === s.cards.length && s.more > 0) tile.showMore(s.more);
      else tile.hide();
    });
  }
}
