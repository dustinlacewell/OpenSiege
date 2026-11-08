import { mapSize, type World } from "@mf/sim";
import { MAX_DIST, setCameraMap, setDistance, type Camera } from "../game/camera.ts";
import { LightPool } from "../game/lights.ts";
import { ParticlePool } from "../game/particles.ts";
import { Vision } from "../game/vision.ts";
import type { Frame } from "../render/frame.ts";

/** How far the camera starts, as a share of the farthest zoom: the whole map in view. */
const START_DIST = 0.8 * MAX_DIST;

/**
 * The scene of the pick phase: the match world with no players, seen by the player's own camera
 * (pan, zoom and orbit work as in a match). `begin` frames the map once per world.
 */
export class PickScene {
  readonly frame: Frame;
  private world: World | null = null;
  private readonly vision = new Vision();

  constructor(cam: Camera) {
    this.frame = {
      world: null!, prev: new Map(), prevShots: new Map(), alpha: 0, me: -1, selected: new Set(), curve: null, area: null, guardHover: 0, box: null, boxPreview: new Set(),
      cam, dpr: 1, particles: new ParticlePool(), lights: new LightPool(), vision: this.vision, time: 0, guide: null,
    };
  }

  /** Fills the frame. On a new world it first binds the camera to the map and centres it. */
  update(world: World, cam: Camera, now: number, dpr: number): void {
    if (world !== this.world) this.begin(world, cam);
    this.frame.dpr = dpr;
    this.frame.time = now / 1000;
  }

  private begin(world: World, cam: Camera): void {
    this.world = world;
    this.frame.world = world;
    this.vision.update(world, -1, 0);
    setCameraMap(cam, mapSize(world.terrain));
    setDistance(cam, START_DIST);
    cam.yaw = 0;
    cam.tilt = 0;
  }
}
