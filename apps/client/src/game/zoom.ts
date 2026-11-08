import type { Terrain } from "@mf/sim";
import { centerOn, setDistance, updateMatrices, type Camera } from "./camera.ts";
import { vec3 } from "./mat4.ts";
import { groundAt } from "./picking.ts";

const before = vec3();
const after = vec3();

/** Zoom by `factor` (>1 closer), keeping the ground point under (sx, sy) fixed. */
export function zoomAt(cam: Camera, terrain: Terrain | null, sx: number, sy: number, factor: number): void {
  const anchored = groundAt(cam, terrain, sx, sy, before);
  setDistance(cam, cam.dist / factor);
  updateMatrices(cam);
  if (!anchored || !groundAt(cam, terrain, sx, sy, after)) return;
  centerOn(cam, cam.x + before[0]! - after[0]!, cam.y + before[1]! - after[1]!);
  updateMatrices(cam);
}
