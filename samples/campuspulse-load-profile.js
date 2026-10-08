/* ============================================================================
   weeks/week05/samples/campuspulse-load-profile.js
   ----------------------------------------------------------------------------
   THE STANDARD CAMPUSPULSE WORKLOAD.  k6.  CSC 436.

   One profile, used by the whole course, so that every student's numbers are
   comparable and a grader can reproduce them:

     * Week 5  (HW5)  — cache hit ratio, edge vs origin latency, budget check
     * Week 10 (HW9)  — access patterns, index behaviour, p99 under load

   Week 10 REUSES this file. Do not fork it; if it needs to change, raise it so
   both weeks change together.

   ----------------------------------------------------------------------------
   RULES OF ENGAGEMENT — read before you run this.

     You may point this ONLY at a system you own or that the course owns:
     your own CampusPulse staging environment, or `http://127.0.0.1:8788`.
     Pointing a load generator at any third party — including your CDN vendor's
     marketing site, your university's real services, or a classmate's app —
     is out of scope for this course, under any circumstances, and may violate
     your provider's acceptable-use policy. The cap below is deliberate.

   ----------------------------------------------------------------------------
   THE PROFILE  (fixed — do not tune it to make your numbers look better)

     Stage 1   30s   ramp   0 -> 10 VUs
     Stage 2  120s   hold        10 VUs
     Stage 3   30s   ramp  10 -> 0  VUs
     Total    180s   peak concurrency 10; do not override the stages on the CLI

     Request mix per iteration, 1 iteration ~= 1 simulated user journey:
       1x  GET /                 the HTML document
       1x  GET /assets/app.<hash>.js   a content-addressed asset
       3x  GET /api/status       the polled status feed
       1x  GET /api/now          volatile but fresh-cacheable; cannot revalidate unchanged bytes

     Think time: 1s between requests, 2s at the end of the journey.
     -> steady-state ~= 10 VUs / 7s per journey ~= 1.4 journeys/s ~= 8.6 req/s.

   ----------------------------------------------------------------------------
   USAGE

     k6 run campuspulse-load-profile.js                      # local edge
     k6 run -e BASE=https://status.yourdomain.example \
            -e ASSET=/assets/app.4f2c1a.js \
            campuspulse-load-profile.js

     k6 run --summary-export=k6-summary.json campuspulse-load-profile.js

   Install: https://grafana.com/docs/k6/latest/set-up/install-k6/
   ========================================================================== */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://127.0.0.1:8788";
const ASSET = __ENV.ASSET || "/assets/app.c4c61eeb.js";

/* Custom metrics. These are the numbers you put in your HW5 write-up. */
const cacheHitRate = new Rate("cache_hit_rate");
const edgeHits = new Counter("cache_status_hit");
const edgeMisses = new Counter("cache_status_miss");
const edgeRevalidated = new Counter("cache_status_revalidated");
const edgeBypass = new Counter("cache_status_bypass");
const edgeUnknown = new Counter("cache_status_unknown");
const htmlTTFB = new Trend("ttfb_html", true);
const apiTTFB = new Trend("ttfb_api", true);
const assetTTFB = new Trend("ttfb_asset", true);

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "120s", target: 10 },
    { duration: "30s", target: 0 },
  ],

  /* THE PERFORMANCE BUDGET, expressed as pass/fail gates. k6 exits non-zero if
     any threshold is breached, so this is a CI gate, not a report.
     These are the COURSE defaults. State your own budget in HW5 and justify any
     number you change. */
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% of requests may fail
    "http_req_duration{kind:html}": ["p(95)<800"], // ms
    "http_req_duration{kind:api}": ["p(95)<500"],
    "http_req_duration{kind:asset}": ["p(95)<300"],
    cache_hit_rate: ["rate>0.60"], // >60% of cacheable requests served by the edge
  },

  /* Politeness + safety. */
  noConnectionReuse: false,
  userAgent: "k6/CSC436-CampusPulse-load-profile",
};

/** Read whichever cache-status header this deployment emits.
 *  k6 normalises header names to Title-Case, but CDNs disagree about casing,
 *  so check the realistic spellings and fall back to a scan. */
function cacheStatus(res) {
  const h = res.headers || {};
  const candidates = [
    "Cf-Cache-Status", "CF-Cache-Status", "cf-cache-status",
    "X-Cache-Status", "x-cache-status",
    "X-Cache", "x-cache",                 // CloudFront: "Hit from cloudfront"
    "X-Cache-Hits", "Fastly-Debug-Path",
  ];
  for (const name of candidates) {
    if (h[name]) return normalize(h[name]);
  }
  for (const name of Object.keys(h)) {
    if (name.toLowerCase().endsWith("cache-status")) return normalize(h[name]);
  }
  return "NONE";
}

