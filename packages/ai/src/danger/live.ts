import type { MapSize } from "@mf/sim";
import { ghostPower } from "../assess/power.ts";
import { reachOf } from "../assess/threat.ts";
import type { Ghost } from "../memory/memory.ts";
import { emptyGrid, stamp, type DangerGrid } from "./grid.ts";

/** Fresh each think: every armed known ghost stamps its power over its reach, the same reach as the threat map. */
export function liveDanger(known: readonly Ghost[], m: MapSize): DangerGrid {
  const grid = emptyGrid(m);
  for (const g of known) stamp(grid, g.x, g.y, ghostPower(g), reachOf(g));
  return grid;
}
