/** Floats per prop instance: x, y, z, yaw · footprint scale, height scale, tint. */
export const PROP_STRIDE = 7;

/** One placed prop. Models are 1 wide (radius) and 1 tall; the scales stretch them. */
export interface PropInstance {
  x: number;
  y: number;
  /** Ground height under the foot. */
  z: number;
  yaw: number;
  /** World units of the model's radius. */
  scaleXY: number;
  /** World units of the model's height. */
  scaleZ: number;
  /** 0..1, brightens or darkens this one a little. */
  tint: number;
}

export function createPropInstance(): PropInstance {
  return { x: 0, y: 0, z: 0, yaw: 0, scaleXY: 1, scaleZ: 1, tint: 0.5 };
}

/** Writes `p` at float offset `o`. */
export function writeProp(d: Float32Array, o: number, p: PropInstance): void {
  d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.yaw;
  d[o + 4] = p.scaleXY; d[o + 5] = p.scaleZ; d[o + 6] = p.tint;
}
