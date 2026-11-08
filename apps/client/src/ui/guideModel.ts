// Pure: what the guide locks and points at in the HUD. Flags only; no tutorial logic.
import type { Intent, World } from "@mf/sim";
import type { GridSlot } from "../game/buildGrid.ts";
import * as commands from "../game/commands.ts";
import type { Guide } from "../game/tutorial/guide.ts";
import type { ControlId, GuideView } from "../game/tutorial/types.ts";

/** The guide questions the HUD asks. */
export type HudGuide = Pick<Guide, "admit" | "mayIssue">;

/**
 * A palette slot as shown: the grid slot, plus `locked` (the guide forbids building it), `quotaLocked`
 * (the guide forbids its Ctrl+click quota) and `focus` (the guide points at it).
 */
export interface PaletteSlot extends GridSlot { locked: boolean; quotaLocked: boolean; focus: boolean }

export type CommandName = Extract<ControlId, { t: "cmd" }>["name"];

export interface ControlFlags { locked: boolean; focus: boolean }

/** The prompt line. `index` is 0-based, as in `GuideView`. `note`: show Continue. */
export interface GuideLine { prompt: string; index: number; count: number; note: boolean }

/** What the guide part of the model reads. */
export interface GuideInput { world: World; me: number; selected: readonly number[]; guide: HudGuide; view: GuideView | null }

/**
 * A slot is locked during a note, or when a factory is selected and the build intents one click sends are not all admitted.
 * Its quota is locked during a note, or when the guide may not issue quota.
 */
export function paletteSlots(slots: readonly GridSlot[], hasFactory: boolean, g: GuideInput): PaletteSlot[] {
  const note = noting(g);
  const quotaLocked = note || !g.guide.mayIssue("quota");
  return slots.map((s) => ({
    ...s,
    locked: s.kind !== null && (note || (hasFactory && !admitsAll(g, commands.build(g.world, g.me, g.selected, s.kind)))),
    quotaLocked: s.kind !== null && quotaLocked,
    focus: s.kind !== null && focused(g.view, (c) => c.t === "slot" && c.kind === s.kind),
  }));
}

/** Everything is locked during a note. Otherwise no intent means not locked: the button does nothing then anyway. */
export function commandFlags(g: GuideInput): Record<CommandName, ControlFlags> {
  const note = noting(g);
  const siege = commands.siegeToggle(g.world, g.selected, false);
  const stop = commands.stop(g.selected);
  const flags = (name: CommandName, locked: boolean): ControlFlags => ({
    locked: note || locked,
    focus: focused(g.view, (c) => c.t === "cmd" && c.name === name),
  });
  return {
    siege: flags("siege", siege !== null && g.guide.admit(siege) === null),
    stop: flags("stop", stop !== null && g.guide.admit(stop) === null),
    guard: flags("guard", !g.guide.mayIssue("guard")),
    attack: flags("attack", !g.guide.mayIssue("move")),
  };
}

/** The queue's cancel (right-click a job tile) is locked during a note, or when the guide may not issue cancel. */
export function queueLocked(g: GuideInput): boolean {
  return noting(g) || !g.guide.mayIssue("cancel");
}

export function guideLine(view: GuideView | null): GuideLine | null {
  return view ? { prompt: view.prompt, index: view.index, count: view.count, note: view.note } : null;
}

function noting(g: GuideInput): boolean {
  return g.view?.note ?? false;
}

function admitsAll(g: GuideInput, intents: readonly Intent[]): boolean {
  return intents.every((i) => g.guide.admit(i) !== null);
}

function focused(view: GuideView | null, match: (c: ControlId) => boolean): boolean {
  return view?.controls.some(match) ?? false;
}
