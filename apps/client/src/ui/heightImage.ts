import { heightAt, mapSize, TERRAIN_MAX_HEIGHT, type Terrain, type VertexBox } from "@mf/sim";

const LOW = [64, 100, 42] as const;
const HIGH = [135, 125, 78] as const;

/** A block of pixels, inclusive. */
export interface PixelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A w×h canvas of the terrain, coloured by height and shaded from the north-west. */
export function heightImage(terrain: Terrain, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  paintRect(ctx, terrain, w, h, { x0: 0, y0: 0, x1: w - 1, y1: h - 1 });
  return canvas;
}

/** The heights in this vertex box changed in place: repaints only the pixels that read them. */
export function refreshHeightImage(canvas: HTMLCanvasElement, terrain: Terrain, box: VertexBox): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = heightPixelRect(terrain, canvas.width, canvas.height, box);
  if (rect) paintRect(ctx, terrain, canvas.width, canvas.height, rect);
}

/** The pixels of a w×h image whose colour reads a vertex in `box` (a pixel reads one pixel step either side), or null if none. */
export function heightPixelRect(terrain: Terrain, w: number, h: number, box: VertexBox): PixelRect | null {
  const m = mapSize(terrain);
  const kx = m.width / w, ky = m.height / h;
  const c = terrain.cell;
  const x0 = Math.max(0, Math.floor(((box.i0 - 1) * c) / kx) - 2), x1 = Math.min(w - 1, Math.ceil(((box.i1 + 1) * c) / kx) + 2);
  const y0 = Math.max(0, Math.floor(((box.j0 - 1) * c) / ky) - 2), y1 = Math.min(h - 1, Math.ceil(((box.j1 + 1) * c) / ky) + 2);
  return x0 <= x1 && y0 <= y1 ? { x0, y0, x1, y1 } : null;
}

function paintRect(ctx: CanvasRenderingContext2D, terrain: Terrain, w: number, h: number, r: PixelRect): void {
  const img = ctx.createImageData(r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
  paintHeights(img.data, terrain, w, h, r);
  ctx.putImageData(img, r.x0, r.y0);
}

/** Writes the colours of the pixels in `r` of a w×h image into `out`, row-major from the rect's corner. Pure. */
export function paintHeights(out: Uint8ClampedArray, terrain: Terrain, w: number, h: number, r: PixelRect): void {
  const m = mapSize(terrain);
  const kx = m.width / w, ky = m.height / h;
  const rw = r.x1 - r.x0 + 1;
  for (let py = r.y0; py <= r.y1; py++) {
    for (let px = r.x0; px <= r.x1; px++) {
      writePixel(out, ((py - r.y0) * rw + (px - r.x0)) * 4, terrain, (px + 0.5) * kx, (py + 0.5) * ky, kx, ky);
    }
  }
}

function writePixel(out: Uint8ClampedArray, o: number, t: Terrain, x: number, y: number, kx: number, ky: number): void {
  const height = heightAt(t, x, y);
  const slope = (heightAt(t, x + kx, y + ky) - heightAt(t, x - kx, y - ky)) / (kx + ky);
  const light = Math.min(1.25, Math.max(0.55, 0.9 - slope * 3));
  const f = Math.min(1, height / TERRAIN_MAX_HEIGHT);
  for (let c = 0; c < 3; c++) out[o + c] = (LOW[c]! + (HIGH[c]! - LOW[c]!) * f) * light;
  out[o + 3] = 255;
}
