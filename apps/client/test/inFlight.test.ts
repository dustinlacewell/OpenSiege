import assert from "node:assert/strict";
import { test } from "node:test";
import { InFlight } from "../src/audio/inFlight.ts";

test("accepts up to the cap, then refuses", () => {
  const f = new InFlight<string>(2);
  assert.equal(f.add("a"), 0);
  assert.equal(f.add("b"), 1);
  assert.equal(f.add("c"), null);
  assert.equal(f.size, 2);
});

test("take hands the value back once and frees a place", () => {
  const f = new InFlight<string>(1);
  const id = f.add("a")!;
  assert.equal(f.add("b"), null);
  assert.equal(f.take(id), "a");
  assert.equal(f.take(id), undefined);
  assert.equal(f.add("c"), 1);
});

test("ids are not reused after a take", () => {
  const f = new InFlight<number>(8);
  const a = f.add(1)!;
  f.take(a);
  assert.notEqual(f.add(2), a);
});

test("clear forgets every pending request", () => {
  const f = new InFlight<string>(2);
  const id = f.add("a")!;
  f.add("b");
  f.clear();
  assert.equal(f.size, 0);
  assert.equal(f.take(id), undefined);
});
