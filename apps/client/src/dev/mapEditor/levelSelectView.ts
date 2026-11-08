import type { MapEntry } from "@mf/map";
import { button, el } from "../build.ts";

export interface LevelSelectHandlers {
  onOpen(file: string): void;
  onNew(): void;
  /** Back to the open map. */
  onClose(): void;
}

/** The page's start screen: a grid of map cards, and New. It covers the editor while shown. */
export class LevelSelectView {
  private readonly root = el("div", "levels");
  private readonly grid = el("div", "grid");
  private readonly status = el("ul", "errors");
  private readonly back: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly h: LevelSelectHandlers) {
    const head = el("div", "head");
    this.back = button("Back", "", h.onClose, "Back to the open map");
    head.append(el("h2", "", "Maps"), el("span", "spacer"), this.back, button("New", "primary", h.onNew, "A flat map of a size you choose"));
    this.root.append(head, this.status, this.grid);
    parent.append(this.root);
  }

  /** `canClose`: a map is open behind the list. */
  show(entries: readonly MapEntry[], canClose: boolean, errors: readonly string[] = []): void {
    this.back.hidden = !canClose;
    this.showErrors(errors);
    this.grid.replaceChildren(...(entries.length > 0 ? entries.map((e) => this.card(e)) : [el("p", "empty", "No maps yet. Press New.")]));
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** A load failed: the grid stays, with the reason. */
  showErrors(errors: readonly string[]): void {
    this.status.replaceChildren(...errors.map((e) => el("li", "", e)));
  }

  private card(e: MapEntry): HTMLButtonElement {
    const b = button("", "card", () => this.h.onOpen(e.file), e.file);
    const frame = el("div", "picture");
    if (e.preview) {
      const img = el("img");
      img.src = e.preview;
      img.alt = "";
      frame.append(img);
    } else {
      frame.append(el("span", "none", "No preview yet"));
    }
    b.append(frame, el("span", "name", e.name), el("span", "size", `${e.width} x ${e.height}`));
    return b;
  }
}
