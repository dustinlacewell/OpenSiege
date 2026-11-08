import type { Unit } from "@mf/sim";
import { sumPower, unitPower } from "../assess/power.ts";
import type { EnemyGroup } from "../assess/groups.ts";
import type { Ghost } from "../memory/memory.ts";
import { GUN_SHARE } from "../plan/squads.ts";
import { chance } from "../worth/chance.ts";
import { ghostWorth } from "../worth/enemy.ts";
import { lossWorth, unitWorth } from "../worth/unit.ts";
import type { CommandContext } from "./context.ts";
import type { Goal } from "./goal.ts";

/** One per known enemy group. Gain: the group's worth, its factories with the enemy life premium. Risk: the army. */
export function attackGoals(c: CommandContext): Goal[] {
  const { tank, artillery } = c.board.pic.mine;
  const army = armyPower(tank, artillery);
  const risk = [...tank, ...artillery].reduce((s, u) => s + unitWorth(u.kind, u.hp), 0);
  return c.board.groups.map((g) => {
    const p = chance(army, g.power);
    return {
      id: `attack:${groupId(g)}`,
      kind: "attack",
      at: g.at,
      score: gain(g, c.enemy.lifePremium) * p - risk * (1 - p),
      need: { power: Math.max(0, c.edge * g.power - army) },
    };
  });
}

/** Tanks, plus the guns that back them, as a launch counts them (`plan/army.ts`). */
function armyPower(tanks: readonly Readonly<Unit>[], guns: readonly Readonly<Unit>[]): number {
  let deployed = 0;
  for (const u of guns) deployed += unitPower(u.kind, "sieged", u.hp);
  return sumPower(tanks) + GUN_SHARE * deployed;
}

function gain(g: EnemyGroup, lifePremium: number): number {
  return g.members.reduce((s, m) => s + memberWorth(m, lifePremium), 0);
}

function memberWorth(m: Ghost, lifePremium: number): number {
  return m.kind ? lossWorth(m.kind, m.hp, lifePremium) : ghostWorth(m);
}

/** The lowest member id: stays the same while the group holds that member. */
function groupId(g: EnemyGroup): number {
  return Math.min(...g.members.map((m) => m.id));
}
