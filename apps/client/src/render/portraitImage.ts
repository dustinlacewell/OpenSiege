/** Read-back RGBA pixels (bottom row first) → a 2D canvas, upright, with a soft vignette. */
export function portraitCanvas(pixels: Uint8Array, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  ctx.putImageData(flipped(pixels, size), 0, 0);
  vignette(ctx, size);
  return canvas;
}

function flipped(pixels: Uint8Array, size: number): ImageData {
  const image = new ImageData(size, size);
  const row = size * 4;
  for (let y = 0; y < size; y++) image.data.set(pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  return image;
}

/** Darkens toward the corners, lit from slightly above centre. */
function vignette(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c * 0.85, size * 0.2, c, c, size * 0.75);
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}
