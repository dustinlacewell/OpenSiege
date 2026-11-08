import type { Terrain } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import type { Placement } from "../game/placement.ts";
import { byId, setHidden } from "./dom.ts";
import { endResult, TUTORIAL_END } from "./endModel.ts";
import { EndOverlay } from "./endOverlay.ts";
import { PickView } from "./pickView.ts";
import { layoutOf, type Screen } from "./screenLayout.ts";

/** What the screens call back into. `start.ts` binds them to the host. */
export interface ScreenHandlers {
  /** The local player's name. */
  me(): string;
  /** The end card's button label for a match. */
  endLabel: string;
  /** The end card's button. */
  onBack(): void;
  /** The screen changed. `null`: none, the backdrop shows. */
  onScreen(screen: Screen | null): void;
}

/** The one screen state. It picks the pick panel or the end card and hides the game HUD outside a match. */
export class Screens {
  private readonly pickView = new PickView();
  private readonly end: EndOverlay;
  private readonly hud = byId("game-hud");
  private current: Screen | null = null;

  constructor(private readonly h: ScreenHandlers) {
    this.end = new EndOverlay(h.onBack);
  }

  /** The choose-your-start phase. */
  picking(placement: Placement): void {
    this.show("pick");
    this.pickView.show(placement);
  }

  /** Per frame while picking: the panel and the spot markers. */
  drawPick(now: number, cam: Camera, terrain: Terrain | null): void {
    if (this.current === "pick") this.pickView.update(now, cam, terrain);
  }

  match(): void {
    this.show("match");
  }

  /** A match is running: not the pick phase or the end card. */
  inMatch(): boolean {
    return this.current === "match";
  }

  /** The match is over. `winners` are the names of the winning team; empty when nobody won. */
  ended(winners: string[]): void {
    this.show("ended");
    this.end.show(endResult(winners, this.h.me(), this.h.endLabel));
  }

  /** The tutorial is over: thanks, and the way to a real match. */
  tutorialEnded(): void {
    this.show("ended");
    this.end.show(TUTORIAL_END);
  }

  /** No match, no pick phase, no end card. */
  idle(): void {
    this.show(null);
  }

  /** Applies the layout. A part is touched only when the screen changes. */
  private show(screen: Screen | null): void {
    if (screen === this.current) return;
    this.current = screen;
    const l = layoutOf(screen);
    if (!l.pick) this.pickView.hide();
    if (!l.end) this.end.hide();
    setHidden(this.hud, !l.hud);
    this.h.onScreen(screen);
  }
}
