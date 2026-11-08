import type { Unit } from "@mf/sim";
import { unitPower } from "../assess/power.ts";
import type { Board } from "../board/board.ts";
import type { Point } from "../geometry.ts";
import type { Knobs } from "../knobs.ts";
import { enemyPowerEstimate, enemyWorth } from "../worth/enemy.ts";
import { ownWorth, type SideWorth } from "../worth/own.ts";

/** What every goal scorer reads: the board, both sides' worth, and the insurance danger. Built once per run. */
export interface CommandContext {
  board: Board;
  knobs: Knobs;
  own: SideWorth;
  enemy: SideWorth;
  /** Danger each factory is protected against at least: `knobs.insurance` of the guessed enemy army. */
  insurance: number;
  /** The middle of `knobs.attackRatio`: the power edge a goal asks for. */
  edge: number;
}

export function commandContext(board: Board, knobs: Knobs): CommandContext {
  const enemy = enemyWorth(board.known, board.pic.tick, knobs.enemyIncome);
  return {
    board,
    knobs,
    own: ownWorth(board.pic),
    enemy,
    insurance: knobs.insurance * enemyPowerEstimate(enemy.worth),
    edge: (knobs.attackRatio[0] + knobs.attackRatio[1]) / 2,
  };
}

/** Power of own and allied units within `r` of the point. */
export function friendlyPower(board: Board, p: Point, r: number): number {
  let s = 0;
  const near = (u: Pick<Unit, "x" | "y">): boolean => (u.x - p.x) ** 2 + (u.y - p.y) ** 2 <= r * r;
  for (const u of board.pic.own) if (near(u)) s += unitPower(u.kind, u.mode, u.hp);
  for (const a of board.allies) if (near(a)) s += unitPower(a.kind, a.mode, a.hp);
  return s;
}
