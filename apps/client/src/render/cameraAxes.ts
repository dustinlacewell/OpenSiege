import type { Camera } from "../game/camera.ts";

/** Screen right and up in world space, read from the view matrix rows. Writes into `right` and `up`. */
export function cameraAxes(cam: Camera, right: Float32Array, up: Float32Array): void {
  const v = cam.view;
  right[0] = v[0]!; right[1] = v[4]!; right[2] = v[8]!;
  up[0] = v[1]!; up[1] = v[5]!; up[2] = v[9]!;
}
