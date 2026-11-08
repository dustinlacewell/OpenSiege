import { setHidden, setText } from "../../ui/dom.ts";
import { setClass } from "../../ui/domStyle.ts";
import { button, el } from "../build.ts";
import { specOf, type Refusal, type Schema } from "./schema.ts";

export type Tone = "info" | "ok" | "error";

export interface StatusModel {
  message: string;
  tone: Tone;
  /** What the dev server refused. Each one that names a cell jumps to it when clicked. */
  errors: readonly Refusal[];
}

/** The line under the toolbar: the result of the last save, and the dev server's refusals as a list. */
export class StatusView {
  private readonly message = el("span", "message");
  private readonly list = el("ul", "errors");
  private shown = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly schema: Schema,
    private readonly columnLabel: (column: string) => string,
    private readonly onJump: (column: string, field: string) => void,
  ) {
    root.append(this.message, this.list);
  }

  update(m: StatusModel): void {
    setHidden(this.root, m.message === "" && m.errors.length === 0);
    setClass(this.root, `status ${m.tone}`);
    setText(this.message, m.message);
    const signature = JSON.stringify(m.errors);
    if (signature === this.shown) return;
    this.shown = signature;
    this.list.replaceChildren(...m.errors.map((e) => this.item(e)));
  }

  private item(e: Refusal): HTMLElement {
    const li = el("li");
    const { column, field } = e;
    const spec = field ? specOf(this.schema, field) : undefined;
    if (!column || !field || !spec) {
      li.textContent = `${column ? this.columnLabel(column) : "File"}: ${e.message}`;
      return li;
    }
    const section = this.schema.sections.find((s) => s.id === spec.section)?.label ?? "";
    li.append(button(`${this.columnLabel(column)} · ${spec.label} (${section})`, "link", () => this.onJump(column, field)), el("span", "", ` ${e.message}`));
    return li;
  }
}
