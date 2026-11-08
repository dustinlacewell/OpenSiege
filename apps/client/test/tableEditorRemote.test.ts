import { test } from "node:test";
import assert from "node:assert/strict";
import { createFeed } from "../src/dev/tableEditor/feed.ts";
import type { Table } from "../src/dev/tableEditor/schema.ts";
import { createHttpRemote, type Codec } from "../src/dev/tableEditor/store.ts";

// The table editor core's two seams a page can plug into: the change feed and the remote's codec.

test("a feed sends each value to every listener in subscription order", () => {
  const feed = createFeed<number>();
  const seen: string[] = [];
  feed.subscribe((v) => seen.push(`a${v}`));
  feed.subscribe((v) => seen.push(`b${v}`));
  feed.emit(1);
  feed.emit(2);
  assert.deepEqual(seen, ["a1", "b1", "a2", "b2"]);
});

/** Runs `body` with `fetch` answering `status` and `json`, and records the requests. */
async function withFetch(status: number, json: unknown, body: (sent: { url: string; init?: RequestInit }[]) => Promise<void>): Promise<void> {
  const real = globalThis.fetch;
  const sent: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({ url, init });
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  try {
    await body(sent);
  } finally {
    globalThis.fetch = real;
  }
}

// A file that is a list of [name, value] pairs, edited as a table.
const codec: Codec = {
  decode: (json) => Object.fromEntries((json as [string, number][]).map(([name, v]) => [name, { v }])),
  encode: (table) => Object.entries(table).map(([name, row]) => [name, row.v]),
};
const TABLE: Table = { a: { v: 1 }, b: { v: 2 } };

test("without a codec the remote reads and sends the table itself", async () => {
  await withFetch(200, TABLE, async (sent) => {
    const remote = createHttpRemote("/r");
    assert.deepEqual(await remote.load(), { ok: true, table: TABLE });
    assert.deepEqual(await remote.save(TABLE), { ok: true, table: TABLE });
    assert.equal(sent[1]!.init!.body, JSON.stringify(TABLE));
  });
});

test("a codec maps the file to a table on load and save, and the table to the file on save", async () => {
  await withFetch(200, [["a", 1], ["b", 2]], async (sent) => {
    const remote = createHttpRemote("/r", undefined, codec);
    assert.deepEqual(await remote.load(), { ok: true, table: TABLE });
    assert.deepEqual(await remote.save(TABLE), { ok: true, table: TABLE });
    assert.equal(sent[1]!.init!.body, JSON.stringify([["a", 1], ["b", 2]]));
  });
});

test("a codec that throws on load is reported as a message", async () => {
  await withFetch(200, "nope", async () => {
    const bad: Codec = { decode: () => { throw new Error("file is wrong"); }, encode: (t) => t };
    const result = await createHttpRemote("/r", undefined, bad).load();
    assert.ok(!result.ok && result.message.includes("file is wrong"));
  });
});

test("a 422 is read into refusals", async () => {
  await withFetch(422, { errors: [{ column: "a", field: "v", message: "bad" }] }, async () => {
    const result = await createHttpRemote("/r", undefined, codec).save(TABLE);
    assert.deepEqual(result, { ok: false, reason: "invalid", errors: [{ column: "a", field: "v", message: "bad" }] });
  });
});
