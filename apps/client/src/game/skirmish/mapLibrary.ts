// The maps a skirmish can play: every hand-made map, then a generated one. Pure: files are read at the edge.
import { drawById, mapChoices, type LibraryFile, type LibraryMap, type MapDraw } from "@mf/map";
import { DEFAULT_MAP_PARAMS } from "@mf/sim";

/** The files of the map folder as the bundler hands them: map text and preview URLs, each keyed by file path. */
export function libraryFiles(texts: Readonly<Record<string, string>>, previews: Readonly<Record<string, string>>): LibraryFile[] {
  const previewOf = new Map(Object.entries(previews).map(([path, url]) => [stemOf(path), url]));
  return Object.entries(texts).map(([path, text]) => ({ stem: stemOf(path), text, previewUrl: previewOf.get(stemOf(path)) ?? null }));
}

/** "../maps/ford.json" gives "ford". */
function stemOf(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file.slice(0, file.lastIndexOf("."));
}

/** One draw per library map in stem order, then the generated map last. The generated one has `info` null. */
export function skirmishDraws(library: readonly LibraryMap[]): MapDraw[] {
  const draws = [...mapChoices(library, DEFAULT_MAP_PARAMS).maps.map((m) => drawById(library, DEFAULT_MAP_PARAMS, m.id)), drawById(library, DEFAULT_MAP_PARAMS, null)];
  return draws.filter((d): d is MapDraw => d !== null);
}
