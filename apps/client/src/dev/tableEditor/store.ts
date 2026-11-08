import type { Change, DraftCell } from "./model.ts";
import type { ViewPrefs } from "./rows.ts";
import type { Refusal, Table } from "./schema.ts";

// The table editor's edges: the dev server's JSON route, and the browser's copy of the unsaved edits and view settings.

export type LoadResult = { ok: true; table: Table } | { ok: false; message: string };
export type SaveResult =
  | { ok: true; table: Table }
  | { ok: false; reason: "invalid"; errors: Refusal[] }
  | { ok: false; reason: "network"; message: string };

export interface Remote {
  load(): Promise<LoadResult>;
  /** Sends the whole table. The dev server checks it and writes it only if it is legal. */
  save(table: Table): Promise<SaveResult>;
}

export interface LocalStore {
  loadDraft(): DraftCell[];
  /** Stores the changed cells, or nothing when there are none. */
  saveDraft(changes: readonly Change[]): void;
  loadPrefs(): ViewPrefs;
  savePrefs(prefs: ViewPrefs): void;
}

/** How the file's JSON maps to a table, for a file that is not stored as one. `decode` may throw; the remote reports it. */
export interface Codec {
  decode(json: unknown): Table;
  encode(table: Table): unknown;
}

const TABLE_AS_IS: Codec = { decode: (json) => json as Table, encode: (table) => table };

/**
 * A JSON route made by `devJsonPlugin`: GET the table, PUT the table. A 422 answers `{errors}`; `toRefusal`
 * reads each one into a `Refusal` when the dev server names them otherwise. `codec` maps the file's JSON to a table
 * and back; the default sends and reads the table itself.
 */
export function createHttpRemote(route: string, toRefusal: (raw: never) => Refusal = (raw) => raw as Refusal, codec: Codec = TABLE_AS_IS): Remote {
  return {
    async load() {
      try {
        const res = await fetch(route, { cache: "no-store" });
        if (!res.ok) return { ok: false, message: `The dev server answered ${res.status}.` };
        return { ok: true, table: codec.decode(await res.json()) };
      } catch (e) {
        return { ok: false, message: describe(e) };
      }
    },
    async save(table) {
      try {
        const res = await fetch(route, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(codec.encode(table)) });
        if (res.status === 422) return { ok: false, reason: "invalid", errors: ((await res.json()) as { errors: never[] }).errors.map(toRefusal) };
        if (!res.ok) return { ok: false, reason: "network", message: `The dev server answered ${res.status}.` };
        return { ok: true, table: codec.decode(await res.json()) };
      } catch (e) {
        return { ok: false, reason: "network", message: describe(e) };
      }
    },
  };
}

function describe(e: unknown): string {
  return `Could not reach the dev server (${e instanceof Error ? e.message : String(e)}).`;
}

const DEFAULT_PREFS: ViewPrefs = { collapsed: [], filter: "", changedOnly: false };

/**
 * Keeps the draft at `<prefix>.draft` and the view settings at `<prefix>.prefs`. Storage can be missing or full:
 * every access is guarded, and the page works without it. `sectionIds` is the whitelist for folded sections.
 * The draft is stored as `{kind, key, value}` cells, the shape the unit editor always wrote, so old drafts load.
 */
export function createLocalStore(prefix: string, sectionIds: readonly string[]): LocalStore {
  const draftKey = `${prefix}.draft`;
  const prefsKey = `${prefix}.prefs`;
  const sections = new Set(sectionIds);
  return {
    loadDraft() {
      const raw = read(draftKey);
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((c) => isObject(c) && typeof c.kind === "string" && typeof c.key === "string" && "value" in c)
        .map((c: { kind: string; key: string; value: unknown }) => ({ column: c.kind, field: c.key, value: c.value }));
    },
    saveDraft(changes) {
      write(draftKey, changes.length === 0 ? null : changes.map((c) => ({ kind: c.column, key: c.field, value: c.value })));
    },
    loadPrefs() {
      const raw = read(prefsKey);
      if (!isObject(raw)) return DEFAULT_PREFS;
      return {
        collapsed: Array.isArray(raw.collapsed) ? raw.collapsed.filter((s): s is string => typeof s === "string" && sections.has(s)) : [],
        filter: typeof raw.filter === "string" ? raw.filter : "",
        changedOnly: raw.changedOnly === true,
      };
    },
    savePrefs(prefs) {
      write(prefsKey, prefs);
    },
  };
}

function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

/** Writes JSON, or removes the key for null. */
function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is off or full. The editor still works.
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
