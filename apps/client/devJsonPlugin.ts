import { readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const MAX_BODY = 256 * 1024;

export interface JsonRoute<T> {
  /** The plugin's name in Vite's logs. */
  name: string;
  route: string;
  /** The JSON file on disk that GET returns and PUT replaces. */
  file: string;
  /** Checks a PUT body. `errors` go to the client as they are, in a 422. */
  parse(json: unknown): { ok: true; value: T } | { ok: false; errors: unknown[] };
  /** The text written to `file`. */
  serialize(value: T): string;
}

/**
 * Dev server only: a table editor's disk access. GET returns the file. PUT checks the body with `parse` and writes
 * it with `serialize`. The write is what the game loads, so a bad body never reaches the disk.
 */
export function devJsonPlugin<T>(r: JsonRoute<T>): Plugin {
  return {
    name: r.name,
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(r.route, (req, res) => {
        handle(r, req, res).catch((e: unknown) => send(res, 500, { errors: [{ message: String(e) }] }));
      });
    },
  };
}

async function handle<T>(r: JsonRoute<T>, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "GET") return send(res, 200, JSON.parse(await readFile(r.file, "utf8")));
  if (req.method !== "PUT") return send(res, 405, { errors: [{ message: "GET or PUT only" }] });
  const parsed = r.parse(JSON.parse(await body(req)));
  if (!parsed.ok) return send(res, 422, { errors: parsed.errors });
  await writeAtomic(r.file, r.serialize(parsed.value));
  send(res, 200, parsed.value);
}

/** Write beside the file, then rename over it: a watcher never reads half a file. */
async function writeAtomic(path: string, text: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, text, "utf8");
  await rename(tmp, path);
}

async function body(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, status: number, json: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(json));
}
