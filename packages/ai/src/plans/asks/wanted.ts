import type { UnitKind } from "@mf/sim";
import type { Point } from "../../geometry.ts";
import type { Request } from "../types.ts";

/** The score of the request that keeps the rest. Below any wanted request. */
const REST_SCORE = -1;

/**
 * Two requests for one kind in one role: `wanted` units at `score`, then every other unit of the kind at a low
 * score, so the plan still holds them all. Only the first can be unfilled; its missing part is the build demand.
 * `score` is in credits, for the missing units only.
 */
export function wantedAndRest(kind: UnitKind, wanted: number, score: number, near: Point): Request[] {
  return [
    { role: kind, kind, count: Math.max(0, wanted), score: Math.max(0, score), near },
    { role: kind, kind, count: Infinity, score: REST_SCORE, near },
  ];
}
