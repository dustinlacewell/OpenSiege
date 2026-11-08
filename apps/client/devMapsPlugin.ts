import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { parseMap } from "../../packages/map/src/file.ts";
import type { MapEntry } from "../../packages/map/src/types.ts";

const DIR = fileURLToPath(new URL("../../maps/", import.meta.url));
const ROUTE = "/__dev/maps";
const MAP_FILE = /^[a-z0-9-]+\.json$/;
const PREVIEW_FILE = /^[a-z0-9-]+\.jpg$/;
const MAX_MAP = 64 * 1024 * 1024;
const MAX_PREVIEW = 4 * 1024 * 1024;

/**
 * Dev server only: the map editor's level library, the repo's `maps/` folder. GET `/` lists the maps. GET and PUT
 * `/<stem>.json` read and write a map; PUT checks it with `parseMap`, so a bad map never reaches the disk.
 * GET and PUT `/<stem>.jpg` read and write its top-down preview.
 */
export function devMapsPlugin(): Plugin {
  return {
    name: "dev-maps",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(ROUTE, (req, res) => {
        handle(req, res).catch((e: unknown) => send(res, 500, "application/json", JSON.stringify({ errors: [String(e)] })));
      });
    },
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const file = (req.url ?? "/").replace(/^\//, "").split("?")[0]!;
  if (file === "" && req.method === "GET") return sendJson(res, 200, await list());
  if (MAP_FILE.test(file)) return mapRoute(req, res, file);
  if (PREVIEW_FILE.test(file)) return previewRoute(req, res, file);
  sendJson(res, 404, { errors: [`no map file "${file}"`] });
}

async function mapRoute(req: IncomingMessage, res: ServerResponse, file: string): Promise<void> {
  if (req.method === "GET") return send(res, 200, "application/json", await readFile(join(DIR, file)));
  if (req.method !== "PUT") return sendJson(res, 405, { errors: ["GET or PUT only"] });
  const text = (await body(req, MAX_MAP)).toString("utf8");
  const parsed = parseMap(text);
  if ("errors" in parsed) return sendJson(res, 422, parsed);
  await writeAtomic(join(DIR, file), text);
  sendJson(res, 200, { ok: true });
}

async function previewRoute(req: IncomingMessage, res: ServerResponse, file: string): Promise<void> {
  if (req.method === "GET") return send(res, 200, "image/jpeg", await readFile(join(DIR, file)));
  if (req.method !== "PUT") return sendJson(res, 405, { errors: ["GET or PUT only"] });
  const bytes = await body(req, MAX_PREVIEW);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return sendJson(res, 422, { errors: ["the preview is not a JPEG"] });
  await writeAtomic(join(DIR, file), bytes);
  sendJson(res, 200, { ok: true });
}

/** Every map in the folder, by name. A file that does not parse is listed with its file name. */
async function list(): Promise<MapEntry[]> {
  await mkdir(DIR, { recursive: true });
  const files = (await readdir(DIR)).filter((f) => MAP_FILE.test(f));
  const entries = await Promise.all(files.map(async (file) => entryOf(file, await readFile(join(DIR, file), "utf8"), await previewOf(file))));
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** The preview's URL, with its write time so a new shot is not served from cache. */
async function previewOf(file: string): Promise<string | null> {
  const jpg = file.replace(/\.json$/, ".jpg");
  try {
    return `${ROUTE}/${jpg}?v=${Math.round((await stat(join(DIR, jpg))).mtimeMs)}`;
  } catch {
    return null;
  }
}

function entryOf(file: string, text: string, preview: string | null): MapEntry {
  try {
    const o = JSON.parse(text) as { name?: unknown; spec?: { width?: unknown; height?: unknown } };
    const name = typeof o.name === "string" ? o.name : file;
    return { file, name, width: Number(o.spec?.width) || 0, height: Number(o.spec?.height) || 0, preview };
  } catch {
    return { file, name: file, width: 0, height: 0, preview };
  }
}

/** Write beside the file, then rename over it: a reader never sees half a file. */
async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

async function body(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, json: unknown): void {
  send(res, status, "application/json", JSON.stringify(json));
}

function send(res: ServerResponse, status: number, type: string, data: string | Buffer): void {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", "no-store");
  res.end(data);
}
