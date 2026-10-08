/* ============================================================================
   weeks/week05/samples/web-vitals-rum.js — CSC 436 Week 5
   ----------------------------------------------------------------------------
   Field measurement for a site that has no field data yet.

   WHY THIS FILE EXISTS
   --------------------
   Chrome's CrUX dataset — the "field data" you see in PageSpeed Insights and
   Search Console — only reports on origins that meet a popularity threshold.
   A CampusPulse instance three people have ever visited will never appear in
   it, and that is not a bug in your work. See:
   https://developer.chrome.com/docs/crux/methodology#eligibility

   So you collect your own. Your laptop's browser, a second browser or
   profile, your phone on cellular — those are real user sessions on real
   devices, all operated by you. Fewer of them than Google has, measured the
   same way.

   WHAT IT DOES
   ------------
   Uses Google's `web-vitals` library to capture LCP, INP and CLS as they are
   finalised, attaches the context you need to interpret them, and ships each
   one to your own collector with `sendBeacon` so the report survives the page
   being closed.

   HOOK IT UP
   ----------
     npm i web-vitals
     import "./web-vitals-rum.js";        // once, from your app entry point

   Note the import below is from `web-vitals/attribution`, NOT `web-vitals`. The
   standard build does not populate `metric.attribution`, and the attribution
   fields are the entire reason this file is useful: without them you learn that
   LCP was 4.1 s and nothing about WHICH element took 4.1 s.

   Point VITALS_ENDPOINT at your own backend, or proxy /api/vitals to the
   supplied loopback rum-collector.mjs. See homework Task 5c. A new OpenTelemetry
   collector is not required for this small pilot.

   Metric thresholds are Google's published "good/needs improvement/poor"
   boundaries: https://web.dev/articles/defining-core-web-vitals-thresholds

   ONE CAVEAT WORTH KNOWING BEFORE YOU COUNT SESSIONS
   -------------------------------------------------
   INP is only reported if the user actually interacted. A session where someone
   loaded the page and left produces LCP and CLS but no INP. If you need 20 INP
   samples, you need 20 sessions in which somebody clicked something.
   ========================================================================== */

import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals/attribution";

const VITALS_ENDPOINT = "/api/vitals";

/* A stable id per page view, so you can join a slow LCP to the trace that
   produced it. This is the same correlation id your backend logs. */
const pageViewId =
  (globalThis.crypto?.randomUUID?.() ?? `pv-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Everything you will wish you had recorded when the number looks wrong. */
function context(metric) {
  const nav = navigator.connection || {};
  return {
    pageViewId,
    url: location.pathname, // Never export query strings that may contain tokens.
    // Was this a fresh load, a back/forward restore, or a prerender? A bfcache
    // restore has a near-zero LCP and will flatter your numbers if you ignore it.
    // web-vitals reports this per metric, which is more reliable than reading
    // the navigation entry yourself.
    navigationType: metric?.navigationType ?? "unknown",
    effectiveType: nav.effectiveType ?? null, // "4g", "3g", "slow-2g"
    downlinkMbps: nav.downlink ?? null,
    rttMs: nav.rtt ?? null,
    saveData: nav.saveData ?? null,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    viewport: `${innerWidth}x${innerHeight}`,
    dpr: devicePixelRatio,
  };
}

/** The attribution field that names the responsible element differs per metric. */
function targetOf(metric) {
  const a = metric.attribution;
  if (!a) return null;
  switch (metric.name) {
    case "LCP": return a.element ?? a.target ?? null; // attribution field varies by library version
    case "INP": return a.interactionTarget ?? null;   // the element interacted with
    case "CLS": return a.largestShiftTarget ?? null;  // the element that moved
    default: return null;
  }
}

function send(metric) {
  const body = JSON.stringify({
    name: metric.name,               // LCP | INP | CLS | FCP | TTFB
    value: metric.value,
    rating: metric.rating,           // good | needs-improvement | poor
    delta: metric.delta,
    id: metric.id,
    // The single most useful field in the whole payload: WHICH element.
    // Without this you are guessing.
    target: targetOf(metric),
    ...context(metric),
    ts: Date.now(),
  });

  // sendBeacon survives unload; fetch(keepalive) is the fallback.
  const queued = navigator.sendBeacon?.(VITALS_ENDPOINT, new Blob([body], { type: "application/json" }));
  if (!queued) {
    fetch(VITALS_ENDPOINT, { body, method: "POST", keepalive: true, headers: { "content-type": "application/json" } })
      .catch(() => { /* A measurement must not break the application. */ });
  }
}

/* Reports can be updated (for example after visibility changes). Deduplicate
   by pageViewId + metric id, retaining the latest value before computing p75. */
onLCP(send);
onINP(send);
onCLS(send);
onFCP(send);
onTTFB(send);

export { pageViewId };
