// The hand-made maps of the repo's `maps/` folder, read by the bundler. The tutorial map lives in a subfolder and stays out.
import { buildLibrary, type LibraryMap } from "@mf/map";
import { libraryFiles } from "../game/skirmish/mapLibrary.ts";

const texts = import.meta.glob<string>("../../../../maps/*.json", { query: "?raw", import: "default" });
const previews = import.meta.glob<string>("../../../../maps/*.jpg", { query: "?url", import: "default", eager: true });

/** Loads every map file. A bad file is logged and skipped. */
export async function loadLibrary(): Promise<LibraryMap[]> {
  const loaded = await Promise.all(Object.entries(texts).map(async ([path, load]) => [path, await load()] as const));
  return buildLibrary(libraryFiles(Object.fromEntries(loaded), previews), (line) => console.warn(line));
}
