import { byId, setHidden } from "./dom.ts";

/** Small "eliminated, spectating" banner. It does not block the view. */
export class EliminatedBanner {
  private readonly el = byId("dead-banner");

  update(dead: boolean): void {
    setHidden(this.el, !dead);
  }
}
