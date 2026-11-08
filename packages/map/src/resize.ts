import type { MapSpec } from "@mf/sim";
import { propsErrors } from "./props.ts";
import { MATERIAL_CHANNELS, type EditorMap, type MapProps } from "./types.ts";

/**
 * A new map with these props. The corner (0, 0) stays put. Shrinking clips heights, materials, features (by centre)
 * and fields (wholly inside). Growing adds flat ground at the base height, painted with channel 0. The cell must not
 * change. Pure: `m` is not touched. Throws on bad props.
 */
export function resizeMap(m: EditorMap, p: MapProps): EditorMap {
  const errors = propsErrors(p);
  if (p.cell !== m.spec.cell) errors.push("the cell size cannot change");
  if (errors.length > 0) throw new Error(`resizeMap: ${errors.join("; ")}`);
  const grid = gridMap(m.spec, p);
  return {
    name: p.name,
    baseHeight: p.baseHeight,
    spec: {
      width: p.width,
      height: p.height,
      cell: p.cell,
      heights: grid.map((v) => (v < 0 ? p.baseHeight : m.spec.heights[v]!)),
      rng: m.spec.rng,
      fields: m.spec.fields.filter((f) => f.x - f.radius >= 0 && f.y - f.radius >= 0 && f.x + f.radius <= p.width && f.y + f.radius <= p.height),
      features: m.spec.features.filter((f) => f.x <= p.width && f.y <= p.height),
    },
    materials: { weights: resizeWeights(m.materials.weights, grid) },
    palette: m.palette,
  };
}

/** For each new vertex, the old vertex index at the same spot, or -1 for new ground. */
function gridMap(old: MapSpec, p: MapProps): number[] {
  const oldCols = old.width / old.cell + 1, oldRows = old.height / old.cell + 1;
  const cols = p.width / p.cell + 1, rows = p.height / p.cell + 1;
  const out = new Array<number>(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) out[j * cols + i] = i < oldCols && j < oldRows ? j * oldCols + i : -1;
  }
  return out;
}

function resizeWeights(old: Uint8Array, grid: readonly number[]): Uint8Array {
  const out = new Uint8Array(grid.length * MATERIAL_CHANNELS);
  grid.forEach((v, n) => {
    if (v < 0) out[n * MATERIAL_CHANNELS] = 255;
    else out.set(old.subarray(v * MATERIAL_CHANNELS, (v + 1) * MATERIAL_CHANNELS), n * MATERIAL_CHANNELS);
  });
  return out;
}
