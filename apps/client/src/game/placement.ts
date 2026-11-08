// The choose-your-start phase, as the client sees it: a world to look at, a panel to show and a click to answer.
import type { World } from "@mf/sim";

/** One player in the panel's list. The team is the colour. */
export interface PlacementRow {
  name: string;
  team: number;
  picked: boolean;
  me: boolean;
}

/** A spot on the map. `id` is the player id. */
export interface PlacementMark {
  id: number;
  x: number;
  y: number;
  name: string;
  team: number;
  me: boolean;
}

/** What the panel and the map show at one moment. */
export interface PlacementView {
  title: string;
  /** "m:ss" while the choice is open. "" when it is not. */
  countdown: string;
  /** Grouped by team, lowest first. */
  rows: readonly PlacementRow[];
  marks: readonly PlacementMark[];
}

/** The host owns the phase's state; the client reads it each frame. */
export interface Placement {
  /** The terrain to look at: no players. */
  world: World;
  /** The local player id. */
  you: number;
  /** The panel and the marks at time `now`. */
  view(now: number): PlacementView;
  /** A click on the ground chose the spot (x, y). */
  onPick(x: number, y: number): void;
  /** The panel's Leave button. */
  leave(): void;
}
