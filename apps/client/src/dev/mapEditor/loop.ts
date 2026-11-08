import { followGround, resize, updateMatrices, worldPerPixel, type Camera } from "../../game/camera.ts";
import type { BrushInput } from "./brushInput.ts";
import { easeCamera } from "./cameraEase.ts";
import type { CameraInput } from "./cameraInput.ts";
import { cursorRings, type Ring } from "./cursorRings.ts";
import type { Editor } from "./editor.ts";
import type { FpsMeter } from "./fpsMeter.ts";
import type { PreviewSchedule } from "./previewSchedule.ts";
import { takeShot } from "./previewShot.ts";
import { cursorRadius } from "./settings.ts";
import type { Viewport } from "./viewport.ts";

export interface LoopParts {
  canvas: HTMLCanvasElement;
  /** The shown camera. */
  cam: Camera;
  /** Where input puts the camera. `cam` eases toward it. */
  target: Camera;
  viewport: Viewport;
  editor: Editor;
  camera: CameraInput;
  brush: BrushInput;
  fps: FpsMeter;
  preview: PreviewParts;
}

export interface PreviewParts {
  schedule: PreviewSchedule;
  /** A new top-down shot of the map. */
  onShot(shot: HTMLCanvasElement): void;
}

const MAX_DT = 0.1;

/** One frame per animation frame: fit the canvas, pan, ease the camera, follow the ground, rewrite dirty mesh rows, take a preview when due, draw with the cursor rings. */
export function startLoop(p: LoopParts): void {
  let last = performance.now();
  const tick = (now: number) => {
    const real = (now - last) / 1000;
    const dt = Math.min(MAX_DT, real);
    last = now;
    p.fps.tick(real);
    const dpr = window.devicePixelRatio || 1;
    fitView(p, dpr);
    moveCamera(p, dt);
    p.editor.flush();
    shootPreview(p, dpr, now / 1000);
    p.viewport.draw(p.editor.scene.world, p.cam, rings(p), dpr, now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function moveCamera(p: LoopParts, dt: number): void {
  p.camera.update(dt);
  easeCamera(p.cam, p.target, dt);
  followGround(p.cam, p.editor.scene.terrain, dt);
  updateMatrices(p.target);
}

/** Draws the shot before the frame's own draw, so only the frame reaches the screen. */
function shootPreview(p: LoopParts, dpr: number, now: number): void {
  const { schedule, onShot } = p.preview;
  if (!schedule.due(now)) return;
  schedule.taken(now);
  onShot(takeShot(p.viewport, p.canvas, p.editor.scene.world, p.editor.map.spec, dpr, now));
}

/** The brush rings at the hover point and its symmetric copies, and the outlines a press would place or erase. */
function rings(p: LoopParts): Ring[] {
  const at = p.brush.hover();
  if (!at) return [];
  const s = p.editor.settings;
  return cursorRings(p.editor.copiesOf(at), cursorRadius(s), s, p.editor.preview(at), worldPerPixel(p.cam));
}

function fitView(p: LoopParts, dpr: number): void {
  p.viewport.fit(dpr);
  const { clientWidth: w, clientHeight: h } = p.canvas;
  for (const c of [p.cam, p.target]) if (c.width !== w || c.height !== h) resize(c, w, h);
}
