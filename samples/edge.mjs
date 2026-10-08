#!/usr/bin/env node
/* ============================================================================
   weeks/week05/samples/edge.mjs — CSC 436 Week 5
   ----------------------------------------------------------------------------
   A ~150-line shared cache that sits in front of origin.mjs. No dependencies.

     node edge.mjs                          # conservative cache key
     CACHE_KEY=vary-only node edge.mjs      # standards-minimal: honour Vary, nothing more
     CACHE_KEY=url-only  node edge.mjs      # the incident

   It emits the same status vocabulary Cloudflare documents on `cf-cache-status`,
   here on `x-cache-status`:

     MISS         eligible for cache, nothing stored under this key; went to origin
     HIT          served from store, still fresh
     EXPIRED      stored copy was stale; went to origin and got a full 200
     REVALIDATED  stored copy was stale; origin answered 304, so we reused bytes
     STALE        stored copy was stale and the origin could not be reached
     BYPASS       origin response was not storable (no-store, private)

   Cloudflare also documents UPDATING (the asynchronous stale-while-revalidate
   path) and DYNAMIC. This model revalidates synchronously and therefore never
   emits UPDATING — a simplification, not a disagreement.

   Why this exists: you cannot read a CDN's cache-key implementation, so you
   cannot see the bug. Here you can. `cacheKey()` below IS the cache key. Change
   the mode and watch an authenticated page get handed to a stranger.

   This is a teaching model, not a CDN. It ignores Range, chunked bodies,
   authenticated purge, tiered cache, and about forty other things.
   ========================================================================== */

import { createServer, request as httpRequest } from "node:http";

const PORT = Number(process.env.PORT || 8788);
const ORIGIN_PORT = Number(process.env.ORIGIN_PORT || 8080);
const ORIGIN_HOST = process.env.ORIGIN_HOST || "127.0.0.1";
const KEY_MODE = process.env.CACHE_KEY || "conservative"; // conservative | vary-only | url-only
if (!["conservative", "vary-only", "url-only"].includes(KEY_MODE)) {
  console.error(`edge: CACHE_KEY must be conservative | vary-only | url-only (got "${KEY_MODE}")`);
  process.exit(2);
}

const store = new Map(); // primary key -> { vary, variants: Map<secondary key, entry> }

/* ---------------------------------------------------------------- policy -- */

function parseCacheControl(value = "") {
  const out = {};
  for (const token of value.split(",")) {
    const [k, v] = token.trim().split("=");
    if (!k) continue;
    out[k.toLowerCase()] = v === undefined ? true : Number(v) || v;
  }
  return out;
}

/** Shared caches take s-maxage over max-age. RFC 9111 §4.2.1. */
function freshnessLifetime(cc) {
  if (cc["s-maxage"] !== undefined) return Number(cc["s-maxage"]);
  if (cc["max-age"] !== undefined) return Number(cc["max-age"]);
  return 0;
}

/**
 * May a stale copy be served?
 *
 * RFC 9111 §4.2.4: a cache MUST NOT generate a stale response if prohibited by
 * `no-cache`, `must-revalidate`, `proxy-revalidate`, or an applicable
 * `s-maxage`. And §5.2.2.10: "The s-maxage directive incorporates the semantics
 * of the proxy-revalidate response directive for a shared cache."
 *
 * So `s-maxage=10, stale-while-revalidate=30` does NOT do what it looks like.
 * The s-maxage prohibition wins and the stale window is unreachable. This is a
 * real, easy-to-miss interaction, and Block B slide 5 is about it.
 */
function mayServeStale(cc) {
  if (cc["no-cache"] || cc["must-revalidate"] || cc["proxy-revalidate"]) return false;
  if (cc["s-maxage"] !== undefined) return false;
  return true;
}

function storable(cc, req) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  if (cc["no-store"]) return false;
  if (cc.private) return false; // a SHARED cache must not store `private`
  if (req.headers.authorization && !cc.public && cc["s-maxage"] === undefined && !cc["must-revalidate"]) return false;
  return true;
}


