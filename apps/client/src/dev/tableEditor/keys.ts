export interface KeyHandlers {
  save(): void;
  undo(): void;
  redo(): void;
  focusFilter(): void;
  /** Clears the filter text. False when there was none. */
  clearFilter(): boolean;
}

/**
 * Page-wide keys: Ctrl+S, undo and redo on the edit history (not the browser's text undo), `/` for the filter,
 * Esc to clear the filter or leave the box. The filter box keeps its own text undo.
 */
export function installKeys(h: KeyHandlers): void {
  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === "s") return act(e, h.save);
    if (mod && key === "z" && !target.matches("input.filter")) return act(e, e.shiftKey ? h.redo : h.undo);
    if (mod && key === "y" && !target.matches("input.filter")) return act(e, h.redo);
    if (!mod && !e.altKey && e.key === "/" && !target.matches("input[type=text], select")) return act(e, h.focusFilter);
    if (e.key === "Escape") return act(e, () => { if (!h.clearFilter()) (document.activeElement as HTMLElement | null)?.blur(); });
  });
}

function act(e: KeyboardEvent, run: () => void): void {
  e.preventDefault();
  run();
}
