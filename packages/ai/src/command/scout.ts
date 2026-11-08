import { SCOUT_CELL, type Explored } from "../memory/explored.ts";
import type { CommandContext } from "./context.ts";
import type { Goal } from "./goal.ts";

/** A scout cell unseen this long, or never, is old. */
const OLD = 3000;
/** A small fixed score: looking is cheap and its gain is unknown. */
const SCORE = 100;

/** One goal at the oldest scout cell, when the knobs allow a scout and some cell is old. */
export function scoutGoals(c: CommandContext, explored: Explored): Goal[] {
  if (!c.knobs.scout) return [];
  const tick = c.board.pic.tick;
  let oldest = -1;
  explored.seen.forEach((seen, n) => {
    if (tick - seen >= OLD && (oldest < 0 || seen < explored.seen[oldest]!)) oldest = n;
  });
  if (oldest < 0) return [];
  const at = { x: ((oldest % explored.cols) + 0.5) * SCOUT_CELL, y: (Math.floor(oldest / explored.cols) + 0.5) * SCOUT_CELL };
  return [{ id: "scout", kind: "scout", at, score: SCORE, need: { kind: "tank", count: 1 } }];
}
