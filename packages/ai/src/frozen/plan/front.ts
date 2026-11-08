import { dist, type Point } from "../geometry.ts";
import type { Squad } from "../memory/memory.ts";
import type { Plan } from "./plan.ts";

/** The primary front: where the army fights, or else where the nearest known enemy stands. undefined when nothing is known. */
export function frontOf(p: Plan): Point | undefined {
  const here = p.mem.site ?? p.home.site;
  return mainAttack(p.mem.squads) ?? nearest(here, p.groups.map((g) => g.at));
}

/** The target of the largest squad that attacks a known enemy. */
function mainAttack(squads: readonly Squad[]): Point | undefined {
  const attacking = squads.filter((s) => s.state === "attack" && !s.scouting);
  const largest = attacking.reduce<Squad | undefined>((b, s) => (!b || s.members.length > b.members.length ? s : b), undefined);
  return largest && { x: largest.target.x, y: largest.target.y };
}

function nearest(here: Point, points: readonly Point[]): Point | undefined {
  return points.reduce<Point | undefined>((b, q) => (!b || dist(q, here) < dist(b, here) ? q : b), undefined);
}
