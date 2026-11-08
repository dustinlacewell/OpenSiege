import { heightAt, type Terrain } from "@mf/sim";
import { centreOf, type StudyGrid } from "./grid.ts";

/** The sim's nav grid of one move class: `cols * rows` cells of `cell` world units, 0 open, else blocked. */
export interface NavLayer {
  cols: number;
  rows: number;
  cell: number;
  grid: Uint8Array;
}

/** 1 where more than half the nav cells whose centres fall in the study cell are open. */
export function passableLayer(g: StudyGrid, nav: NavLayer): Uint8Array {
  const open = new Uint32Array(g.cols * g.rows), all = new Uint32Array(g.cols * g.rows);
  for (let nj = 0; nj < nav.rows; nj++) {
    const j = Math.min(g.rows - 1, Math.floor(((nj + 0.5) * nav.cell) / g.cell));
    for (let ni = 0; ni < nav.cols; ni++) {
      const i = Math.min(g.cols - 1, Math.floor(((ni + 0.5) * nav.cell) / g.cell));
      const c = j * g.cols + i;
      all[c]!++;
      if (nav.grid[nj * nav.cols + ni] === 0) open[c]!++;
    }
  }
  return Uint8Array.from(all, (n, c) => (open[c]! * 2 > n ? 1 : 0));
}

/**
 * Per cell, the 8-neighbour step count to the nearest blocked cell or off the map edge. Blocked cells are 0;
 * an open cell on the map edge is at most 1.
 */
export function widthLayer(g: StudyGrid, passable: Uint8Array): Uint16Array {
  const n = g.cols * g.rows;
  const width = new Uint16Array(n);
  const queue: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!passable[c]) { queue.push(c); continue; }
    const i = c % g.cols, j = Math.floor(c / g.cols);
    width[c] = Math.min(i + 1, j + 1, g.cols - i, g.rows - j);
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!, i = c % g.cols, j = Math.floor(c / g.cols), d = width[c]! + 1;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if ((di === 0 && dj === 0) || ni < 0 || nj < 0 || ni >= g.cols || nj >= g.rows) continue;
        const m = nj * g.cols + ni;
        if (!passable[m] || width[m]! <= d) continue;
        width[m] = d;
        queue.push(m);
      }
    }
  }
  return width;
}

/** Ground height at each cell centre. */
export function heightLayer(g: StudyGrid, terrain: Terrain): Float32Array {
  const out = new Float32Array(g.cols * g.rows);
  for (let c = 0; c < out.length; c++) {
    const p = centreOf(g, c);
    out[c] = heightAt(terrain, p.x, p.y);
  }
  return out;
}
