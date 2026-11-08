import { byId, setHidden, setSrc, setText } from "./dom.ts";
import { setClass, setWidthPct } from "./domStyle.ts";
import type { Portraits } from "./portraits.ts";
import type { UnitDetail } from "./selectionModel.ts";
import { MAX_READOUTS, type Readout } from "./unitReadouts.ts";

/** One readout line: label left, value right. */
class ReadoutRow {
  readonly el = document.createElement("div");
  private readonly label = document.createElement("span");
  private readonly value = document.createElement("b");

  constructor() {
    this.el.className = "readout";
    this.el.append(this.label, this.value);
  }

  show(r: Readout | undefined): void {
    setHidden(this.el, !r);
    setText(this.label, r?.label ?? "");
    setText(this.value, r?.value ?? "");
  }
}

/** One selected unit: large headshot, name, health, mode, what it is doing, and key stats. */
export class SingleView {
  private readonly root = byId("unit-single");
  private readonly portrait = byId<HTMLImageElement>("single-portrait");
  private readonly name = byId("single-name");
  private readonly hpFill = byId("single-hp-fill");
  private readonly hp = byId("single-hp");
  private readonly mode = byId("single-mode");
  private readonly activity = byId("single-activity");
  private readonly rows = Array.from({ length: MAX_READOUTS }, () => new ReadoutRow());

  constructor(private readonly portraits: Portraits) {
    byId("single-readouts").append(...this.rows.map((r) => r.el));
  }

  update(d: UnitDetail | null): void {
    setHidden(this.root, !d);
    if (!d) return;
    setSrc(this.portrait, this.portraits.url(d.kind));
    setText(this.name, d.kind);
    setWidthPct(this.hpFill, d.hpPct);
    setClass(this.hpFill, `hp-fill ${d.tone}`);
    setText(this.hp, `${d.hp} / ${d.maxHp}`);
    setText(this.mode, d.mode);
    setClass(this.mode, `unit-mode ${d.mode}`);
    setText(this.activity, d.activity);
    setHidden(this.activity, d.activity === "");
    this.rows.forEach((row, i) => row.show(d.readouts[i]));
  }
}
