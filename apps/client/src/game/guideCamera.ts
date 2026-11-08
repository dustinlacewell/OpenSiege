// Glides the camera to what each new tutorial step points at, and tracks the step's followed units.
// Lets go the moment the player pans.
import type { World } from "@mf/sim";
import { unitById } from "./lookup.ts";
import { centerOn, type Camera } from "./camera.ts";
import type { GuideView } from "./tutorial/types.ts";

/** Share of the remaining distance covered per second (exponential ease). */
const GLIDE_RATE = 4;
/** Close enough: the glide ends. World units. */
const ARRIVE = 15;
/** The camera moved this much from where the glide left it: the player panned, the glide ends. */
const TAKEOVER = 1;

interface Point { x: number; y: number }

export class GuideCamera {
  private index = -1;
  private target: Point | null = null;
  /** The step's follow list is not empty. A follow starts when it fills, so a pan before it does not stop it. */
  private following = false;
  private left: Point = { x: 0, y: 0 };

  /** Call once per frame with the guide's view. A new step starts a glide to its focus. */
  update(view: GuideView | null, world: World, cam: Camera, dt: number): void {
    if (!view) {
      this.index = -1;
      this.target = null;
      this.following = false;
      return;
    }
    if (view.index !== this.index) this.start(view, world, cam);
    this.track(middle(liveUnits(view.follow, world)), cam);
    if (this.target) this.glide(this.target, cam, dt);
  }

  private start(view: GuideView, world: World, cam: Camera): void {
    this.index = view.index;
    this.target = lookPoint(view, world);
    this.following = false;
    this.left = { x: cam.x, y: cam.y };
  }

  /** A follow that starts takes the camera again. While it runs, the target moves with the units. */
  private track(followed: Point | null, cam: Camera): void {
    if (!followed) {
      this.following = false;
      return;
    }
    if (!this.following) {
      this.following = true;
      this.target = followed;
      this.left = { x: cam.x, y: cam.y };
    }
    if (this.target) this.target = followed;
  }

  private glide(target: Point, cam: Camera, dt: number): void {
    if (Math.hypot(cam.x - this.left.x, cam.y - this.left.y) > TAKEOVER) {
      this.target = null;
      return;
    }
    const k = 1 - Math.exp(-GLIDE_RATE * dt);
    centerOn(cam, cam.x + (target.x - cam.x) * k, cam.y + (target.y - cam.y) * k);
    this.left = { x: cam.x, y: cam.y };
    if (!this.following && Math.hypot(target.x - cam.x, target.y - cam.y) < ARRIVE) this.target = null;
  }
}

/**
 * The middle of what a step points at. Its living units come first, since the player has to click them.
 * With none, the middle of its zones and its gesture. Null with nothing to look at.
 */
export function lookPoint(view: GuideView, world: World): Point | null {
  const pts: Point[] = liveUnits(view.units, world);
  if (pts.length === 0) pts.push(...view.zones);
  if (pts.length === 0 && view.gesture) pts.push(view.gesture.from, view.gesture.to);
  return middle(pts);
}

function liveUnits(ids: readonly number[], world: World): Point[] {
  const pts: Point[] = [];
  for (const id of ids) {
    const u = unitById(world.units, id);
    if (u) pts.push(u);
  }
  return pts;
}

function middle(pts: readonly Point[]): Point | null {
  if (pts.length === 0) return null;
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}
