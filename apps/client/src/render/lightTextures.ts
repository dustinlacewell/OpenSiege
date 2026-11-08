import { LIGHT_BUFFER_FLOATS, MAX_LIGHTS, type LightPool, type LightVision } from "../game/lights.ts";
import { LIGHT_INDEX_CAPACITY, LIGHT_INDEX_ROW, LightTiles } from "./lightTiles.ts";
import { LIGHT_DATA_UNIT, LIGHT_INDEX_UNIT, LIGHT_TILES_UNIT, type SceneLights } from "./scene.ts";

/** Where the frame's lights are binned: the scene target's size in pixels and its camera. */
export interface LightTarget {
  readonly viewProj: Float32Array;
  readonly width: number;
  readonly height: number;
}

/**
 * The lights every lit pass reads this frame, as three data textures. `fill` once per frame before the scene draws;
 * `applyScene` binds them. The textures stay bound to their units, so a unit never holds a texture of the wrong type.
 */
export class LightTextures implements SceneLights {
  readonly data: WebGLTexture;
  readonly index: WebGLTexture;
  tiles: WebGLTexture;
  on = false;
  private readonly packed = new Float32Array(LIGHT_BUFFER_FLOATS);
  private readonly binned = new LightTiles();
  private tilesX = 1;
  private tilesY = 1;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.data = dataTexture(gl, LIGHT_DATA_UNIT, gl.RGBA32F, 3, MAX_LIGHTS);
    this.index = dataTexture(gl, LIGHT_INDEX_UNIT, gl.R32UI, LIGHT_INDEX_ROW, LIGHT_INDEX_CAPACITY / LIGHT_INDEX_ROW);
    this.tiles = dataTexture(gl, LIGHT_TILES_UNIT, gl.RG32UI, 1, 1);
    gl.activeTexture(gl.TEXTURE0);
  }

  fill(lights: LightPool, vision: LightVision, target: LightTarget): void {
    const count = lights.pack(this.packed, vision);
    this.binned.bin(this.packed, count, target.viewProj, target.width, target.height);
    this.on = count > 0;
    if (this.on) this.upload(count);
  }

  private upload(count: number): void {
    const gl = this.gl, b = this.binned;
    if (b.tilesX !== this.tilesX || b.tilesY !== this.tilesY) this.resizeTiles(b.tilesX, b.tilesY);
    gl.activeTexture(gl.TEXTURE0 + LIGHT_DATA_UNIT);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 3, count, gl.RGBA, gl.FLOAT, this.packed, 0);
    gl.activeTexture(gl.TEXTURE0 + LIGHT_TILES_UNIT);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, b.tilesX, b.tilesY, gl.RG_INTEGER, gl.UNSIGNED_INT, b.tiles, 0);
    const rows = Math.ceil(b.indexCount / LIGHT_INDEX_ROW);
    if (rows > 0) {
      gl.activeTexture(gl.TEXTURE0 + LIGHT_INDEX_UNIT);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LIGHT_INDEX_ROW, rows, gl.RED_INTEGER, gl.UNSIGNED_INT, b.indices, 0);
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  private resizeTiles(tilesX: number, tilesY: number): void {
    const gl = this.gl;
    gl.deleteTexture(this.tiles);
    this.tiles = dataTexture(gl, LIGHT_TILES_UNIT, gl.RG32UI, tilesX, tilesY);
    this.tilesX = tilesX;
    this.tilesY = tilesY;
  }
}

/** An immutable NEAREST texture with no mips, left bound to `unit` (which stays active). */
function dataTexture(gl: WebGL2RenderingContext, unit: number, format: number, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
