import { eachNeighbour, nearestPassable, type StudyGrid } from "./grid.ts";
import { MinHeap } from "./heap.ts";
import type { Terminal } from "./terminals.ts";

/**
 * Weighted betweenness (Brandes) on the passable 8-neighbour grid, normalised to 0..1. Each ordered pair of
 * terminals sends traffic of the product of their weights, split evenly over all shortest paths between them.
 * A cell's flow is the traffic through it, its own ends excluded. Terminals snap to the nearest passable cell;
 * terminals on one cell add up.
 */
export function flowLayer(g: StudyGrid, passable: Uint8Array, terminals: readonly Terminal[]): Float32Array {
  const weight = terminalWeights(g, passable, terminals);
  const flow = new Float64Array(g.cols * g.rows);
  for (const [s, ws] of weight) accumulateFrom(g, passable, s, ws, weight, flow);
  return normalised(flow);
}

function terminalWeights(g: StudyGrid, passable: Uint8Array, terminals: readonly Terminal[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of terminals) {
    const c = nearestPassable(g, passable, t);
    if (c !== undefined) out.set(c, (out.get(c) ?? 0) + t.weight);
  }
  return out;
}

/** One Brandes pass: Dijkstra from s counting shortest paths, then dependencies back up in reverse order. */
function accumulateFrom(g: StudyGrid, passable: Uint8Array, s: number, ws: number, weight: ReadonlyMap<number, number>, flow: Float64Array): void {
  const n = g.cols * g.rows;
  const dist = new Int32Array(n).fill(-1);
  const sigma = new Float64Array(n);
  const order = settle(g, passable, s, dist, sigma);
  const delta = new Float64Array(n);
  for (let k = order.length - 1; k >= 0; k--) {
    const w = order[k]!;
    const end = w === s ? 0 : ws * (weight.get(w) ?? 0);
    const share = (end + delta[w]!) / sigma[w]!;
    eachNeighbour(g, passable, w, (v, cost) => {
      if (dist[v] !== -1 && dist[v]! + cost === dist[w]) delta[v]! += sigma[v]! * share;
    });
    if (w !== s) flow[w]! += delta[w]!;
  }
}

/** Dijkstra from s. Fills `dist` and the shortest-path counts `sigma`; returns cells in settle order. */
function settle(g: StudyGrid, passable: Uint8Array, s: number, dist: Int32Array, sigma: Float64Array): number[] {
  const done = new Uint8Array(dist.length);
  const order: number[] = [];
  const heap = new MinHeap();
  dist[s] = 0;
  sigma[s] = 1;
  heap.push(0, s);
  while (heap.size > 0) {
    const { key, cell } = heap.pop();
    if (done[cell] || key !== dist[cell]) continue;
    done[cell] = 1;
    order.push(cell);
    eachNeighbour(g, passable, cell, (m, cost) => {
      const d = key + cost;
      if (dist[m] === -1 || d < dist[m]!) {
        dist[m] = d;
        sigma[m] = sigma[cell]!;
        heap.push(d, m);
      } else if (d === dist[m]) sigma[m]! += sigma[cell]!;
    });
  }
  return order;
}

function normalised(flow: Float64Array): Float32Array {
  let top = 0;
  for (const f of flow) if (f > top) top = f;
  return Float32Array.from(flow, (f) => (top > 0 ? f / top : 0));
}
