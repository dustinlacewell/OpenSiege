import type { PanInput } from "../../input/pan.ts";

export interface KeyHandlers {
  undo(): void;
  redo(): void;
  /** +1 grows the brush, -1 shrinks it. */
  resize(dir: 1 | -1): void;
  /** Digit 1..4 as channel 0..3. */
  channel(k: 0 | 1 | 2 | 3): void;
}

const PAN_KEYS: Record<string, keyof Pick<PanInput, "left" | "right" | "up" | "down">> = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
};
const DIGITS: Record<string, 0 | 1 | 2 | 3> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };

/**
 * Window keys: held pan keys (arrows and WASD), Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, [ and ], 1 to 4. Ignored while a
 * form control has focus. It also tracks every held key, for key+wheel gestures. A key such a gesture claims stops
 * panning until it is released, so D+wheel does not also slide the camera.
 */
export class EditorKeys {
  private readonly held = new Set<string>();
  private readonly claimed = new Set<string>();

  constructor(private readonly h: KeyHandlers) {
    window.addEventListener("keydown", (e) => this.down(e));
    window.addEventListener("keyup", (e) => this.up(e.code));
    window.addEventListener("blur", () => {
      this.held.clear();
      this.claimed.clear();
    });
  }

  /** Which pan directions are held. */
  pan(): Pick<PanInput, "left" | "right" | "up" | "down"> {
    const out = { left: false, right: false, up: false, down: false };
    for (const code of this.held) {
      const dir = PAN_KEYS[code];
      if (dir && !this.claimed.has(code)) out[dir] = true;
    }
    return out;
  }

  /** True while `code` is held. */
  isHeld(code: string): boolean {
    return this.held.has(code);
  }

  /** A key+wheel gesture took this key: it stops panning until released. */
  claim(code: string): void {
    this.claimed.add(code);
  }

  private up(code: string): void {
    this.held.delete(code);
    this.claimed.delete(code);
  }

  private down(e: KeyboardEvent): void {
    if (isFormControl(e.target)) return;
    if (e.ctrlKey || e.metaKey) return this.command(e);
    this.held.add(e.code);
    if (PAN_KEYS[e.code]) e.preventDefault();
    else if (e.code === "BracketLeft") this.h.resize(-1);
    else if (e.code === "BracketRight") this.h.resize(1);
    else if (DIGITS[e.code] !== undefined && !e.repeat) this.h.channel(DIGITS[e.code]!);
  }

  private command(e: KeyboardEvent): void {
    const redo = e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey);
    if (!redo && e.code !== "KeyZ") return;
    e.preventDefault();
    if (redo) this.h.redo();
    else this.h.undo();
  }
}

function isFormControl(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}
