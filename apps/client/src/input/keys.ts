import { hotkeyFor } from "../game/hotkeys.ts";
import type { Actions } from "./actions.ts";

const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;

/** Keyboard: hotkeys on press, arrow keys held for panning. Ignored while typing in a field. */
export class Keys {
  private readonly held = new Set<string>();

  constructor(private readonly actions: Actions) {
    window.addEventListener("keydown", (e) => this.down(e));
    window.addEventListener("keyup", (e) => this.up(e));
    window.addEventListener("blur", () => this.held.clear());
  }

  private up(e: KeyboardEvent): void {
    this.held.delete(e.code);
    suppressMenuBar(e);
  }

  isHeld(code: (typeof ARROWS)[number]): boolean {
    return this.held.has(code);
  }

  private down(e: KeyboardEvent): void {
    if (isTyping(e.target)) return;
    suppressMenuBar(e);
    if ((ARROWS as readonly string[]).includes(e.code)) {
      this.held.add(e.code);
      e.preventDefault();
      return;
    }
    if (e.metaKey) return;
    const key = hotkeyFor(e.code, { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey });
    if (!key) return;
    e.preventDefault();
    if (!e.repeat) this.actions.hotkey(key, e.shiftKey, e.timeStamp);
  }
}

/** Alt is the force-move modifier; alone it would focus the browser menu bar. */
function suppressMenuBar(e: KeyboardEvent): void {
  if (e.key === "Alt" && !isTyping(e.target)) e.preventDefault();
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
