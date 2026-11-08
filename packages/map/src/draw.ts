import { generateMap, type MapParams, type MapSpec } from "@mf/sim";
import type { LibraryMap } from "./library.ts";

// Which map a match plays. Pure: randomness is injected.
// The pool is every library map plus one generated slot. Each match draws one, uniformly.

/** What a setup screen shows of a map. `id` is the library map's file stem; `preview` is a URL path to a top-down JPEG, or null. */
export interface MapInfo {
  id: string;
  name: string;
  preview: string | null;
}

/** One match's map. `info` is what a setup screen shows (null = a generated map). `spec` makes it from the match seed. */
export interface MapDraw {
  info: MapInfo | null;
  spec(seed: number): MapSpec;
}

/** One uniform pick from the library plus one generated slot (when `params` is set). A library map ignores the seed. */
export function drawMap(library: readonly LibraryMap[], params: MapParams | null, random: () => number): MapDraw {
  const slots = library.length + (params ? 1 : 0);
  if (slots === 0) throw new Error("drawMap: no maps to draw from");
  const i = Math.min(slots - 1, Math.floor(random() * slots));
  const picked = library[i];
  return picked ? libraryDraw(picked) : generatedDraw(params!);
}

function libraryDraw(map: LibraryMap): MapDraw {
  return { info: { id: map.stem, name: map.name, preview: map.preview }, spec: () => map.spec };
}

function generatedDraw(params: MapParams): MapDraw {
  return { info: null, spec: (seed) => generateMap(seed, params) };
}

/** The map's name in quotes for a log line, or "random" for a generated one. */
export function mapLabel(draw: MapDraw): string {
  return draw.info ? `"${draw.info.name}"` : "random";
}

/** What a private host may pick: every library map, and a generated one when `params` is set. */
export interface MapChoices {
  maps: MapInfo[];
  randomMap: boolean;
}

export function mapChoices(library: readonly LibraryMap[], params: MapParams | null): MapChoices {
  return { maps: library.map((m) => libraryDraw(m).info!), randomMap: params !== null };
}

/** The draw for this library map (by stem), or the generated one for null. Null when the pool has no such slot. */
export function drawById(library: readonly LibraryMap[], params: MapParams | null, id: string | null): MapDraw | null {
  if (id === null) return params ? generatedDraw(params) : null;
  const picked = library.find((m) => m.stem === id);
  return picked ? libraryDraw(picked) : null;
}
