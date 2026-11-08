// The skirmish's choose-your-start phase as the client's `Placement`: the bots' spots are marked, the player clicks one of its own.
import type { Spot } from "@mf/ai";
import { createWorld, type MapSpec } from "@mf/sim";
import type { Placement, PlacementRow } from "../placement.ts";
import type { SkirmishPlan } from "./plan.ts";
import { clampSpot } from "./spots.ts";
import { skirmishSeats } from "./world.ts";

export interface SkirmishPlacementArgs {
  spec: MapSpec;
  plan: SkirmishPlan;
  seed: number;
  /** The player clicked the ground: the spot, forced into the map. */
  onPick(spot: Spot): void;
  /** The panel's Leave button. */
  onLeave(): void;
}

export function skirmishPlacement(a: SkirmishPlacementArgs): Placement {
  const { marks } = skirmishSeats(a.spec, a.plan, a.seed);
  const view = { title: "Pick your start", countdown: "", rows: rowsOf(a.plan), marks };
  return {
    world: createWorld(a.spec),
    you: a.plan.seats.findIndex((s) => s.kind === "human") + 1,
    view: () => view,
    onPick: (x, y) => a.onPick(clampSpot(a.spec, x, y)),
    leave: a.onLeave,
  };
}

/** Everyone in the panel, allies together, lowest team first. Only the bots have picked. */
function rowsOf(plan: SkirmishPlan): PlacementRow[] {
  return plan.seats
    .map((seat, i) => ({ i, row: { name: seat.kind === "human" ? plan.name : seat.name, team: seat.team, picked: seat.kind === "bot", me: seat.kind === "human" } }))
    .sort((a, b) => a.row.team - b.row.team || a.i - b.i)
    .map((e) => e.row);
}