/** Fold vendor spellings into the Cloudflare vocabulary the course uses. */
function normalize(raw) {
  const v = String(raw).toLowerCase();
  if (v.indexOf("refreshhit") >= 0 || v.indexOf("revalidated") >= 0) return "REVALIDATED";
  if (v.indexOf("hit") >= 0) return "HIT";           // "Hit from cloudfront"
  if (v.indexOf("miss") >= 0) return "MISS";         // "Miss from cloudfront"
  if (v.indexOf("stale") >= 0) return "STALE";
  if (v.indexOf("updating") >= 0) return "UPDATING";
  if (v.indexOf("expired") >= 0) return "EXPIRED";
  if (v.indexOf("bypass") >= 0) return "BYPASS";
  if (v.indexOf("dynamic") >= 0) return "DYNAMIC";
  return raw;
}

function record(res, kind) {
  const status = String(cacheStatus(res)).toUpperCase();
  // Two different questions, and they are not the same question:
  //   "was the body served from the store?"  HIT, STALE, UPDATING, REVALIDATED
  //   "was an origin request avoided?"       HIT, STALE only
  // REVALIDATED reused the stored bytes but DID contact the origin. It is
  // counted as a hit here because the payload was saved; if you care about
  // origin load, count it separately. Say which you mean in your write-up.
  if (status === "HIT" || status === "STALE") { edgeHits.add(1); cacheHitRate.add(true); }
  else if (status === "REVALIDATED" || status === "UPDATING") { edgeRevalidated.add(1); cacheHitRate.add(true); }
  else if (status === "MISS" || status === "EXPIRED") { edgeMisses.add(1); cacheHitRate.add(false); }
  else if (status === "BYPASS" || status === "DYNAMIC" || status === "NONE/UNKNOWN") { edgeBypass.add(1); }
  else { edgeUnknown.add(1); }   // reported so a vendor we did not anticipate is visible

  if (kind === "html") htmlTTFB.add(res.timings.waiting);
  if (kind === "api") apiTTFB.add(res.timings.waiting);
  if (kind === "asset") assetTTFB.add(res.timings.waiting);
}

export default function () {
  // 1. The document.
  let res = http.get(`${BASE}/`, { tags: { kind: "html" } });
  check(res, { "html 200": (r) => r.status === 200 });
  record(res, "html");
  sleep(1);

  // 2. The content-addressed asset. Should be an edge HIT almost always.
  res = http.get(`${BASE}${ASSET}`, { tags: { kind: "asset" } });
  check(res, { "asset 200": (r) => r.status === 200 });
  record(res, "asset");
  sleep(1);

  // 3. The polled status feed, three times — this is what a real dashboard does.
  for (let i = 0; i < 3; i += 1) {
    res = http.get(`${BASE}/api/status`, { tags: { kind: "api" } });
    check(res, { "status 200": (r) => r.status === 200 });
    record(res, "api");
    sleep(1);
  }

  // 4. The endpoint whose body changes on every request, so a validator can
  //    never match. It is still *fresh-cacheable* for its TTL — the point is
  //    that every expiry costs a full payload, forever.
  res = http.get(`${BASE}/api/now`, { tags: { kind: "api" } });
  check(res, { "now 200": (r) => r.status === 200 });
  record(res, "api");

  sleep(2);
}

export function handleSummary(data) {
  const m = data.metrics;
  const g = (name, field = "value") => (m[name] ? m[name].values[field] : 0);
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const ms = (x) => `${Math.round(x)} ms`;

  const lines = [
    "CampusPulse standard load profile — summary",
    "==========================================",
    `target            ${BASE}`,
    `duration          180s (30s ramp / 120s hold / 30s ramp-down), peak 10 VUs`,
    `requests          ${g("http_reqs", "count")}`,
    `failed            ${pct(g("http_req_failed", "rate"))}`,
    "",
    "latency (server wait / TTFB)",
    `  html   p95      ${ms(g("ttfb_html", "p(95)"))}`,
    `  api    p95      ${ms(g("ttfb_api", "p(95)"))}`,
    `  asset  p95      ${ms(g("ttfb_asset", "p(95)"))}`,
    "",
    "edge cache",
    `  hit ratio       ${pct(g("cache_hit_rate", "rate"))}`,
    `  HIT / STALE     ${g("cache_status_hit", "count")}`,
    `  MISS / EXPIRED  ${g("cache_status_miss", "count")}`,
    `  REVALIDATED     ${g("cache_status_revalidated", "count")}   (bytes reused, origin contacted)`,
    `  BYPASS/DYNAMIC  ${g("cache_status_bypass", "count")}`,
    `  unrecognised    ${g("cache_status_unknown", "count")}`,
    "",
  ].join("\n");

  return {
    stdout: `\n${lines}\n`,
    "k6-summary.txt": lines,
    "k6-summary.json": JSON.stringify(data, null, 2),
  };
}
