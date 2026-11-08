import { TERRAIN_MAX_HEIGHT, validateMapParams } from "@mf/sim";
import type { EditorMap, MapProps } from "./types.ts";

/** Every reason these props cannot make a map. Empty = valid. */
export function propsErrors(p: MapProps): string[] {
  const errors: string[] = [];
  if (p.name.trim() === "") errors.push("the name is empty");
  errors.push(...validateMapParams({ width: p.width, height: p.height, cell: p.cell }));
  if (!Number.isInteger(p.baseHeight) || p.baseHeight < 0 || p.baseHeight > TERRAIN_MAX_HEIGHT) {
    errors.push(`the base height is not a whole number in 0..${TERRAIN_MAX_HEIGHT}`);
  }
  return errors;
}

export function propsOf(m: EditorMap): MapProps {
  const { width, height, cell } = m.spec;
  return { name: m.name, width, height, cell, baseHeight: m.baseHeight };
}
