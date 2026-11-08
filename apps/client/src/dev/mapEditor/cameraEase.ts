import type { Camera } from "../../game/camera.ts";

/** How fast the shown camera closes on the target, per second. High: the lag is barely felt, but it smooths steps. */
const RATE = 28;

/**
 * Moves the shown camera `cam` a little toward `target`, where the input put it. Pan, zoom, yaw and tilt ease;
 * yaw takes the short way round. The target keeps the shown camera's ground height, so zooming at the cursor
 * picks from the same height the picture shows.
 */
export function easeCamera(cam: Camera, target: Camera, dt: number): void {
  const k = 1 - Math.exp(-dt * RATE);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
  cam.dist += (target.dist - cam.dist) * k;
  cam.tilt += (target.tilt - cam.tilt) * k;
  cam.yaw += shortAngle(target.yaw - cam.yaw) * k;
  cam.map = target.map;
  target.z = cam.z;
}

/** Snap the shown camera onto the target: for framing a new map. */
export function snapCamera(cam: Camera, target: Camera): void {
  cam.x = target.x;
  cam.y = target.y;
  cam.dist = target.dist;
  cam.tilt = target.tilt;
  cam.yaw = target.yaw;
  cam.map = target.map;
}

function shortAngle(a: number): number {
  const t = Math.PI * 2;
  return ((((a + Math.PI) % t) + t) % t) - Math.PI;
}