/* -------------------------------------------------------------- the key --- */
/**
 * THE CACHE KEY, in two parts, exactly as RFC 9111 §4.1 describes it.
 *
 *   primaryKey()   method + path + query, plus (in conservative mode) the
 *                  cookie and Authorization, whether or not the origin asked.
 *   secondaryKey() the values of the request headers the STORED RESPONSE
 *                  named in its `Vary` field.
 *
 * The two-level shape matters: a cache cannot know which request headers are
 * significant until it has already stored a response that says so. That is why
 * you look up the primary key first, read `Vary` off what you find, and only
 * then select a variant.
 *
 * Modes:
 *   "conservative" — stricter than any CDN default. Costs hit rate, buys you
 *                    immunity to the origin forgetting `Vary`.
 *   "vary-only"    — standards-minimal. Correct, and entirely dependent on the
 *                    origin getting `Vary` right.
 *   "url-only"     — the URL and nothing else. Fast, and it will eventually
 *                    serve one user's page to another.
 *
 * Real CDNs default somewhere between the last two. The safe mode is the one
 * you have to configure.
 */
function primaryKey(req) {
  const url = new URL(req.url, `http://${ORIGIN_HOST}`);
  const base = `${req.method} ${url.pathname}${url.search}`;
  if (KEY_MODE !== "conservative") return base;

  const parts = [base];
  if (req.headers.cookie) parts.push(`cookie=${req.headers.cookie}`);
  if (req.headers.authorization) parts.push(`authorization=${req.headers.authorization}`);
  return parts.join(" | ");
}

/** `null` means "this response must never be reused" — see `Vary: *`. */
function secondaryKey(req, varyHeader) {
  if (KEY_MODE === "url-only" || !varyHeader) return "";
  const names = varyHeader.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  // RFC 9111 §4.1: a stored response with `Vary: *` never matches.
  if (names.includes("*")) return null;
  return names
    .filter((n) => n !== "accept-encoding") // stripped upstream, see fetchOrigin
    .map((n) => `${n}=${req.headers[n] ?? ""}`)
    .join(" | ");
}

/** Find the stored variant that matches this request, if any. */
function lookup(req) {
  const bucket = store.get(primaryKey(req));
  if (!bucket) return null;
  const sk = secondaryKey(req, bucket.vary);
  if (sk === null) return null;
  return bucket.variants.get(sk) ?? null;
}

function save(req, entry, varyHeader) {
  const pk = primaryKey(req);
  const sk = secondaryKey(req, varyHeader);
  if (sk === null) return; // `Vary: *` — storable, but never reusable
  let bucket = store.get(pk);
  // If Vary changed, the old variants were keyed on different headers. Drop them.
  if (!bucket || bucket.vary !== varyHeader) {
    bucket = { vary: varyHeader, variants: new Map() };
    store.set(pk, bucket);
  }
  bucket.variants.set(sk, entry);
}

/* ------------------------------------------------------------- upstream --- */

function fetchOrigin(req, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...req.headers, ...extraHeaders, host: `${ORIGIN_HOST}:${ORIGIN_PORT}` };
    delete headers["accept-encoding"]; // keep the teaching transcript readable
    const upstream = httpRequest(
      { host: ORIGIN_HOST, port: ORIGIN_PORT, method: req.method, path: req.url, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    upstream.on("error", reject);
    upstream.setTimeout(5000, () => upstream.destroy(new Error("origin timeout")));
    req.pipe(upstream);
  });
}

/* ------------------------------------------------------------------ serve -- */

function reply(res, entry, status, ageSec) {
  const headers = { ...entry.headers };
  delete headers["content-length"];
  delete headers["transfer-encoding"];
  headers["x-cache-status"] = status;
  // NOTE: RFC 9111 §4.2.3 defines Age as time since the response was generated
  // or validated at the ORIGIN, including any upstream age and transit time.
  // This model tracks only local residency, which is a simplification, not the
  // real definition. A real CDN's Age can be non-zero on your first request.
  headers.age = String(Math.max(0, Math.floor(ageSec)));
  headers["x-cache-key-mode"] = KEY_MODE;
  headers["content-length"] = String(entry.body.length);
  res.writeHead(entry.status, headers);
  res.end(entry.body);
}

