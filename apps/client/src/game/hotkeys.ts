import { gridSlotOf } from "./buildGrid.ts";
import { GROUP_COUNT } from "./controlGroups.ts";

/** What a group key does: select the group, replace it with the selection, or add the selection to it. */
export type GroupOp = "recall" | "save" | "add";

export type Hotkey =
  | { t: "siege" }
  | { t: "stop" }
  /** Enter guard mode: the next left click picks the unit to guard. */
  | { t: "guard" }
  /** Enter attack-move mode: the next left click picks the ground point. */
  | { t: "attackMove" }
  /** Leave a target mode. */
  | { t: "cancel" }
  /** Continue past a tutorial note. */
  | { t: "continue" }
  /** A build palette slot on the current page (`buildGrid.ts`). */
  | { t: "slot"; index: number }
  | { t: "home" }
  | { t: "selectAll" }
  /** Select idle engineers and factories (`idle.ts`). Shift adds. */
  | { t: "idleBuilders" }
  /** Select idle harvesters (`idle.ts`). Shift adds. */
  | { t: "idleHarvesters" }
  /** Control group 1..9 (`controlGroups.ts`). */
  | { t: "group"; index: number; op: GroupOp };

export interface KeyMods {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const KEYS: Record<string, Hotkey> = {
  KeyF: { t: "siege" },
  KeyH: { t: "stop" },
  KeyG: { t: "guard" },
  KeyR: { t: "attackMove" },
  Escape: { t: "cancel" },
  Enter: { t: "continue" },
  NumpadEnter: { t: "continue" },
  Space: { t: "home" },
  Period: { t: "idleBuilders" },
  Comma: { t: "idleHarvesters" },
};

const CTRL_KEYS: Record<string, Hotkey> = {
  KeyA: { t: "selectAll" },
};

/**
 * Digits first: 1..9 are control groups (Alt saves, Shift adds); Ctrl+digit is left to the browser.
 * Then Ctrl keys, so Ctrl+A never reaches the grid's A. Alt with any other key is nothing.
 */
export function hotkeyFor(code: string, mods: KeyMods): Hotkey | undefined {
  const digit = digitOf(code);
  if (digit > 0) return digitKey(digit, mods);
  if (mods.alt) return undefined;
  if (mods.ctrl) return CTRL_KEYS[code];
  const slot = gridSlotOf(code);
  return KEYS[code] ?? (slot >= 0 ? { t: "slot", index: slot } : undefined);
}

function digitKey(n: number, mods: KeyMods): Hotkey | undefined {
  if (mods.ctrl) return undefined;
  return { t: "group", index: n, op: mods.alt ? "save" : mods.shift ? "add" : "recall" };
}

/** 1..9 for Digit1..Digit9, else 0. */
function digitOf(code: string): number {
  if (!code.startsWith("Digit")) return 0;
  const n = Number(code.slice(5));
  return Number.isInteger(n) && n >= 1 && n <= GROUP_COUNT ? n : 0;
}
