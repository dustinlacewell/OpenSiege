import { createWorld, DEFAULT_MAP_PARAMS, generateMap, mapSize, type MapSize } from "@mf/sim";
import { orbitAt } from "../game/backdropOrbit.ts";
import { addTilt, centerOn, createCamera, followGround, resize, setCameraMap, setDistance, type Camera } from "../game/camera.ts";
import { LightPool } from "../game/lights.ts";
import { ParticlePool } from "../game/particles.ts";
import { Vision } from "../game/vision.ts";
import type { Frame } from "../render/frame.ts";

/** Fixed, so every visitor sees the same map behind the menus. */
const SEED = 0x51e6e;
/** Radians above the lowest pitch: a low, cinematic view. */
const LIFT = 0.05;

/**
 * The scene behind the home screens: a local world (terrain and fields, no players)
 * seen by its own camera on a slow orbit. Input never reaches this camera.
 */
export class Backdrop {
  readonly frame: Frame;
  private readonly cam: Camera;
  private readonly map: MapSize;

  constructor() {
    const world = createWorld(generateMap(SEED, DEFAULT_MAP_PARAMS));
    this.map = mapSize(world.terrain);
    this.cam = createCamera(1, 1);
    setCameraMap(this.cam, this.map);
    const vision = new Vision();
    vision.update(world, -1, 0);
    this.frame = {
      world, prev: new Map(), prevShots: new Map(), alpha: 0, me: -1, selected: new Set(), curve: null, area: null, guardHover: 0, box: null, boxPreview: new Set(),
      cam: this.cam, dpr: 1, particles: new ParticlePool(), lights: new LightPool(), vision, time: 0, guide: null,
    };
  }

  /** Moves the camera along the orbit and fills the frame. `size` is the canvas in CSS pixels. */
  update(now: number, dt: number, dpr: number, size: { width: number; height: number }): void {
    const t = now / 1000;
    this.place(t, size);
    followGround(this.cam, this.frame.world.terrain, dt);
    this.frame.dpr = dpr;
    this.frame.time = t;
  }

  /** Puts the camera on the orbit at `t`, at the lowest pitch plus `LIFT`. */
  private place(t: number, size: { width: number; height: number }): void {
    const cam = this.cam;
    if (cam.width !== size.width || cam.height !== size.height) resize(cam, size.width, size.height);
    const pose = orbitAt(t, this.map);
    centerOn(cam, pose.x, pose.y);
    setDistance(cam, pose.dist);
    cam.yaw = pose.yaw;
    cam.tilt = 0;
    addTilt(cam, -Math.PI);
    addTilt(cam, LIFT);
  }
}
