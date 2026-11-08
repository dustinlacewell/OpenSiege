import { setHidden, setText } from "../../ui/dom.ts";
import { setClass } from "../../ui/domStyle.ts";
import type { SectionSpec } from "./schema.ts";

export interface SectionModel {
  hidden: boolean;
  collapsed: boolean;
  /** Cells in the section that differ from the saved file. */
  changed: number;
  invalid: number;
}

/** A section's header row: a toggle with its name, and a count of edits that stays visible when the section is folded. */
export class SectionView {
  readonly tr = document.createElement("tr");
  private readonly toggle = document.createElement("button");
  private readonly badge = document.createElement("span");

  constructor(readonly section: SectionSpec, onToggle: () => void, columns: number) {
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    const label = document.createElement("span");
    label.textContent = section.label;
    this.badge.className = "sec-badge";
    this.toggle.type = "button";
    this.toggle.className = "sec-toggle";
    this.toggle.append(chevron, label, this.badge);
    const head = document.createElement("th");
    head.scope = "row";
    head.append(this.toggle);
    const fill = document.createElement("td");
    fill.colSpan = columns;
    this.tr.append(head, fill);
    this.tr.addEventListener("click", onToggle);
  }

  update(m: SectionModel): void {
    setHidden(this.tr, m.hidden);
    setClass(this.tr, ["section", m.collapsed && "collapsed", m.invalid > 0 && "has-invalid"].filter(Boolean).join(" "));
    this.toggle.setAttribute("aria-expanded", String(!m.collapsed));
    setText(this.badge, m.changed > 0 ? `${m.changed} changed` : "");
  }
}
