import { byId, setHidden, setText } from "./dom.ts";
import { setClass } from "./domStyle.ts";
import type { EndResult } from "./endModel.ts";

/** The end card over the frozen match: a title, a line under it, and a button out. */
export class EndOverlay {
  private readonly overlay = byId("end");
  private readonly title = byId("end-title");
  private readonly winner = byId("end-winner");
  private readonly back = byId("end-back");

  constructor(onBack: () => void) {
    this.back.addEventListener("click", onBack);
  }

  show(r: EndResult): void {
    setText(this.title, r.title);
    setClass(this.title, r.tone);
    setText(this.winner, r.line);
    setText(this.back, r.button);
    setHidden(this.overlay, false);
  }

  hide(): void {
    setHidden(this.overlay, true);
  }
}
