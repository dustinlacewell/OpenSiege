import { mapSize, type MapSize, type Terrain, type VertexBox, type World } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { playerById } from "../game/lookup.ts";
import { vec3 } from "../game/mat4.ts";
import { colorCss } from "../game/palette.ts";
import { groundAt } from "../game/picking.ts";
import type { Spot } from "../game/radarSpot.ts";
import type { Vision } from "../game/vision.ts";
import type { Actions } from "../input/actions.ts";
import { heightImage, refreshHeightImage } from "./heightImage.ts";
import { minimapExtent, minimapScale, minimapWorld, type Extent } from "./minimapModel.ts";

/** Corners of the screen, as fractions of width and height, in drawing order. */
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
/** Radar dots: round, faint, a little bigger than a unit square, so they read as rough. */
const RADAR_DOT_PX = 2.5;
const RADAR_ALPHA = 0.55;

/**
 * 2D-canvas overview: shaded terrain, fields, seen units as player-coloured squares,
 * radar contacts as faint round dots at their radar spot, the camera footprint. Click jumps.
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  /** Length of the longer canvas side, from the canvas element. */
  private readonly size: number;
  private readonly corner = vec3();
  private readonly spot: Spot = { x: 0, y: 0 };
  private terrain: Terrain | null = null;
  private image: HTMLCanvasElement | null = null;
  private map: MapSize = { width: 1, height: 1 };
  private extent: Extent;

  constructor(private readonly canvas: HTMLCanvasElement, actions: Actions, private readonly vision: Vision) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    this.ctx = ctx;
    this.size = Math.max(canvas.width, canvas.height);
    this.extent = { w: canvas.width, h: canvas.height };
    canvas.addEventListener("pointerdown", (e) => this.jump(e, actions));
    canvas.addEventListener("pointermove", (e) => {
      if (e.buttons & 1) this.jump(e, actions);
    });
  }

  draw(world: World | null, cam: Camera): void {
    const ctx = this.ctx;
    if (world) this.fit(world.terrain);
    ctx.fillStyle = "#0d1216";
    ctx.fillRect(0, 0, this.extent.w, this.extent.h);
    if (!world) return;
    ctx.drawImage(this.imageFor(world.terrain), 0, 0);
    this.drawWorld(world);
    this.drawRadar(world);
    this.drawFootprint(cam, world.terrain);
  }

  /** Shapes the canvas to the terrain's aspect when the terrain changes. */
  private fit(terrain: Terrain): void {
    if (this.terrain === terrain) return;
    this.terrain = terrain;
    this.image = null;
    this.map = mapSize(terrain);
    this.extent = minimapExtent(this.map, this.size);
    const { w, h } = this.extent;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  /** The heights in this vertex box changed in place: repaint the part of the height image that read them. */
  refresh(terrain: Terrain, box: VertexBox): void {
    if (this.image && terrain === this.terrain) refreshHeightImage(this.image, terrain, box);
  }

  private imageFor(terrain: Terrain): HTMLCanvasElement {
    this.image ??= heightImage(terrain, this.extent.w, this.extent.h);
    return this.image;
  }

  private drawWorld(world: World): void {
    const ctx = this.ctx;
    const k = minimapScale(this.map, this.extent);
    ctx.fillStyle = "rgba(8, 14, 6, 0.4)";
    ctx.beginPath();
    for (const f of world.features) ctx.rect(f.x * k - 0.5, f.y * k - 0.5, 1, 1);
    ctx.fill();
    ctx.fillStyle = "rgba(70, 240, 215, 0.45)";
    for (const f of world.fields) {
      ctx.beginPath();
      ctx.arc(f.x * k, f.y * k, Math.max(1.5, f.radius * k), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const u of world.units) {
      if (!this.vision.shows(u)) continue;
      const p = playerById(world.players, u.owner);
      ctx.fillStyle = p ? colorCss(p.color) : "#999";
      const s = u.kind === "factory" ? 4 : 2;
      ctx.fillRect(u.x * k - s / 2, u.y * k - s / 2, s, s);
    }
  }

  private drawRadar(world: World): void {
    const ctx = this.ctx;
    const k = minimapScale(this.map, this.extent);
    ctx.globalAlpha = RADAR_ALPHA;
    for (const u of this.vision.radarContacts()) {
      const s = this.vision.radarSpot(u, this.spot);
      const p = playerById(world.players, u.owner);
      ctx.fillStyle = p ? colorCss(p.color) : "#999";
      ctx.beginPath();
      ctx.arc(s.x * k, s.y * k, RADAR_DOT_PX, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The four screen corners picked onto the ground. */
  private drawFootprint(cam: Camera, terrain: Terrain): void {
    const ctx = this.ctx;
    const k = minimapScale(this.map, this.extent);
    ctx.beginPath();
    for (const [fx, fy] of CORNERS) {
      groundAt(cam, terrain, fx * cam.width, fy * cam.height, this.corner);
      ctx.lineTo(this.corner[0]! * k, this.corner[1]! * k);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private jump(e: PointerEvent, actions: Actions): void {
    const r = this.canvas.getBoundingClientRect();
    const p = minimapWorld(this.map, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    actions.jumpTo(p.x, p.y);
  }
}
