import type { Terrain, VertexBox } from "@mf/sim";
import { followGround, resize, type Camera } from "../game/camera.ts";
import { Backdrop } from "./backdrop.ts";
import type { WorldSounds } from "../audio/worldSounds.ts";
import { PickScene } from "./pickScene.ts";
import type { AutoSiege } from "../game/autoSiege.ts";
import { Effects } from "../game/effects.ts";
import { GuideCamera } from "../game/guideCamera.ts";
import type { Session } from "../game/session.ts";
import { NO_GUIDE, type Guide } from "../game/tutorial/guide.ts";
import type { Vision } from "../game/vision.ts";
import { goHome } from "../input/actions.ts";
import type { Input } from "../input/input.ts";
import type { Frame } from "../render/frame.ts";
import type { Renderer } from "../render/renderer.ts";
import type { Hud } from "../ui/hud.ts";

export interface LoopParts {
  canvas: HTMLCanvasElement;
  session: Session;
  cam: Camera;
  input: Input;
  renderer: Renderer;
  hud: Hud;
  vision: Vision;
  /** Plays what changed in the world each step. */
  sounds: WorldSounds;
  /** Sends a siege intent for own units that idled long enough. */
  autoSiege: AutoSiege;
  /** Whether the player wants auto-siege, from the settings. */
  autoSiegeOn(): boolean;
  /** Multiplies the device pixel ratio: the canvas buffer scale, from the settings. */
  renderScale(): number;
  /** Draws the pick panel and spot markers each frame of the pick phase. */
  drawPick(now: number, cam: Camera, terrain: Terrain | null): void;
  /** The tutorial seam. Steps once per frame after the lockstep; its view goes into the frame. Default `NO_GUIDE`. */
  guide?: Guide;
}

const MAX_DT = 0.1;

/** Runs one frame per animation frame: input, lockstep, vision, effects, camera, draw (match, pick scene or backdrop), HUD. Returns the cancel. */
export function startLoop(parts: LoopParts): () => void {
  const { session, cam, renderer, vision } = parts;
  const guide = parts.guide ?? NO_GUIDE;
  const effects = new Effects();
  const backdrop = new Backdrop();
  const pickScene = new PickScene(cam);
  const guideCam = new GuideCamera();
  const frame: Frame = {
    world: null!, prev: new Map(), prevShots: new Map(), alpha: 0, me: -1, selected: new Set(), curve: null, area: null, guardHover: 0, box: null, boxPreview: new Set(),
    cam, dpr: 1, particles: effects.pool, lights: effects.lights, vision, time: 0, guide: null,
  };
  let last = performance.now();
  let handle = 0;

  const tick = (now: number) => {
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    const dpr = (window.devicePixelRatio || 1) * parts.renderScale();
    fitView(parts, dpr);
    parts.input.update(dt);
    const ls = session.lockstep;
    if (ls) {
      ls.update(now);
      const dirty = ls.terrainWatch.take();
      if (dirty) refreshTerrain(parts, ls.world.terrain, dirty);
      session.pruneSelection();
      guide.update();
      parts.autoSiege.update(ls.world, session.me, !session.watching && !session.viewing && parts.autoSiegeOn());
      if (!session.homed) session.homed = goHome(session, cam);
      guideCam.update(guide.view(), ls.world, cam, dt);
      vision.revealAll = session.overview;
      vision.update(ls.world, session.me, now / 1000);
      effects.update(ls.world, ls.prev, dt);
      parts.sounds.update(ls.world, session.me, cam, now / 1000);
    } else frame.guide = null;
    followGround(cam, session.terrain, dt);
    const pickWorld = session.pickWorld;
    if (ls) {
      fillFrame(frame, session, guide, now, dpr);
      renderer.draw(frame);
    } else if (pickWorld) {
      pickScene.update(pickWorld, cam, now, dpr);
      renderer.draw(pickScene.frame);
      parts.drawPick(now, cam, pickWorld.terrain);
    } else {
      backdrop.update(now, dt, dpr, cam);
      renderer.draw(backdrop.frame);
    }
    parts.hud.update(now);
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}

/** Hands the box the sim reshaped this frame to every consumer that keeps heights. Before vision updates. */
function refreshTerrain(parts: LoopParts, terrain: Terrain, box: VertexBox): void {
  parts.renderer.refreshTerrain(terrain, box);
  parts.vision.refresh(terrain, box);
  parts.hud.refreshTerrain(terrain, box);
}

function fitView(parts: LoopParts, dpr: number): void {
  parts.renderer.fit(dpr);
  const { clientWidth: w, clientHeight: h } = parts.canvas;
  if (parts.cam.width !== w || parts.cam.height !== h) resize(parts.cam, w, h);
}

function fillFrame(frame: Frame, session: Session, guide: Guide, now: number, dpr: number): void {
  const ls = session.lockstep!;
  frame.world = ls.world;
  frame.prev = ls.prev;
  frame.prevShots = ls.prevShots;
  frame.alpha = ls.alpha(now);
  frame.me = session.me;
  frame.selected = session.selectedSet;
  frame.curve = session.curve;
  frame.area = session.area;
  frame.guardHover = session.guardHover;
  frame.box = session.box;
  frame.boxPreview = session.boxPreview;
  frame.dpr = dpr;
  frame.time = now / 1000;
  frame.guide = guide.view();
}
