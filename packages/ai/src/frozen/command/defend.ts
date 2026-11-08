import { UNIT_STATS, type Unit } from "@mf/sim";
import { unitPower } from "../assess/power.ts";
import { dangerAt } from "../danger/query.ts";
import { within, type Point } from "../geometry.ts";
import { chance } from "../worth/chance.ts";
import { lossWorth } from "../worth/unit.ts";
import { cluster, meanOf } from "./cluster.ts";
import { friendlyPower, type CommandContext } from "./context.ts";
import type { Goal } from "./goal.ts";
import { GUARD_REACH } from "./protect.ts";

/** Hurt and loss events this close together are one place to defend. */
const LINK = 800;
/** Defenders bring this times the danger at the place. */
const EDGE = 1.3;
const TANK_POWER = unitPower("tank", "mobile");

/**
 * One per cluster of recent hurt and loss events. Gain: the own worth near the place. The defenders bring `EDGE`
 * times the danger there; the score uses the chance at that power and risks the worth of the tanks it asks for.
 */
export function defendGoals(c: CommandContext): Goal[] {
  const { hurts, losses } = c.board.recent;
  return cluster([...hurts, ...losses], LINK).map((events) => {
    const at = meanOf(events);
    const danger = dangerAt(c.board.danger, at.x, at.y);
    const near = friendlyPower(c.board, at, GUARD_REACH);
    const need = Math.max(0, EDGE * danger - near);
    const p = chance(near + need, danger);
    const risk = (need / TANK_POWER) * UNIT_STATS.tank.cost;
    return {
      id: `defend:${Math.min(...events.map((e) => e.id))}`,
      kind: "defend",
      at,
      score: worthNear(c.board.pic.own, at, c.own.lifePremium) * p - risk * (1 - p),
      need: { power: need },
    };
  });
}

function worthNear(own: readonly Readonly<Unit>[], at: Point, lifePremium: number): number {
  let s = 0;
  for (const u of own) if (within(u, at, GUARD_REACH)) s += lossWorth(u.kind, u.hp, lifePremium);
  return s;
}
