import assert from "node:assert/strict";
import { get } from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createDb } from "./fake-db.mjs";
import { createApp } from "./server.mjs";
import { memoryStore } from "./store.mjs";

const distDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "demo-dist");

async function start(options = {}) {
  const db = createDb({ latencyMs: 20 });
  const app = createApp({ store: memoryStore(), db, distDir, ...options });
  const server = await new Promise((done) => {
    const listening = app.listen(0, "127.0.0.1", () => done(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, base, close: () => new Promise((done) => server.close(done)) };
}

test("fingerprinted assets are immutable for a year; the HTML shell always revalidates", async (t) => {
  const { base, close } = await start();
  t.after(close);
  const asset = await fetch(`${base}/assets/index-C4c61eeb.js`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
  const shell = await fetch(`${base}/incidents/42`);
  assert.equal(shell.status, 200);
  assert.equal(shell.headers.get("cache-control"), "no-cache");
  assert.match(await shell.text(), /CampusPulse status/);
  const etag = shell.headers.get("etag");
  assert.ok(etag, "the shell carries a validator");
  // node:http, not fetch: fetch adds "Cache-Control: no-cache" to conditional requests.
  const status = await new Promise((done, fail) => {
    get(`${base}/`, { headers: { "If-None-Match": etag } }, (res) => {
      res.resume();
      done(res.statusCode);
    }).on("error", fail);
  });
  assert.equal(status, 304);
});

test("a missing hashed asset is a 404, never the HTML shell", async (t) => {
  const { base, close } = await start();
  t.after(close);
  const missing = await fetch(`${base}/assets/index-00000000.js`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
});

test("cache-aside: the second read is a HIT and skips the database", async (t) => {
  const { base, db, close } = await start();
  t.after(close);
  const first = await fetch(`${base}/api/status`);
  assert.equal(first.headers.get("x-cache"), "MISS");
  assert.equal(first.headers.get("cache-control"), "public, max-age=10");
  const second = await fetch(`${base}/api/status`);
  assert.equal(second.headers.get("x-cache"), "HIT");
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(db.queries, 1);
});

test("concurrent misses are coalesced into one query", async (t) => {
  const { base, db, close } = await start();
  t.after(close);
  const responses = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/api/incidents`)));
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(db.queries, 1);
});

test("a write deletes the cached list so the next read is fresh", async (t) => {
  const { base, db, close } = await start({ allowWrites: true });
  t.after(close);
  await fetch(`${base}/api/incidents`);
  const created = await fetch(`${base}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Wi-Fi down in the library", service: "wifi" }),
  });
  assert.equal(created.status, 201);
  const after = await fetch(`${base}/api/incidents`);
  assert.equal(after.headers.get("x-cache"), "MISS");
  assert.equal(after.headers.get("cache-control"), "no-cache");
  const { incidents } = await after.json();
  assert.ok(incidents.some((i) => i.title === "Wi-Fi down in the library"));
  assert.equal(db.queries, 3);
});

test("writes are refused unless local practice writes are enabled", async (t) => {
  const { base, close } = await start();
  t.after(close);
  const refused = await fetch(`${base}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Nope", service: "wifi" }),
  });
  assert.equal(refused.status, 403);
});

test("personalized responses are never shareable", async (t) => {
  const { base, close } = await start();
  t.after(close);
  const me = await fetch(`${base}/api/me`, { headers: { Cookie: "sid=alice-demo" } });
  assert.equal(me.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await me.json(), { signedInAs: "alice-demo" });
});

test("the memory store expires entries after their TTL", async () => {
  let clock = 0;
  const store = memoryStore(() => clock);
  await store.setEx("k", 5, "v");
  assert.equal(await store.get("k"), "v");
  clock = 5000;
  assert.equal(await store.get("k"), null);
});
