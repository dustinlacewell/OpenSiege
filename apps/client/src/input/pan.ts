/** Screen pixels per second of keyboard and edge pan. */
export const PAN_SPEED = 900;
export const EDGE_PX = 12;

export interface PanInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** Last pointer position in CSS pixels, or null when the pointer is outside the window. */
  pointer: { x: number; y: number } | null;
  width: number;
  height: number;
}

/** Screen-space pan for this frame. Positive x moves the view right (the world slides left). */
export function panVector(input: PanInput, dt: number): [number, number] {
  let dx = Number(input.right) - Number(input.left);
  let dy = Number(input.down) - Number(input.up);
  const p = input.pointer;
  if (p) {
    if (p.x <= EDGE_PX) dx -= 1;
    if (p.x >= input.width - EDGE_PX) dx += 1;
    if (p.y <= EDGE_PX) dy -= 1;
    if (p.y >= input.height - EDGE_PX) dy += 1;
  }
  const s = PAN_SPEED * dt;
  return [Math.sign(dx) * s, Math.sign(dy) * s];
}
