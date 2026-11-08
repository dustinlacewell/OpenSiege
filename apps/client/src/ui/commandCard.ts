import type { TargetKind } from "../game/session.ts";
import type { Actions } from "../input/actions.ts";
import { BuildPalette } from "./buildPalette.ts";
import { byId, setHidden, setText } from "./dom.ts";
import { setClass } from "./domStyle.ts";
import type { CommandName, ControlFlags } from "./guideModel.ts";
import type { HudModel } from "./model.ts";
import type { Portraits } from "./portraits.ts";

/** The hint line of each target mode. */
const TARGET_HINT: Record<TargetKind, string> = {
  guard: "Guard: click a unit",
  attackMove: "Attack: click ground",
};

/**
 * Right console box: the build palette, the 2 by 2 action buttons (Siege, Stop, Guard, Attack),
 * the slot tooltip and the target-mode hint. Hidden with no selection.
 */
export class CommandCard {
  private readonly root = byId("command-card");
  private readonly siege = byId<HTMLButtonElement>("cmd-siege");
  private readonly siegeLabel = byId("cmd-siege-label");
  private readonly stop = byId<HTMLButtonElement>("cmd-stop");
  private readonly guard = byId<HTMLButtonElement>("cmd-guard");
  private readonly attack = byId<HTMLButtonElement>("cmd-attack");
  private readonly hint = byId("tip-target");
  private readonly hintText = byId("tip-target-text");
  private readonly palette: BuildPalette;

  private flags: HudModel["commands"] | null = null;

  constructor(actions: Actions, portraits: Portraits) {
    this.palette = new BuildPalette(actions, portraits);
    this.siege.addEventListener("click", (e) => this.unlocked("siege") && actions.siege(e.shiftKey));
    this.stop.addEventListener("click", () => this.unlocked("stop") && actions.stop());
    this.guard.addEventListener("click", () => this.unlocked("guard") && actions.enterTarget("guard"));
    this.attack.addEventListener("click", () => this.unlocked("attack") && actions.enterTarget("attackMove"));
  }

  update(m: HudModel): void {
    this.flags = m.commands;
    setHidden(this.root, !m.hasSelection);
    setText(this.siegeLabel, m.siegeDeploys ? "Siege" : "Unsiege");
    setClass(this.siege, buttonClass(false, m.commands.siege));
    setClass(this.stop, buttonClass(false, m.commands.stop));
    setClass(this.guard, buttonClass(m.targetMode === "guard", m.commands.guard));
    setClass(this.attack, buttonClass(m.targetMode === "attackMove", m.commands.attack));
    setHidden(this.hint, m.targetMode === null);
    if (m.targetMode) setText(this.hintText, TARGET_HINT[m.targetMode]);
    this.palette.update(m);
  }

  private unlocked(name: CommandName): boolean {
    return !this.flags?.[name].locked;
  }
}

function buttonClass(on: boolean, f: ControlFlags): string {
  return ["cmd-btn", on && "on", f.locked && "locked", f.focus && "focus"].filter(Boolean).join(" ");
}
