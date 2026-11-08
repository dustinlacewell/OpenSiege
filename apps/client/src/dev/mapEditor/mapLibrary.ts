import { parseMap, serializeMap, type EditorMap, type MapEntry } from "@mf/map";

// The dev server's level library routes (`apps/client/devMapsPlugin.ts`), the repo's `maps/` folder.

const ROUTE = "/__dev/maps";

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export async function listMaps(): Promise<Result<MapEntry[]>> {
  return request(`${ROUTE}/`, {}, async (res) => (await res.json()) as MapEntry[]);
}

export async function loadMap(file: string): Promise<Result<EditorMap>> {
  const got = await request(`${ROUTE}/${file}`, {}, (res) => res.text());
  if (!got.ok) return got;
  const parsed = parseMap(got.value);
  return "errors" in parsed ? { ok: false, errors: parsed.errors } : { ok: true, value: parsed.map };
}

/** The dev server checks the map and writes it only if it is legal. */
export async function saveMap(file: string, map: EditorMap): Promise<Result<null>> {
  const init = { method: "PUT", headers: { "content-type": "application/json" }, body: serializeMap(map) };
  return request(`${ROUTE}/${file}`, init, async () => null);
}

/** Writes the map's top-down picture beside its file, as `<stem>.jpg`. */
export async function savePreview(file: string, shot: HTMLCanvasElement): Promise<Result<null>> {
  const blob = await new Promise<Blob | null>((resolve) => shot.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return { ok: false, errors: ["the preview did not encode"] };
  const init = { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob };
  return request(`${ROUTE}/${file.replace(/\.json$/, ".jpg")}`, init, async () => null);
}

/** A file name for a new map: the name in lower-case words joined by "-", made unique against `taken`. Pure. */
export function fileNameFor(name: string, taken: readonly string[]): string {
  const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "map";
  let file = `${stem}.json`;
  for (let n = 2; taken.includes(file); n++) file = `${stem}-${n}.json`;
  return file;
}

async function request<T>(url: string, init: RequestInit, read: (res: Response) => Promise<T>): Promise<Result<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) return { ok: false, errors: await errorsOf(res) };
    return { ok: true, value: await read(res) };
  } catch (e) {
    return { ok: false, errors: [`Could not reach the dev server (${e instanceof Error ? e.message : String(e)}).`] };
  }
}

async function errorsOf(res: Response): Promise<string[]> {
  try {
    const body = (await res.json()) as { errors?: string[] };
    if (body.errors?.length) return body.errors;
  } catch {
    // Not JSON: fall through.
  }
  return [`The dev server answered ${res.status}.`];
}
