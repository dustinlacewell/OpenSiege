import { dangerAt } from "../danger/query.ts";
import { chance } from "../worth/chance.ts";
import { factoryWorth } from "../worth/unit.ts";
import { friendlyPower, type CommandContext } from "./context.ts";
import type { Goal } from "./goal.ts";

/** Own and allied power this close to a factory guards it. */
export const GUARD_REACH = 1500;

/** One per own factory. Its danger is never below the insurance, so a reserve is bought before the first attack. */
export function protectGoals(c: CommandContext): Goal[] {
  return c.board.pic.mine.factory.map((f) => {
    const danger = Math.max(dangerAt(c.board.danger, f.x, f.y), c.insurance);
    const near = friendlyPower(c.board, f, GUARD_REACH);
    return {
      id: `protect:${f.id}`,
      kind: "protect",
      at: { x: f.x, y: f.y },
      score: factoryWorth(c.own.lifePremium, f.hp) * (1 - chance(near, danger)),
      need: { power: Math.max(0, c.edge * danger - near) },
    };
  });
}