const server = createServer(async (req, res) => {
  // A purge is a repair tool. Real CDNs authenticate it; this one does not.
  if (req.method === "PURGE") {
    const url = new URL(req.url, `http://${ORIGIN_HOST}`);
    let removed = 0;
    for (const [k, bucket] of store) {
      if (k.includes(` ${url.pathname}`)) { removed += bucket.variants.size; store.delete(k); }
    }
    res.writeHead(200, { "content-type": "text/plain", "x-purged-entries": String(removed) });
    return res.end(`purged ${removed} entr${removed === 1 ? "y" : "ies"} for ${url.pathname}\n`);
  }

  const entry = lookup(req);
  const now = Date.now();

  if (entry) {
    const ageSec = (now - entry.storedAt) / 1000;
    const lifetime = freshnessLifetime(entry.policy);
    if (ageSec <= lifetime && !entry.policy["no-cache"]) {
      return reply(res, entry, "HIT", ageSec);
    }

    // Stale. Try to revalidate with the validators we stored.
    const conditional = {};
    if (entry.headers.etag) conditional["if-none-match"] = entry.headers.etag;
    else if (entry.headers["last-modified"]) conditional["if-modified-since"] = entry.headers["last-modified"];

    try {
      const fresh = await fetchOrigin(req, conditional);
      if (fresh.status === 304) {
        // RFC 9111 §4.3.4: update the stored response's headers from the 304,
        // then reuse the stored body.
        for (const [k, v] of Object.entries(fresh.headers)) {
          if (["content-length", "transfer-encoding", "connection"].includes(k)) continue;
          entry.headers[k] = v;
        }
        entry.storedAt = now;
        entry.policy = parseCacheControl(fresh.headers["cache-control"] ?? entry.headers["cache-control"]);
        store.delete(primaryKey(req));
        if (storable(entry.policy, req)) save(req, entry, entry.headers.vary);
        return reply(res, entry, "REVALIDATED", 0);
      }
      const policy = parseCacheControl(fresh.headers["cache-control"]);
      const next = { status: fresh.status, headers: fresh.headers, body: fresh.body, storedAt: now, policy };
      store.delete(primaryKey(req)); // The new response supersedes all obsolete variants.
      if (storable(policy, req) && fresh.status === 200) save(req, next, fresh.headers.vary);
      return reply(res, next, "EXPIRED", 0);
    } catch (error) {
      // stale-if-error (RFC 5861) — but only if nothing prohibits stale.
      const staleIfError = Number(entry.policy["stale-if-error"] || 0);
      if (mayServeStale(entry.policy) && ageSec <= lifetime + staleIfError) {
        return reply(res, entry, "STALE", ageSec);
      }
      res.writeHead(504, { "content-type": "text/plain", "x-cache-status": "MISS" });
      return res.end(`edge: origin unreachable and stale not permitted — ${error.message}\n`);
    }
  }

  // Nothing stored.
  let fresh;
  try {
    fresh = await fetchOrigin(req);
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain", "x-cache-status": "MISS" });
    return res.end(`edge: origin unreachable — ${error.message}\n`);
  }

  const policy = parseCacheControl(fresh.headers["cache-control"]);
  const next = { status: fresh.status, headers: fresh.headers, body: fresh.body, storedAt: now, policy };

  if (fresh.status === 200 && storable(policy, req)) {
    save(req, next, fresh.headers.vary);
    return reply(res, next, "MISS", 0);
  }
  return reply(res, next, "BYPASS", 0);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`edge    listening on http://127.0.0.1:${PORT}  -> origin ${ORIGIN_HOST}:${ORIGIN_PORT}`);
  console.log(`        cache key mode: ${KEY_MODE}${KEY_MODE === "url-only" ? "   <-- DELIBERATELY BROKEN" : ""}`);
});
