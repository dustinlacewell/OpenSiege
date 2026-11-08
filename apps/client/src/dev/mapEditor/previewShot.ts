import type { MapSpec, World } from "@mf/sim";
import { createCamera, FOV_Y, type Camera } from "../../game/camera.ts";
import { invert, multiply, perspective, setVec3, viewFromBasis } from "../../game/mat4.ts";
import type { Viewport } from "./viewport.ts";

/** The longest side of a preview, in pixels. */
const PREVIEW_PX = 512;
/** Room around the map, as a share of the view. */
const MARGIN = 1.02;

/**
 * Draws the map straight down from above, north up, and copies the map's rectangle into a small 2D canvas.
 * Reads the GL canvas in the same task as the draw, before the browser clears it. The caller draws its own
 * frame after, so the shot is never on screen.
 */
export function takeShot(viewport: Viewport, canvas: HTMLCanvasElement, world: World, spec: MapSpec, dpr: number, time: number): HTMLCanvasElement {
  const view = { width: canvas.clientWidth, height: canvas.clientHeight };
  const { cam, halfW, halfH } = topDownCamera(spec, view.width, view.height);
  viewport.draw(world, cam, [], dpr, time);
  const sw = (canvas.width * spec.width) / (2 * halfW);
  const sh = (canvas.height * spec.height) / (2 * halfH);
  const k = PREVIEW_PX / Math.max(spec.width, spec.height);
  const out = document.createElement("canvas");
  out.width = Math.round(spec.width * k);
  out.height = Math.round(spec.height * k);
  out.getContext("2d")!.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, out.width, out.height);
  return out;
}

/**
 * A camera over the map centre at the mean ground height, pitch 90°, far enough that the whole map fits.
 * `halfW`, `halfH`: half the view at that height, in world units. The game camera clamps its pitch, so the
 * matrices are written here.
 */
function topDownCamera(spec: MapSpec, width: number, height: number): { cam: Camera; halfW: number; halfH: number } {
  const cam = createCamera(width, height);
  const aspect = width / Math.max(1, height);
  const t = Math.tan(FOV_Y / 2);
  const dist = (MARGIN * Math.max(spec.height / 2, spec.width / (2 * aspect))) / t;
  const z = spec.heights.reduce((a, h) => a + h, 0) / spec.heights.length;
  Object.assign(cam, { x: spec.width / 2, y: spec.height / 2, z, dist, pitch: Math.PI / 2, map: { width: spec.width, height: spec.height } });
  setVec3(cam.right, 1, 0, 0);
  setVec3(cam.up, 0, -1, 0);
  setVec3(cam.back, 0, 0, 1);
  setVec3(cam.eye, cam.x, cam.y, z + dist);
  viewFromBasis(cam.view, cam.eye, cam.right, cam.up, cam.back);
  perspective(cam.proj, FOV_Y, aspect, Math.max(5, dist * 0.05), dist * 2 + 2000);
  multiply(cam.viewProj, cam.proj, cam.view);
  invert(cam.invViewProj, cam.viewProj);
  return { cam, halfW: dist * t * aspect, halfH: dist * t };
}
