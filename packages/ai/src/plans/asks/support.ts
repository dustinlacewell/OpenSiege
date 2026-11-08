import type { Board } from "../../board/board.ts";
import type { Knobs } from "../../knobs.ts";
import type { Memory } from "../../memory/memory.ts";
import { homeOf } from "../../plan/plan.ts";
import { REPLACE_TICKS } from "../../worth/unit.ts";
import type { Request } from "../types.ts";
import { buildSpeed, ENGINEER_BOOST, income } from "./buildSpeed.ts";
import { wantedAndRest } from "./wanted.ts";

/** Engineers at most, per point of `knobs.engineers`. */
const ENGINEERS_PER_KNOB = 3;
/** A new engineer's score: the build work it adds over the same horizon a harvester's lost income uses. */
const ENGINEER_SCORE = ENGINEER_BOOST * REPLACE_TICKS;
/** Army size before the radar truck, and a radar truck's score. */
const RADAR_FROM = 5;
const RADAR_SCORE = 250;

/** Engineers while income is above build speed, one per 2 credits of gap; radar trucks as before. */
export function supportAsks(board: Board, mem: Memory, knobs: Knobs): Request[] {
  const near = homeOf(board.pic, mem).site;
  const { engineer, radar, tank, artillery } = board.pic.mine;
  const gap = Math.ceil(Math.max(0, income(board.pic) - buildSpeed(board.pic)) / ENGINEER_BOOST);
  const engineers = Math.min(knobs.engineers * ENGINEERS_PER_KNOB, engineer.length + gap);
  const radars = tank.length + artillery.length >= RADAR_FROM ? knobs.radars : 0;
  return [
    ...wantedAndRest("engineer", engineers, Math.max(0, engineers - engineer.length) * ENGINEER_SCORE, near),
    ...wantedAndRest("radar", radars, Math.max(0, radars - radar.length) * RADAR_SCORE, near),
  ];
}
