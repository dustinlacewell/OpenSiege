import type { MapSpec } from "@mf/sim";

/** Material weights per terrain vertex, four channels. Row-major like `heights`: `(j * cols + i) * 4 + channel`. 0..255. */
export interface MaterialLayer {
  weights: Uint8Array;
}

export interface PaletteEntry {
  name: string;
  /** sRGB 0..255. */
  color: [number, number, number];
}

/** Four materials, one per channel. */
export type Palette = [PaletteEntry, PaletteEntry, PaletteEntry, PaletteEntry];

/** What the properties form edits. `baseHeight`: the height of a new map, and of ground a resize adds. */
export interface MapProps {
  name: string;
  width: number;
  height: number;
  cell: number;
  baseHeight: number;
}

/** A sim `MapSpec` plus the visual-only layers the editor adds. The sim never reads `materials` or `palette`. */
export interface EditorMap {
  name: string;
  baseHeight: number;
  spec: MapSpec;
  materials: MaterialLayer;
  palette: Palette;
}

/** One map in a folder of map files, as a level list shows it. */
export interface MapEntry {
  file: string;
  name: string;
  width: number;
  height: number;
  /** A URL of its top-down picture, or null when it has none yet. */
  preview: string | null;
}

export const MATERIAL_CHANNELS = 4;
