import { byId, setHidden } from "./dom.ts";

export interface PauseHandlers {
  onResume(): void;
  onSettings(): void;
  onLeave(): void;
}

/** The pause menu over the running match. It only covers the screen; the sim keeps running. */
export class PauseOverlay {
  private readonly overlay = byId("pause");

  constructor(h: PauseHandlers) {
    byId("pause-resume").addEventListener("click", h.onResume);
    byId("pause-settings").addEventListener("click", h.onSettings);
    byId("pause-leave").addEventListener("click", h.onLeave);
  }

  isOpen(): boolean {
    return !this.overlay.hidden;
  }

  show(): void {
    setHidden(this.overlay, false);
  }

  hide(): void {
    setHidden(this.overlay, true);
  }
}
