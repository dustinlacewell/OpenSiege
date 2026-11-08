import type { MapSize, UnitKind } from "@mf/sim";
import { centroid, spread, within, type Point } from "../geometry.ts";
import type { Ghost } from "../memory/memory.ts";
import { ghostPower } from "./power.ts";

/** Ghosts closer than this to one another belong to one group. */
const LINK = 800;

/** How much the bot wants a kind dead. Unknown contacts count as a little. */
const VALUE: Record<UnitKind, number> = { factory: 6, harvester: 3, radar: 2, jammer: 2, artillery: 1.5, engineer: 1, tank: 1, mine: 0.8 };
const UNKNOWN_VALUE = 1;

/** Enemies that stand together, with their summed power and worth as a target. */
export interface EnemyGroup {
  at: Point;
  radius: number;
  power: number;
  value: number;
  members: readonly Ghost[];
  hasFactory: boolean;
}

/** Single-link clusters of the known ghosts. */
export function groupGhosts(ghosts: readonly Ghost[], map: MapSize): EnemyGroup[] {
  const left = ghosts.slice();
  const out: EnemyGroup[] = [];
  while (left.length > 0) {
    const members = [left.pop()!];
    for (let n = 0; n < members.length; n++) {
      const m = members[n]!;
      for (let i = left.length - 1; i >= 0; i--) {
        if (within(left[i]!, m, LINK)) members.push(left.splice(i, 1)[0]!);
      }
    }
    out.push(describe(members, map));
  }
  return out;
}

function describe(members: Ghost[], map: MapSize): EnemyGroup {
  const at = centroid(members, map);
  return {
    at,
    radius: spread(members, at),
    power: members.reduce((s, g) => s + ghostPower(g), 0),
    value: members.reduce((s, g) => s + (g.kind ? VALUE[g.kind] : UNKNOWN_VALUE), 0),
    members,
    hasFactory: members.some((g) => g.kind === "factory"),
  };
}
