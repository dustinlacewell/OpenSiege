import type { Point } from "../geometry.ts";
import { centreOf, DIAG, eachNeighbour, nearestPassable, ORTHO } from "./grid.ts";
import { MinHeap } from "./heap.ts";
import type { MapStudy } from "./study.ts";

/** The cell centres of the shortest passable path from a to b, both ends included. [] when no path joins them. */
export function studyPath(study: MapStudy, a: Point, b: Point): Point[] {
  return studyCells(study, a, b).map((c) => centreOf(study, c));
}

/**
 * The cells of the shortest passable 8-neighbour path from a to b (A*, octile heuristic). Each end snaps to its
 * nearest passable cell. [] when no path joins them.
 */
export function studyCells(study: MapStudy, a: Point, b: Point): number[] {
  const start = nearestPassable(study, study.passable, a), goal = nearestPassable(study, study.passable, b);
  if (start === undefined || goal === undefined) return [];
  const came = search(study, start, goal);
  return came ? walkBack(came, start, goal) : [];
}

function search(study: MapStudy, start: number, goal: number): Int32Array | undefined {
  const n = study.cols * study.rows;
  const cost = new Int32Array(n).fill(-1), came = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const gi = goal % study.cols, gj = Math.floor(goal / study.cols);
  const guess = (c: number): number => {
    const di = Math.abs((c % study.cols) - gi), dj = Math.abs(Math.floor(c / study.cols) - gj);
    return ORTHO * Math.max(di, dj) + (DIAG - ORTHO) * Math.min(di, dj);
  };
  const heap = new MinHeap();
  cost[start] = 0;
  heap.push(guess(start), start);
  while (heap.size > 0) {
    const { cell } = heap.pop();
    if (done[cell]) continue;
    if (cell === goal) return came;
    done[cell] = 1;
    eachNeighbour(study, study.passable, cell, (m, step) => {
      const d = cost[cell]! + step;
      if (cost[m] !== -1 && d >= cost[m]!) return;
      cost[m] = d;
      came[m] = cell;
      heap.push(d + guess(m), m);
    });
  }
  return undefined;
}

function walkBack(came: Int32Array, start: number, goal: number): number[] {
  const out = [goal];
  for (let c = goal; c !== start; ) out.push((c = came[c]!));
  return out.reverse();
}
