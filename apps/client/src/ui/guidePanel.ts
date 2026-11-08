import { byId, setHidden, setText } from "./dom.ts";
import type { GuideLine } from "./guideModel.ts";

/** The tutorial prompt under the top bar: the prompt, "Step i of n", and Continue on a note. Hidden with no line. */
export class GuidePanel {
  private readonly root = byId("guide");
  private readonly prompt = byId("guide-prompt");
  private readonly step = byId("guide-step");
  private readonly next = byId<HTMLButtonElement>("guide-continue");

  /** `onContinue` runs on a Continue click. */
  constructor(onContinue: () => void) {
    this.next.addEventListener("click", onContinue);
  }

  update(line: GuideLine | null): void {
    setHidden(this.root, line === null);
    if (!line) return;
    setText(this.prompt, line.prompt);
    setText(this.step, `Step ${line.index + 1} of ${line.count}`);
    setHidden(this.next, !line.note);
  }
}
