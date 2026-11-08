import type { MapSpec } from "@mf/sim";
import { parseMap } from "./file.ts";

// The hand-made maps of one folder. Pure: the folder reads happen at the edge and arrive as `LibraryFile`s.
// A file is `<stem>.json` in the map file format. A `<stem>.jpg` beside it is its preview.

export interface LibraryMap {
  stem: string;
  name: string;
  spec: MapSpec;
  /** The URL of its preview picture, or null when it has none. */
  preview: string | null;
}

/** One map file, read: its stem, its text, and the preview URL the caller chose (null = no preview). */
export interface LibraryFile {
  stem: string;
  text: string;
  previewUrl: string | null;
}

/** A map file name: lower-case letters, digits and dashes. The same rule guards the preview route. */
export const MAP_STEM = /^[a-z0-9-]+$/;

/** The stems of the `*.json` files whose stem is a valid map name, sorted. */
export function mapStems(files: readonly string[]): string[] {
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .filter((stem) => MAP_STEM.test(stem))
    .sort();
}

/** Every good map in `files`, sorted by stem. A bad file is logged with its errors and skipped. */
export function buildLibrary(files: readonly LibraryFile[], log: (line: string) => void): LibraryMap[] {
  const maps: LibraryMap[] = [];
  for (const { stem, text, previewUrl } of [...files].sort((a, b) => (a.stem < b.stem ? -1 : a.stem > b.stem ? 1 : 0))) {
    const parsed = parseMap(text);
    if ("errors" in parsed) log(`map ${stem}.json skipped:\n- ${parsed.errors.join("\n- ")}`);
    else maps.push({ stem, name: parsed.map.name, spec: parsed.map.spec, preview: previewUrl });
  }
  return maps;
}
