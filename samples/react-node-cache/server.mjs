#!/usr/bin/env node
// CSC 436 Week 5 — one Express server, four caching decisions.
// It serves a Vite/React build (dist/) plus a small CampusPulse API.
//
//   npm install && npm start              # in-memory app cache
//   REDIS_URL=redis://127.0.0.1:6379 npm start   # shared Redis app cache
//
// Layers configured here, from the user outward:
//   browser + CDN   -> Cache-Control on every response
//   app cache       -> cache-aside in memory or Redis, with X-Cache: HIT|MISS
import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./fake-db.mjs";
import { createStore } from "./store.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const services = ["printing", "wifi", "shuttle"];

export function createApp({ store, db, distDir, allowWrites = false }) {
  const app = express();
  app.disable("x-powered-by");
  const inflight = new Map();

  // Cache-aside with request coalescing: on a miss, only ONE caller runs the query;
  // everyone else who misses at the same moment awaits that same promise.
  async function cached(key, ttlSeconds, load) {
    const hit = await store.get(key);
    if (hit !== null) return { value: JSON.parse(hit), state: "HIT" };
    if (!inflight.has(key)) {
      inflight.set(key, (async () => {
        try {
          const value = await load();
          await store.setEx(key, ttlSeconds, JSON.stringify(value));
          return value;
        } finally {
          inflight.delete(key);
        }
      })());
    }
    return { value: await inflight.get(key), state: "MISS" };
  }

  // 1. Fingerprinted build output (dist/assets/index-<hash>.js): new bytes get a new
  //    URL, so browsers and CDNs may keep these for a year. A missing asset is a 404,
  //    never index.html.
  app.use("/assets", express.static(resolve(distDir, "assets"), {
    immutable: true, maxAge: "1y", index: false, fallthrough: false,
  }));

  // 2. Public and identical for everyone: the CDN may share it for 10 s, and the
  //    origin also keeps it in the app cache so a CDN miss storm reaches the DB once.
  app.get("/api/status", async (req, res) => {
    const { value, state } = await cached("status:v1", 10, () => db.status());
    res.set({ "Cache-Control": "public, max-age=10", "X-Cache": state });
    res.json(value);
  });

  // 3. Changes on every write: kept in the app cache, where we can delete it on
  //    write, and NOT in browser or CDN caches, where we cannot.
  app.get("/api/incidents", async (req, res) => {
    const { value, state } = await cached("incidents:open:v1", 30,
      () => db.openIncidents());
    res.set({ "Cache-Control": "no-cache", "X-Cache": state });
    res.json({ incidents: value });
  });

  const jsonBody = express.json({ limit: "4kb" });
  app.post("/api/incidents", jsonBody, async (req, res) => {
    if (!allowWrites) {
      return res.status(403).json({ error: "Read-only. Writes are local practice only." });
    }
    const { title, service } = req.body ?? {};
    if (typeof title !== "string" || title.trim().length < 3 || !services.includes(service)) {
      return res.status(400).json({ error: "Send a title (3+ chars) and a listed service." });
    }
    const created = await db.createIncident({ title: title.trim(), service });
    await Promise.all([store.del("incidents:open:v1"), store.del("status:v1")]);
    res.status(201).location(`/api/incidents/${created.id}`).json(created);
  });

  // 4. Personalized: never stored by anyone but this user's own tab.
  app.get("/api/me", (req, res) => {
    const sid = /(?:^|;\s*)sid=([\w-]{1,64})/.exec(req.headers.cookie ?? "")?.[1];
    res.set("Cache-Control", "private, no-store");
    res.json({ signedInAs: sid ?? null });
  });

  // 5. The SPA shell: small, and it names the current asset hashes, so every load
  //    must check for a newer deploy (a cheap 304 when nothing changed).
  app.get("/{*splat}", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile("index.html", { root: distDir });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status ?? error.statusCode ?? 500;
    res.set("Cache-Control", "no-store");
    res.status(status).json({ error: status === 404 ? "Not found." : "Server error." });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3000);
  const allowWrites = process.env.ALLOW_WRITES === "1";
  if (allowWrites && host !== "127.0.0.1") throw new Error("Practice writes require HOST=127.0.0.1.");
  const built = resolve(process.env.DIST_DIR ?? resolve(here, "dist"));
  const distDir = existsSync(resolve(built, "index.html")) ? built : resolve(here, "demo-dist");
  const store = await createStore();
  const app = createApp({ store, db: createDb(), distDir, allowWrites });
  app.listen(port, host, () => {
    console.log(`CampusPulse cache demo: http://${host}:${port}`);
    console.log(`  serving ${distDir}`);
    console.log(`  app cache: ${store.kind}${allowWrites ? " · local practice writes on" : ""}`);
  });
}
